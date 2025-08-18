use crate::sync::history::model::History;
use crate::sync::manga::model::{Category, Chapter, Manga, Track};
use crate::sync::update::model::Update;
use actix_governor::governor::middleware::NoOpMiddleware;
use actix_governor::{Governor, GovernorConfig, GovernorConfigBuilder, PeerIpKeyExtractor};
use actix_identity::IdentityMiddleware;
use actix_session::SessionMiddleware;
use actix_session::config::{CookieContentSecurity, PersistentSession, TtlExtensionPolicy};
use actix_session::storage::CookieSessionStore;
use actix_web::cookie::{Key, SameSite};
use actix_web::middleware::{Logger, NormalizePath};
use actix_web::{
    App, HttpResponse, HttpServer, Scope, cookie::time::Duration as CookieDuration, web,
};
use mongodb::bson::doc;
use mongodb::options::{ClientOptions, IndexOptions};
use mongodb::{Client, IndexModel};
use std::fs;
use tera::Tera;
use walkdir::WalkDir;

mod db;
mod globals;
mod sync;
mod user;
mod app;

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    dotenvy::dotenv().ok();
    unsafe {
        std::env::set_var("RUST_LOG", "debug");
    }
    env_logger::init();

    let db_url = globals::DATABASE_URL.as_str();
    let host = globals::HOST.as_str();
    let port = globals::PORT.as_str();
    let session_ttl = &globals::SESSION_TTL;
    // let redis_url = globals::REDIS_URL.as_str();
    let key = &globals::SECRET_KEY;
    let secret_key = if key.len() < 64 {
        log::info!("Generated a random key because SECRET_KEY is not set in .env");
        Key::generate()
    } else {
        Key::from(key.as_bytes())
    };

    log::info!("Connecting to {}:{}...", db_url, host);

    db::CONN
        .get_or_init(|| async {
            let mut client_options = ClientOptions::parse(db_url).await.unwrap();
            client_options.max_connecting = Some(20);
            client_options.min_pool_size = Some(1);
            let result = Client::with_options(client_options).unwrap();
            log::info!("Connected to MongoDB.");
            result
        })
        .await;
    log::info!("Initializing Tera...");
    let mut tera = Tera::default();
    match tera.add_raw_templates(get_templates()) {
        Ok(t) => t,
        Err(e) => {
            println!("Parsing error(s): {}", e);
            ::std::process::exit(1);
        }
    };
    tera.autoescape_on(vec![".html"]);
    log::info!("Initialized Tera.");

    let conn = db::CONN.get().unwrap();

    init_db_indexes(conn).await;

    /*
    if *globals::USE_REDIS {
                let redis_store = RedisSessionStore::new(redis_url)
                    .await
                    .unwrap();
                SessionMiddleware::new(
                    redis_store.clone(),
                    secret_key.clone(),
                )
            } else {
                SessionMiddleware::new(
                    CookieSessionStore::default(),
                    secret_key.clone(),
                )
            }
     */

    HttpServer::new(move || {
        App::new()
            .wrap(Logger::default())
            .wrap(NormalizePath::trim())
            .wrap(IdentityMiddleware::default())
            .wrap(Governor::new(&rate_limiter()))
            .wrap(
                SessionMiddleware::builder(CookieSessionStore::default(), secret_key.clone())
                    .session_lifecycle(
                        PersistentSession::default()
                            .session_ttl(CookieDuration::days(**session_ttl))
                            .session_ttl_extension_policy(TtlExtensionPolicy::OnEveryRequest),
                    )
                    .cookie_secure(true)
                    .cookie_same_site(SameSite::Strict)
                    .cookie_content_security(CookieContentSecurity::Private)
                    .cookie_http_only(true)
                    .build(),
            )
            .app_data(web::Data::new(conn.clone()))
            .app_data(web::Data::new(tera.clone()))
            .service(actix_files::Files::new("/assets", "./resources/assets"))
            .service(actix_files::Files::new("/static", "./frontend/dist"))
            .service(user::controller::register)
            .service(user::controller::login)
            .service(user::controller::logout)
            .service(user::controller::home)
            .service(sync_controller())
            .service(app::app_routes::basic_controller())
            .default_service(web::to(|| HttpResponse::NotFound()))
    })
    .bind(format!("{}:{}", host, port))?
    .run()
    .await
}

fn sync_controller() -> Scope {
    web::scope("/sync")
        .app_data(web::JsonConfig::default().limit(250 << 20))
        .service(sync::manga::controller::sync_manga)
        .service(sync::history::controller::sync_histories)
        .service(sync::update::controller::sync_updates)
        .service(sync::settings::controller::sync_settings_obj)
}

fn rate_limiter() -> GovernorConfig<PeerIpKeyExtractor, NoOpMiddleware> {
    GovernorConfigBuilder::default()
        .const_requests_per_minute(30)
        .burst_size(15)
        .finish()
        .unwrap()
}

fn get_templates() -> Vec<(String, String)> {
    let mut templates: Vec<(String, String)> = Vec::new();

    for file in WalkDir::new("./resources/templates")
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if file.metadata().unwrap().is_file() {
            let template_name: String = file
                .path()
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .to_string();
            match fs::read_to_string(file.path()) {
                Ok(template_raw) => {
                    log::info!("Adding template: {}", template_name);
                    templates.push((template_name, template_raw));
                }
                Err(_) => {}
            };
        }
    }
    templates
}

async fn init_db_indexes(conn: &Client) {
    let col_categories: mongodb::Collection<Category> =
        conn.database("mangayomi").collection("categories");
    let col_manga: mongodb::Collection<Manga> = conn.database("mangayomi").collection("manga");
    let col_chapter: mongodb::Collection<Chapter> =
        conn.database("mangayomi").collection("chapters");
    let col_track: mongodb::Collection<Track> = conn.database("mangayomi").collection("tracks");
    let col_histories: mongodb::Collection<History> =
        conn.database("mangayomi").collection("histories");
    let col_updates: mongodb::Collection<Update> = conn.database("mangayomi").collection("updates");
    let col_settings: mongodb::Collection<Update> = conn.database("mangayomi").collection("settings");
    let opts = IndexOptions::builder().unique(true).build();
    let idx = IndexModel::builder()
        .keys(doc! { "id": -1, "user": -1 })
        .options(opts)
        .build();
    match col_categories.create_index(idx.clone()).await {
        Ok(result) => log::info!("Created categories index: {}", result.index_name),
        Err(_) => log::info!("Failed to create categories index."),
    };
    match col_manga.create_index(idx.clone()).await {
        Ok(result) => log::info!("Created manga index: {}", result.index_name),
        Err(_) => log::info!("Failed to create manga index."),
    };
    match col_chapter.create_index(idx.clone()).await {
        Ok(result) => log::info!("Created chapters index: {}", result.index_name),
        Err(_) => log::info!("Failed to create chapters index."),
    };
    match col_track.create_index(idx.clone()).await {
        Ok(result) => log::info!("Created tracks index: {}", result.index_name),
        Err(_) => log::info!("Failed to create tracks index."),
    };
    match col_histories.create_index(idx.clone()).await {
        Ok(result) => log::info!("Created histories index: {}", result.index_name),
        Err(_) => log::info!("Failed to create histories index."),
    };
    match col_updates.create_index(idx.clone()).await {
        Ok(result) => log::info!("Created updates index: {}", result.index_name),
        Err(_) => log::info!("Failed to create updates index."),
    };
    match col_settings.create_index(idx.clone()).await {
        Ok(result) => log::info!("Created settings index: {}", result.index_name),
        Err(_) => log::info!("Failed to create settings index."),
    };
}
