use crate::config::Config;
use crate::user::model::{BasicUser, Role, UpdateUser};
use crate::user::service::{
    CreateUserError, delete_account, find_account_by_id, login_account, register_account,
    update_account,
};
use actix_files::NamedFile;
use actix_http::HttpMessage;
use actix_identity::Identity;
use actix_web::error::ErrorBadRequest;
use actix_web::web::Data;
use actix_web::{HttpRequest, HttpResponse, Responder, Result, delete, get, post, web};
use mongodb::Client;
use mongodb::bson::oid::ObjectId;
use validator::Validate;

fn identity_id(identity: &Identity) -> Result<ObjectId, HttpResponse> {
    let value = identity
        .id()
        .map_err(|_| HttpResponse::Unauthorized().finish())?;
    ObjectId::parse_str(value).map_err(|_| HttpResponse::Unauthorized().finish())
}

fn map_create_error(error: CreateUserError) -> HttpResponse {
    match error {
        CreateUserError::Duplicate => HttpResponse::Conflict().body("Unable to create account."),
        CreateUserError::Database(error) => {
            log::error!("user creation failed: {error}");
            HttpResponse::InternalServerError().finish()
        }
        CreateUserError::PasswordHash => {
            HttpResponse::BadRequest().body("Username or password is invalid!")
        }
    }
}

#[post("/register")]
async fn register(
    client: Data<Client>,
    config: Data<Config>,
    user: web::Json<BasicUser>,
) -> Result<HttpResponse> {
    if !config.allow_registration {
        return Ok(HttpResponse::Forbidden().finish());
    }
    user.validate()
        .map_err(|_| ErrorBadRequest("Username or password is invalid!"))?;
    match register_account(&client, &config.database_db, &user).await {
        Ok(_) => Ok(HttpResponse::Ok().body("Account registered!")),
        Err(error) => Ok(map_create_error(error)),
    }
}

#[post("/admin/users")]
async fn admin_users(
    client: Data<Client>,
    config: Data<Config>,
    identity: Identity,
    user: web::Json<BasicUser>,
) -> HttpResponse {
    let Ok(actor_id) = identity_id(&identity) else {
        return HttpResponse::Unauthorized().finish();
    };
    let Some(actor) = find_account_by_id(&client, &config.database_db, actor_id).await else {
        return HttpResponse::Unauthorized().finish();
    };
    if !actor.is_admin() {
        return HttpResponse::Forbidden().finish();
    }
    if user.validate().is_err() {
        return HttpResponse::BadRequest().body("Username or password is invalid!");
    }
    match register_account(&client, &config.database_db, &user).await {
        Ok(account) => HttpResponse::Created().json(serde_json::json!({ "email": account.email })),
        Err(error) => map_create_error(error),
    }
}

#[post("/login")]
async fn login(
    request: HttpRequest,
    client: Data<Client>,
    config: Data<Config>,
    user: web::Json<BasicUser>,
) -> Result<String> {
    user.validate()
        .map_err(|_| ErrorBadRequest("Username or password is invalid!"))?;
    let Some(account) = login_account(&client, &config.database_db, &user).await else {
        return Ok("Account not found!".to_owned());
    };
    let Some(id) = account.id else {
        return Ok("Account not found!".to_owned());
    };
    Identity::login(&request.extensions(), id.to_string())?;
    Ok(format!("Welcome {}!", account.email))
}

#[get("/logout")]
async fn logout(user: Identity) -> Result<String> {
    user.logout();
    Ok("Logged out!".to_owned())
}

#[post("/profile")]
async fn profile(
    client: Data<Client>,
    config: Data<Config>,
    user: Identity,
    data: web::Json<UpdateUser>,
) -> HttpResponse {
    let Ok(user_id) = identity_id(&user) else {
        return HttpResponse::Unauthorized().finish();
    };
    if data.validate().is_err() {
        return HttpResponse::BadRequest().body("Username or password is invalid!");
    }
    if update_account(&client, &config.database_db, user_id, &data).await {
        HttpResponse::Ok().body("Account updated!")
    } else {
        HttpResponse::BadRequest().finish()
    }
}

#[delete("/delete")]
async fn delete(client: Data<Client>, config: Data<Config>, user: Identity) -> HttpResponse {
    let Ok(user_id) = identity_id(&user) else {
        return HttpResponse::Unauthorized().finish();
    };
    let Some(account) = find_account_by_id(&client, &config.database_db, user_id).await else {
        return HttpResponse::Unauthorized().finish();
    };
    if account.role == Role::ADMIN {
        return HttpResponse::Forbidden().finish();
    }
    if delete_account(&client, &config.database_db, user_id).await {
        HttpResponse::Ok().body("Account successfully deleted!")
    } else {
        HttpResponse::BadRequest().finish()
    }
}

#[get("/")]
async fn home() -> impl Responder {
    NamedFile::open_async("./frontend/dist/browser/index.html").await
}
