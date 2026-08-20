use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};
use validator::Validate;

pub struct Role;

impl Role {
    pub const ADMIN: &'static str = "ADMIN";
    pub const BASIC: &'static str = "BASIC";

    pub fn is_admin(value: &str) -> bool {
        value == Self::ADMIN
    }
}

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

impl User {
    pub fn is_admin(&self) -> bool {
        Role::is_admin(&self.role)
    }
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

#[cfg(test)]
mod tests {
    use super::{Role, User};

    #[test]
    fn role_predicate_accepts_only_admin_role() {
        assert!(Role::is_admin(Role::ADMIN));
        assert!(!Role::is_admin(Role::BASIC));
        assert!(!Role::is_admin("admin"));
    }

    #[test]
    fn user_admin_predicate_is_based_on_stored_role() {
        let user = User {
            id: None,
            email: "admin@example.com".to_owned(),
            password: "hash".to_owned(),
            salt: "salt".to_owned(),
            role: Role::ADMIN.to_owned(),
            created_at: 0,
            updated_at: 0,
        };
        assert!(user.is_admin());
    }
}
