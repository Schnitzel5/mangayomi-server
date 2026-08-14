use actix_web::web;
use futures::TryStreamExt;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::{doc, to_document};
use mongodb::options::{UpdateOneModel, WriteModel};
use mongodb::{Client, Collection, Namespace};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub type SyncResult<T> = Result<T, mongodb::error::Error>;

pub trait Model {
    fn get_id(&self) -> i32;
    fn get_updated_at(&self) -> i64;
}

const DB: &str = "mangayomi";
pub const TOMBSTONES: &str = "tombstones";

/// Records a deletion so stale copies on other devices can't resurrect it.
// ponytail: tombstones grow forever; add a TTL index if it ever matters.
#[derive(Serialize, Deserialize)]
struct Tombstone {
    user: ObjectId,
    coll: String,
    id: i32,
    #[serde(rename = "deletedAt")]
    deleted_at: i64,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock before epoch")
        .as_millis() as i64
}

/// Full merge flow for one collection: tombstone-guarded conditional upserts,
/// deletions recorded as tombstones, then the authoritative server state.
/// Returns (all docs for the user, all tombstoned ids for the user).
pub async fn sync_collection<T>(
    db: &web::Data<Client>,
    coll_name: &str,
    user_id: ObjectId,
    items: &[T],
    deleted_ids: &[i32],
    reset_all: bool,
) -> SyncResult<(Vec<T>, Vec<i32>)>
where
    T: Model + Serialize + DeserializeOwned + Unpin + Send + Sync,
{
    let collection: Collection<T> = db.database(DB).collection(coll_name);
    let tombstones: Collection<Tombstone> = db.database(DB).collection(TOMBSTONES);

    if reset_all {
        // Client state replaces server state. Upsert first, prune second, so a
        // crash mid-request never leaves the user with an empty library.
        upsert(db, coll_name, user_id, items, false).await?;
        let ids: Vec<i32> = items.iter().map(|i| i.get_id()).collect();
        collection
            .delete_many(doc! { "user": user_id, "id": { "$nin": ids } })
            .await?;
        tombstones
            .delete_many(doc! { "user": user_id, "coll": coll_name })
            .await?;
    } else {
        upsert(db, coll_name, user_id, items, true).await?;
        if !deleted_ids.is_empty() {
            collection
                .delete_many(doc! { "user": user_id, "id": { "$in": deleted_ids.to_vec() } })
                .await?;
            bury(db, coll_name, user_id, deleted_ids).await?;
        }
    }

    let docs = collection
        .find(doc! { "user": user_id })
        .await?
        .try_collect()
        .await?;
    let dead = tombstones
        .find(doc! { "user": user_id, "coll": coll_name })
        .await?
        .try_collect::<Vec<_>>()
        .await?
        .into_iter()
        .map(|t| t.id)
        .collect();
    Ok((docs, dead))
}

/// Last-write-wins upsert: the incoming doc replaces the stored one only when
/// its `updatedAt` is strictly newer (evaluated server-side in one pipeline —
/// no reliance on duplicate-key errors). With `guard`, items deleted at or
/// after their `updatedAt` are skipped, and genuinely newer items clear their
/// tombstone. Without `guard` (resetAll), incoming docs win unconditionally.
pub async fn upsert<T>(
    db: &web::Data<Client>,
    coll_name: &str,
    user_id: ObjectId,
    items: &[T],
    guard: bool,
) -> SyncResult<()>
where
    T: Model + Serialize + Sync,
{
    if items.is_empty() {
        return Ok(());
    }
    let tombstones: Collection<Tombstone> = db.database(DB).collection(TOMBSTONES);
    // ponytail: updatedAt and deletedAt come from client/server clocks; skew
    // shifts which write wins, a logical clock fixes it if users complain.
    let dead: HashMap<i32, i64> = if guard {
        let ids: Vec<i32> = items.iter().map(|i| i.get_id()).collect();
        tombstones
            .find(doc! { "user": user_id, "coll": coll_name, "id": { "$in": ids } })
            .await?
            .try_collect::<Vec<_>>()
            .await?
            .into_iter()
            .map(|t| (t.id, t.deleted_at))
            .collect()
    } else {
        HashMap::new()
    };

    let namespace = Namespace::new(DB, coll_name);
    let mut ops = vec![];
    let mut revived = vec![];
    for item in items {
        if let Some(&deleted_at) = dead.get(&item.get_id()) {
            if item.get_updated_at() <= deleted_at {
                continue; // deletion is newer than this copy: deletion wins
            }
            revived.push(item.get_id());
        }
        let mut new_doc = to_document(item).expect("model serializes to BSON");
        new_doc.insert("user", user_id);
        // $literal keeps user data (e.g. names starting with '$') inert.
        let replacement = doc! { "$literal": new_doc };
        let update = if guard {
            vec![doc! {
                "$replaceWith": {
                    "$cond": [
                        { "$lt": [ { "$ifNull": ["$updatedAt", i64::MIN] }, item.get_updated_at() ] },
                        replacement,
                        "$$ROOT",
                    ]
                }
            }]
        } else {
            vec![doc! { "$replaceWith": replacement }]
        };
        ops.push(WriteModel::UpdateOne(
            UpdateOneModel::builder()
                .namespace(namespace.clone())
                .filter(doc! { "id": item.get_id(), "user": user_id })
                .update(update)
                .upsert(true)
                .build(),
        ));
    }
    if !ops.is_empty() {
        let result = db.bulk_write(ops).ordered(false).await?;
        log::info!("Upserted {} {}.", result.modified_count, coll_name);
    }
    if !revived.is_empty() {
        tombstones
            .delete_many(doc! { "user": user_id, "coll": coll_name, "id": { "$in": revived } })
            .await?;
    }
    Ok(())
}

async fn bury(
    db: &web::Data<Client>,
    coll_name: &str,
    user_id: ObjectId,
    ids: &[i32],
) -> SyncResult<()> {
    let now = now_ms();
    let namespace = Namespace::new(DB, TOMBSTONES);
    let ops: Vec<WriteModel> = ids
        .iter()
        .map(|id| {
            WriteModel::UpdateOne(
                UpdateOneModel::builder()
                    .namespace(namespace.clone())
                    .filter(doc! { "user": user_id, "coll": coll_name, "id": *id })
                    .update(doc! { "$set": { "deletedAt": now } })
                    .upsert(true)
                    .build(),
            )
        })
        .collect();
    db.bulk_write(ops).ordered(false).await?;
    Ok(())
}
