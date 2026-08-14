use crate::sync::live::{Domain, LiveSyncHub, has_mutations, origin_client_id};
use crate::sync::update::model::UpdateList;
use crate::sync::update::service::sync_update_list;
use actix_identity::Identity;
use actix_web::{HttpRequest, HttpResponse, Responder, post, web};
use mongodb::Client;
use mongodb::bson::oid::ObjectId;

#[post("/updates")]
async fn sync_updates(
    client: web::Data<Client>,
    hub: web::Data<LiveSyncHub>,
    request: HttpRequest,
    user: Identity,
    update_list: web::Json<UpdateList>,
) -> impl Responder {
    let authenticated_user_id = user.id().unwrap();
    let user_id = ObjectId::parse_str(&authenticated_user_id).unwrap();
    let contains_mutations = has_mutations(
        update_list.reset_all,
        [update_list.updates.len(), update_list.deleted_updates.len()],
    );
    let result = match sync_update_list(user_id, &update_list, client).await {
        Ok(result) => result,
        Err(err) => {
            log::error!("Update sync failed: {err}");
            return HttpResponse::InternalServerError().finish();
        }
    };

    if contains_mutations {
        hub.broadcast(
            &authenticated_user_id,
            origin_client_id(request.headers()),
            Domain::Updates,
        );
    }

    HttpResponse::Ok().json(result)
}
