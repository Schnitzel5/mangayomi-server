use crate::sync::settings::model::SettingsObj;
use crate::sync::settings::service::sync_settings;
use actix_identity::Identity;
use actix_web::{HttpResponse, Responder, post, web};
use mongodb::Client;
use mongodb::bson::oid::ObjectId;

#[post("/settings")]
async fn sync_settings_obj(
    client: web::Data<Client>,
    user: Identity,
    settings: web::Json<SettingsObj>,
) -> impl Responder {
    let user_id = ObjectId::parse_str(&user.id().unwrap()).unwrap();
    match sync_settings(user_id, &settings, client).await {
        Some(data) => HttpResponse::Ok().json(data),
        None => HttpResponse::InternalServerError().finish(),
    }
}
