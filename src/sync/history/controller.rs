use crate::config::Config;
use crate::sync::history::model::HistoryList;
use crate::sync::history::service::sync_history_list;
use crate::sync::live::{Domain, LiveSyncHub, has_mutations, origin_client_id};
use actix_identity::Identity;
use actix_web::{HttpRequest, HttpResponse, Responder, post, web};
use mongodb::Client;
use mongodb::bson::oid::ObjectId;

#[post("/histories")]
async fn sync_histories(
    client: web::Data<Client>,
    config: web::Data<Config>,
    hub: web::Data<LiveSyncHub>,
    request: HttpRequest,
    user: Identity,
    history_list: web::Json<HistoryList>,
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
        history_list.reset_all,
        [
            history_list.histories.len(),
            history_list.deleted_histories.len(),
        ],
    );
    let result = match sync_history_list(user_id, &history_list, client, &config.database_db).await
    {
        Ok(result) => result,
        Err(err) => {
            log::error!("History sync failed: {err}");
            return HttpResponse::InternalServerError().finish();
        }
    };

    if contains_mutations {
        hub.broadcast(
            &authenticated_user_id,
            origin_client_id(request.headers()),
            Domain::Histories,
        );
    }

    HttpResponse::Ok().json(result)
}
