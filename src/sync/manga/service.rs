use crate::sync::common::{SyncResult, sync_collection};
use crate::sync::manga::model::MangaList;
use actix_web::web;
use mongodb::Client;
use mongodb::bson::oid::ObjectId;

pub async fn sync_manga_list(
    user_id: ObjectId,
    manga_list: &web::Json<MangaList>,
    db: web::Data<Client>,
) -> SyncResult<MangaList> {
    let reset_all = manga_list.reset_all.unwrap_or(false);

    let (category_result, manga_result, chapter_result, track_result) = tokio::try_join!(
        sync_collection(
            &db,
            "categories",
            user_id,
            &manga_list.categories,
            &manga_list.deleted_categories,
            reset_all,
        ),
        sync_collection(
            &db,
            "manga",
            user_id,
            &manga_list.manga,
            &manga_list.deleted_manga,
            reset_all,
        ),
        sync_collection(
            &db,
            "chapters",
            user_id,
            &manga_list.chapters,
            &manga_list.deleted_chapters,
            reset_all,
        ),
        sync_collection(
            &db,
            "tracks",
            user_id,
            &manga_list.tracks,
            &manga_list.deleted_tracks,
            reset_all,
        ),
    )?;
    let (categories, deleted_categories) = category_result;
    let (manga, deleted_manga) = manga_result;
    let (chapters, deleted_chapters) = chapter_result;
    let (tracks, deleted_tracks) = track_result;

    Ok(MangaList {
        categories,
        manga,
        chapters,
        tracks,
        deleted_categories,
        deleted_manga,
        deleted_chapters,
        deleted_tracks,
        reset_all: manga_list.reset_all,
    })
}
