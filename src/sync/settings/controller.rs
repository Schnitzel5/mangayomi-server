use crate::config::Config;
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
    config: web::Data<Config>,
    hub: web::Data<LiveSyncHub>,
    request: HttpRequest,
    user: Identity,
    settings: web::Json<SettingsObj>,
) -> impl Responder {
    let authenticated_user_id = match user.id() {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().finish(),
    };
    let user_id = match ObjectId::parse_str(&authenticated_user_id) {
        Ok(id) => id,
        Err(_) => return HttpResponse::Unauthorized().finish(),
    };
    let contains_mutations = settings.settings.is_some();

    match sync_settings(user_id, &settings, client, &config.database_db).await {
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
