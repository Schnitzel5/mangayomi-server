use std::io;
use actix_files::NamedFile;
use actix_web::{get};

#[get("/")]
async fn frontend() -> io::Result<NamedFile> {
    Ok(NamedFile::open("./frontend/build/index.html")?)
}
