use actix_files::NamedFile;
use crate::user::model::BasicUser;
use crate::user::service::{login_account, register_account};
use actix_http::HttpMessage;
use actix_identity::Identity;
use actix_web::error::ErrorBadRequest;
use actix_web::web::Data;
use actix_web::{HttpRequest, HttpResponse, Responder, Result, get, post, web};
use mongodb::Client;
use validator::Validate;

/// register a new account with the given email and password
#[post("/register")]
async fn register(client: Data<Client>, user: web::Json<BasicUser>) -> Result<String> {
    let is_valid = user.validate();
    if is_valid.is_err() {
        return Err(ErrorBadRequest("Username or password is invalid!"));
    }
    let result = register_account(client, &user);
    match result.await {
        Some(_account) => Ok("Account registered!".to_owned()),
        None => Ok(format!("Account already exists {}!", user.email)),
    }
}

/// login into the session
#[post("/login")]
async fn login(
    request: HttpRequest,
    client: Data<Client>,
    user: web::Json<BasicUser>,
) -> Result<String> {
    let is_valid = user.validate();
    if is_valid.is_err() {
        return Err(ErrorBadRequest("Username or password is invalid!"));
    }
    let result = login_account(client, &user);
    match result.await {
        Some(account) => {
            Identity::login(&request.extensions(), account.id.unwrap().to_string())?;
            Ok(format!("Welcome {}!", account.email))
        }
        None => Ok(format!("Account not found {}!", user.email)),
    }
}

/// logout from session
#[get("/logout")]
async fn logout(user: Identity) -> Result<String> {
    user.logout();
    Ok("Logged out!".to_owned())
}

#[get("/")]
async fn home() -> impl Responder {
    NamedFile::open_async("./frontend/dist/browser/index.html").await
}
