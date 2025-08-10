use crate::sync::settings::model::{Settings, SettingsObj};
use actix_web::web;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::{doc, to_document};
use mongodb::options::{UpdateOneModel, WriteModel};
use mongodb::{Client, Collection, Namespace};
use serde::de::DeserializeOwned;

pub async fn sync_settings(
    user_id: ObjectId,
    settings: &web::Json<SettingsObj>,
    db: web::Data<Client>,
) -> Option<SettingsObj> {
    let col_settings = db.database("mangayomi").collection("settings");

    match &settings.settings {
        Some(settings) => {
            upsert(&db, col_settings.namespace(), user_id, settings).await;
        }
        None => {}
    }

    match find_one(&col_settings, user_id).await {
        Some(obj) => Some(SettingsObj { settings: obj }),
        None => None,
    }
}

async fn upsert(
    db: &web::Data<Client>,
    namespace: Namespace,
    user_id: ObjectId,
    settings: &Settings,
) {
    let mut doc = to_document(&settings).unwrap();
    doc.insert("user", user_id);
    match db
        .bulk_write(vec![WriteModel::UpdateOne(
            UpdateOneModel::builder()
                .namespace(namespace.to_owned())
                .filter(doc! {
                    "id": settings.id,
                    "user": user_id,
                    "updatedAt": { "$lt": settings.updated_at },
                })
                .update(doc! {
                    "$set": doc
                })
                .upsert(true)
                .build(),
        )])
        .ordered(false)
        .await
    {
        Ok(result) => log::info!("Upserted {} updates.", result.modified_count),
        Err(_) => {}
    }
}

async fn find_one<T: DeserializeOwned + Unpin + Send + Sync>(
    collection: &Collection<T>,
    user_id: ObjectId,
) -> Option<T> {
    match collection.find_one(doc! { "user": user_id }).await {
        Ok(result) => Some(result.unwrap()),
        Err(err) => {
            log::error!("{}", err);
            None
        }
    }
}
