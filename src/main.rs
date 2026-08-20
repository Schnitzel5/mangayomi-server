use actix_governor::governor::middleware::NoOpMiddleware;
use actix_governor::{Governor, GovernorConfig, GovernorConfigBuilder, PeerIpKeyExtractor};
use actix_identity::IdentityMiddleware;
use actix_session::SessionMiddleware;
use actix_session::config::{CookieContentSecurity, PersistentSession, TtlExtensionPolicy};
use actix_session::storage::CookieSessionStore;
use actix_web::cookie::SameSite;
use actix_web::cookie::time::Duration as CookieDuration;
use actix_web::middleware::{Logger, NormalizePath};
use actix_web::{App, HttpResponse, HttpServer, Scope, web};
use clap::{Parser, Subcommand};
use mongodb::bson::doc;
use mongodb::options::IndexOptions;
use mongodb::{Client, IndexModel};
use std::fs;
use std::io;
use std::path::PathBuf;
use tera::Tera;
use walkdir::WalkDir;

mod app;
mod bootstrap;
mod config;
mod db;
mod setup;
mod sync;
mod update;
mod user;

#[derive(Debug, Parser)]
#[command(name = "mangayomi-server")]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Debug, Subcommand)]
enum Command {
    Serve {
        #[arg(long)]
        config: Option<PathBuf>,
    },
    Setup {
        #[arg(long)]
        config: Option<PathBuf>,
    },
}

#[actix_web::main]
async fn main() -> io::Result<()> {
    let command = Cli::parse()
        .command
        .unwrap_or(Command::Serve { config: None });
    match command {
        Command::Serve { config } => serve(config).await,
        Command::Setup { config } => setup::run(&config::default_path(config))
            .await
            .map_err(|_| io::Error::other("setup failed")),
    }
}

async fn serve(path: Option<PathBuf>) -> io::Result<()> {
    let path = config::default_path(path);
    let raw = config::load_raw(&path).map_err(|_| io::Error::other("invalid configuration"))?;
    let config =
        config::from_raw(raw, true).map_err(|_| io::Error::other("invalid configuration"))?;
    let client = db::create_client(&config.database_url)
        .await
        .map_err(|_| io::Error::other("could not connect to MongoDB"))?;
    db::ping(&client)
        .await
        .map_err(|_| io::Error::other("could not connect to MongoDB"))?;
    init_db_indexes(&client, &config.database_db)
        .await
        .map_err(|_| io::Error::other("could not initialize MongoDB"))?;
    bootstrap::validate_complete_state(&client, &config.database_db)
        .await
        .map_err(|_| io::Error::other("bootstrap is incomplete; run setup"))?;

    unsafe { std::env::set_var("RUST_LOG", "debug") };
    env_logger::init();
    if config.check_for_updates {
        tokio::spawn(update::check_for_update());
    }
    let tera = initialize_tera()?;
    let live_sync_hub = web::Data::new(sync::live::LiveSyncHub::default());
    let database = config.database_db.clone();
    let host = config.host.clone();
    let port = config.port;
    let session_ttl = config.session_ttl_days;
    let secret_key = config.cookie_key();
    let config_data = web::Data::new(config);
    let client_data = web::Data::new(client);

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
                            .session_ttl(CookieDuration::days(session_ttl))
                            .session_ttl_extension_policy(TtlExtensionPolicy::OnEveryRequest),
                    )
                    .cookie_secure(true)
                    .cookie_same_site(SameSite::Strict)
                    .cookie_content_security(CookieContentSecurity::Private)
                    .cookie_http_only(true)
                    .build(),
            )
            .app_data(client_data.clone())
            .app_data(config_data.clone())
            .app_data(web::Data::new(tera.clone()))
            .app_data(web::Data::new(database.clone()))
            .app_data(live_sync_hub.clone())
            .service(actix_files::Files::new("/assets", "./resources/assets"))
            .service(actix_files::Files::new(
                "/static",
                "./frontend/dist/browser",
            ))
            .service(user::controller::profile)
            .service(user::controller::delete)
            .service(user::controller::register)
            .service(user::controller::admin_users)
            .service(user::controller::login)
            .service(user::controller::logout)
            .service(user::controller::home)
            .service(sync_controller())
            .service(app::app_routes::basic_controller())
            .default_service(web::to(|| HttpResponse::NotFound()))
    })
    .bind((host, port))?
    .run()
    .await
}

fn initialize_tera() -> io::Result<Tera> {
    let mut tera = Tera::default();
    tera.add_raw_templates(get_templates())
        .map_err(|_| io::Error::other("template initialization failed"))?;
    tera.autoescape_on(vec![".html"]);
    Ok(tera)
}

fn sync_controller() -> Scope {
    web::scope("/sync")
        .app_data(web::JsonConfig::default().limit(250 << 20))
        .service(sync::live::controller::live_sync)
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
        .expect("static rate limiter configuration")
}

fn get_templates() -> Vec<(String, String)> {
    let mut templates = Vec::new();
    for file in WalkDir::new("./resources/templates")
        .into_iter()
        .filter_map(Result::ok)
    {
        if file
            .metadata()
            .map(|metadata| metadata.is_file())
            .unwrap_or(false)
        {
            let Some(template_name) = file.path().file_name().and_then(|name| name.to_str()) else {
                continue;
            };
            if let Ok(template_raw) = fs::read_to_string(file.path()) {
                templates.push((template_name.to_owned(), template_raw));
            }
        }
    }
    templates
}

async fn init_db_indexes(client: &Client, database: &str) -> mongodb::error::Result<()> {
    bootstrap::create_user_email_index(client, database).await?;
    let sync_idx = IndexModel::builder()
        .keys(doc! { "user": 1, "id": 1 })
        .options(
            IndexOptions::builder()
                .name("sync_user_id".to_owned())
                .unique(true)
                .build(),
        )
        .build();
    for coll in [
        "categories",
        "manga",
        "chapters",
        "tracks",
        "histories",
        "updates",
        "settings",
    ] {
        let collection = client
            .database(database)
            .collection::<mongodb::bson::Document>(coll);
        collection.create_index(sync_idx.clone()).await?;
        let _ = collection.drop_index("id_-1_user_-1").await;
    }
    let tombstone_idx = IndexModel::builder()
        .keys(doc! { "user": -1, "coll": -1, "id": -1 })
        .options(IndexOptions::builder().unique(true).build())
        .build();
    client
        .database(database)
        .collection::<mongodb::bson::Document>(sync::common::TOMBSTONES)
        .create_index(tombstone_idx)
        .await?;
    Ok(())
}
