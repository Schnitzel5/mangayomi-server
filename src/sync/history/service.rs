use crate::sync::common::{SyncResult, sync_collection};
use crate::sync::history::model::HistoryList;
use actix_web::web;
use mongodb::Client;
use mongodb::bson::oid::ObjectId;

pub async fn sync_history_list(
    user_id: ObjectId,
    history_list: &web::Json<HistoryList>,
    db: web::Data<Client>,
    database: &str,
) -> SyncResult<HistoryList> {
    let reset_all = history_list.reset_all.unwrap_or(false);

    let (histories, deleted_histories) = sync_collection(
        &db,
        database,
        "histories",
        user_id,
        &history_list.histories,
        &history_list.deleted_histories,
        reset_all,
    )
    .await?;

    Ok(HistoryList {
        histories,
        deleted_histories,
        reset_all: history_list.reset_all,
    })
}
