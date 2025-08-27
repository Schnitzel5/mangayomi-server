use actix_web::web::Redirect;
use actix_web::{Scope, web};

pub fn basic_controller() -> Scope {
    web::scope("/web").default_service(web::to(|| async { Redirect::to("/") }))
}
