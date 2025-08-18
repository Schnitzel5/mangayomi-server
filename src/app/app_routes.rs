use actix_web::{web, Scope};
use crate::app::{controller, preferences};

pub fn basic_controller() -> Scope {
    web::scope("/app")
        .service(controller::frontend)
        .service(preferences::controller::frontend)
}
