use crate::user::model::{BasicUser, Role, UpdateUser, User};
use argon2::Argon2;
use mongodb::Client;
use mongodb::bson::doc;
use mongodb::bson::oid::ObjectId;
use password_hash::rand_core::OsRng;
use password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug)]
pub enum CreateUserError {
    Duplicate,
    Database(mongodb::error::Error),
    PasswordHash,
}

impl fmt::Display for CreateUserError {
    fn fmt(&self, output: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Duplicate => output.write_str("email already exists"),
            Self::Database(_) => output.write_str("database operation failed"),
            Self::PasswordHash => output.write_str("password policy rejected"),
        }
    }
}

impl std::error::Error for CreateUserError {}

impl From<mongodb::error::Error> for CreateUserError {
    fn from(error: mongodb::error::Error) -> Self {
        Self::Database(error)
    }
}

fn get_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

pub async fn create_account(
    db: &Client,
    database: &str,
    email: &str,
    password: &str,
    role: &str,
) -> Result<User, CreateUserError> {
    if password.chars().count() < 8 {
        return Err(CreateUserError::PasswordHash);
    }
    let salt = SaltString::generate(&mut OsRng);
    let password_hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|_| CreateUserError::PasswordHash)?
        .to_string();
    let account = User {
        id: Some(ObjectId::new()),
        email: email.to_owned(),
        password: password_hash,
        salt: salt.to_string(),
        role: role.to_owned(),
        created_at: get_timestamp(),
        updated_at: get_timestamp(),
    };
    let collection = db.database(database).collection::<User>("users");
    match collection.insert_one(&account).await {
        Ok(_) => Ok(account),
        Err(error)
            if error.to_string().contains("11000")
                || error
                    .to_string()
                    .to_ascii_lowercase()
                    .contains("duplicate key") =>
        {
            Err(CreateUserError::Duplicate)
        }
        Err(error) => Err(CreateUserError::Database(error)),
    }
}

pub async fn register_account(
    db: &Client,
    database: &str,
    user: &BasicUser,
) -> Result<User, CreateUserError> {
    create_account(db, database, &user.email, &user.password, Role::BASIC).await
}

pub async fn login_account(db: &Client, database: &str, user: &BasicUser) -> Option<User> {
    let account = find_account(&user.email, db, database).await?;
    let hash = PasswordHash::new(&account.password).ok()?;
    Argon2::default()
        .verify_password(user.password.as_bytes(), &hash)
        .ok()
        .map(|_| account)
}

pub async fn update_account(
    db: &Client,
    database: &str,
    user_id: ObjectId,
    data: &UpdateUser,
) -> bool {
    let existing = find_account(&data.email, db, database).await;
    if existing
        .as_ref()
        .is_some_and(|user| user.id != Some(user_id))
    {
        return false;
    }
    let Some(account) = find_account_by_id(db, database, user_id).await else {
        return false;
    };
    let Ok(hash) = PasswordHash::new(&account.password) else {
        return false;
    };
    // Even an email-only mutation must prove knowledge of the current password.
    if data.password_old.chars().count() < 8
        || Argon2::default()
            .verify_password(data.password_old.as_bytes(), &hash)
            .is_err()
    {
        return false;
    }
    let replace_password = !data.password.is_empty();
    if replace_password && data.password.chars().count() < 8 {
        return false;
    }
    let mut updates = doc! {
        "email": &data.email,
        "updated_at": get_timestamp(),
    };
    if replace_password {
        let salt = SaltString::generate(&mut OsRng);
        let Ok(password_hash) = Argon2::default().hash_password(data.password.as_bytes(), &salt)
        else {
            return false;
        };
        updates.insert("salt", salt.to_string());
        updates.insert("password", password_hash.to_string());
    }
    let collection = db.database(database).collection::<User>("users");
    collection
        .update_one(doc! { "_id": user_id }, doc! { "$set": updates })
        .await
        .is_ok()
}

pub async fn delete_account(db: &Client, database: &str, user_id: ObjectId) -> bool {
    let Some(account) = find_account_by_id(db, database, user_id).await else {
        return false;
    };
    if account.is_admin() {
        return false;
    }
    let col_users = db.database(database).collection::<User>("users");
    let collections = [
        ("categories", false),
        ("manga", false),
        ("chapters", false),
        ("tracks", false),
        ("histories", false),
        ("updates", false),
        ("settings", false),
    ];
    for (name, _) in collections {
        let collection = db
            .database(database)
            .collection::<mongodb::bson::Document>(name);
        if let Err(error) = collection.delete_many(doc! { "user": user_id }).await {
            log::error!("failed to delete user data: {error}");
        }
    }
    col_users
        .delete_one(doc! { "_id": user_id })
        .await
        .map(|result| result.deleted_count == 1)
        .unwrap_or(false)
}

pub async fn find_account_by_id(db: &Client, database: &str, id: ObjectId) -> Option<User> {
    db.database(database)
        .collection::<User>("users")
        .find_one(doc! { "_id": id })
        .await
        .ok()
        .flatten()
}

async fn find_account(email: &str, db: &Client, database: &str) -> Option<User> {
    db.database(database)
        .collection::<User>("users")
        .find_one(doc! { "email": email })
        .await
        .ok()
        .flatten()
}
