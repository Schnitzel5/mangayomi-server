use crate::config::Config;
use crate::sync::live::{Domain, LiveSyncHub, has_mutations, origin_client_id};
use crate::sync::manga::model::MangaList;
use crate::sync::manga::service::sync_manga_list;
use actix_identity::Identity;
use actix_web::{HttpRequest, HttpResponse, Responder, post, web};
use mongodb::Client;
use mongodb::bson::oid::ObjectId;

#[post("/manga")]
async fn sync_manga(
    client: web::Data<Client>,
    config: web::Data<Config>,
    hub: web::Data<LiveSyncHub>,
    request: HttpRequest,
    user: Identity,
    manga_list: web::Json<MangaList>,
) -> impl Responder {
    let authenticated_user_id = match user.id() {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().finish(),
    };
    let user_id = match ObjectId::parse_str(&authenticated_user_id) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().finish(),
    };
    let contains_mutations = has_mutations(
        manga_list.reset_all,
        [
            manga_list.categories.len(),
            manga_list.deleted_categories.len(),
            manga_list.manga.len(),
            manga_list.deleted_manga.len(),
            manga_list.chapters.len(),
            manga_list.deleted_chapters.len(),
            manga_list.tracks.len(),
            manga_list.deleted_tracks.len(),
        ],
    );
    let result = match sync_manga_list(user_id, &manga_list, client, &config.database_db).await {
        Ok(result) => result,
        Err(err) => {
            log::error!("Manga sync failed: {err}");
            return HttpResponse::InternalServerError().finish();
        }
    };

    if contains_mutations {
        hub.broadcast(
            &authenticated_user_id,
            origin_client_id(request.headers()),
            Domain::Manga,
        );
    }

    HttpResponse::Ok().json(result)
}
