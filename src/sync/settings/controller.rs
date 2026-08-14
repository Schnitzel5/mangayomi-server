use crate::sync::live::{Domain, LiveSyncHub, origin_client_id};
use crate::sync::settings::model::SettingsObj;
use crate::sync::settings::service::sync_settings;
use actix_identity::Identity;
use actix_web::{HttpRequest, HttpResponse, Responder, post, web};
use mongodb::Client;
use mongodb::bson::oid::ObjectId;

#[post("/settings")]
async fn sync_settings_obj(
    client: web::Data<Client>,
    hub: web::Data<LiveSyncHub>,
    request: HttpRequest,
    user: Identity,
    settings: web::Json<SettingsObj>,
) -> impl Responder {
    let authenticated_user_id = user.id().unwrap();
    let user_id = ObjectId::parse_str(&authenticated_user_id).unwrap();
    let contains_mutations = settings.settings.is_some();

    match sync_settings(user_id, &settings, client).await {
        Ok(data) => {
            if contains_mutations {
                hub.broadcast(
                    &authenticated_user_id,
                    origin_client_id(request.headers()),
                    Domain::Settings,
                );
            }
            HttpResponse::Ok().json(data)
        }
        Err(err) => {
            log::error!("Settings sync failed: {err}");
            HttpResponse::InternalServerError().finish()
        }
    }
}
