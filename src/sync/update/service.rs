use crate::sync::update::model::{Update, UpdateList};
use actix_web::web;
use futures::TryStreamExt;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::{doc, to_document};
use mongodb::options::{UpdateOneModel, WriteModel};
use mongodb::{Client, Collection, Namespace};
use serde::de::DeserializeOwned;

pub async fn sync_update_list(
    user_id: ObjectId,
    update_list: &web::Json<UpdateList>,
    db: web::Data<Client>,
) -> UpdateList {
    let col_updates = db.database("mangayomi").collection("updates");
    let reset_all = update_list
        .reset_all
        .clone()
        .get_or_insert(false)
        .to_owned();

    if reset_all {
        delete_many(&col_updates, user_id, &vec![], true).await;
    }

    upsert(&db, col_updates.namespace(), user_id, &update_list.updates).await;

    if !reset_all {
        delete_many(&col_updates, user_id, &update_list.deleted_updates, false).await;
    }

    UpdateList {
        updates: find_all(&col_updates, user_id).await,
        deleted_updates: vec![],
        reset_all: update_list.reset_all,
    }
}

async fn delete_many<T: Send + Sync>(
    collection: &Collection<T>,
    user_id: ObjectId,
    ids: &Vec<i32>,
    reset_all: bool,
) {
    if ids.is_empty() {
        return;
    }
    let del_tracks_result = collection
        .delete_many(if (reset_all) {
            doc! {
                "user": user_id,
            }
        } else {
            doc! {
                "id": doc! {
                    "$in": ids
                },
                "user": user_id,
            }
        })
        .await;
    match del_tracks_result {
        Ok(result) => log::info!("Deleted {} {}.", result.deleted_count, collection.name()),
        Err(_) => log::error!("Failed to delete {}.", collection.name()),
    }
}

async fn upsert(
    db: &web::Data<Client>,
    namespace: Namespace,
    user_id: ObjectId,
    updates: &Vec<Update>,
) {
    let mut ops = vec![];
    for update in updates {
        let mut doc = to_document(&update).unwrap();
        doc.insert("user", user_id);
        ops.push(WriteModel::UpdateOne(
            UpdateOneModel::builder()
                .namespace(namespace.to_owned())
                .filter(doc! {
                    "id": update.id,
                    "user": user_id,
                    "updatedAt": { "$lt": update.updated_at },
                })
                .update(doc! {
                    "$set": doc
                })
                .upsert(true)
                .build(),
        ));
    }
    if !ops.is_empty() {
        match db.bulk_write(ops).ordered(false).await {
            Ok(result) => log::info!("Upserted {} updates.", result.modified_count),
            Err(_) => {}
        }
    }
}

async fn find_all<T: DeserializeOwned + Unpin + Send + Sync>(
    collection: &Collection<T>,
    user_id: ObjectId,
) -> Vec<T> {
    match collection.find(doc! { "user": user_id }).await {
        Ok(result) => result.try_collect().await.unwrap(),
        Err(err) => {
            log::error!("{}", err);
            vec![]
        }
    }
}
