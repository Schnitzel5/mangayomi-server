use actix_files::NamedFile;
use actix_web::{Responder, get};

#[get("/home")]
async fn home() -> impl Responder {
    NamedFile::open_async("./frontend/dist/browser/index.html").await
}
