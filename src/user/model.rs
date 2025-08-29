use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct User {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub email: String,
    pub password: String,
    pub salt: String,
    pub role: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct Backup {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub backup_path: String,
    pub user: Option<ObjectId>,
    pub created_at: i64,
}

#[derive(Deserialize, Validate)]
pub struct BasicUser {
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 8, message = "Password must be at least 8 characters long!"))]
    pub(crate) password: String,
}

#[derive(Deserialize, Validate)]
pub struct UpdateUser {
    #[validate(email)]
    pub email: String,
    pub(crate) password: String,
    #[serde(rename = "passwordOld")]
    pub(crate) password_old: String,
}
