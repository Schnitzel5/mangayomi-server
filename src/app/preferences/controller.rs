use actix_files::NamedFile;
use actix_web::get;
use std::io;

#[get("/")]
async fn frontend() -> io::Result<NamedFile> {
    Ok(NamedFile::open("./frontend/build/index.html")?)
}
