use crate::sync::common::{SyncResult, sync_collection};
use crate::sync::update::model::UpdateList;
use actix_web::web;
use mongodb::Client;
use mongodb::bson::oid::ObjectId;

pub async fn sync_update_list(
    user_id: ObjectId,
    update_list: &web::Json<UpdateList>,
    db: web::Data<Client>,
    database: &str,
) -> SyncResult<UpdateList> {
    let reset_all = update_list.reset_all.unwrap_or(false);

    let (updates, deleted_updates) = sync_collection(
        &db,
        database,
        "updates",
        user_id,
        &update_list.updates,
        &update_list.deleted_updates,
        reset_all,
    )
    .await?;

    Ok(UpdateList {
        updates,
        deleted_updates,
        reset_all: update_list.reset_all,
    })
}
