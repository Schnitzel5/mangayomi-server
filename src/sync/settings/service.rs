use crate::sync::common::{SyncResult, upsert};
use crate::sync::settings::model::{Settings, SettingsObj};
use actix_web::web;
use mongodb::bson::doc;
use mongodb::bson::oid::ObjectId;
use mongodb::{Client, Collection};

pub async fn sync_settings(
    user_id: ObjectId,
    settings: &web::Json<SettingsObj>,
    db: web::Data<Client>,
) -> SyncResult<SettingsObj> {
    let col_settings: Collection<Settings> = db.database("mangayomi").collection("settings");

    if let Some(settings) = &settings.settings {
        upsert(
            &db,
            "settings",
            user_id,
            std::slice::from_ref(settings),
            true,
        )
        .await?;
    }

    let found = col_settings.find_one(doc! { "user": user_id }).await?;
    Ok(SettingsObj { settings: found })
}
