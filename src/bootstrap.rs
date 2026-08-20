use crate::user::model::{Role, User};
use crate::user::service::{CreateUserError, create_account, find_account_by_id};
use futures::TryStreamExt;
use mongodb::bson::doc;
use mongodb::bson::oid::ObjectId;
use mongodb::{Client, Collection, IndexModel};
use serde::{Deserialize, Serialize};
use std::fmt;

const MARKER_ID: &str = "singleton";
const MARKER_COLLECTION: &str = "bootstrap";

#[derive(Clone, Debug, Deserialize, Serialize)]
struct BootstrapMarker {
    #[serde(rename = "_id")]
    id: String,
    state: String,
    claimed_email: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    admin_id: Option<ObjectId>,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum BootstrapStatus {
    Unclaimed,
    Claimed { email: String },
    AdoptionRequired { admins: Vec<ExistingAdmin> },
    Complete,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ExistingAdmin {
    pub id: ObjectId,
    pub email: String,
}

#[derive(Debug)]
pub enum BootstrapError {
    Database,
    Invalid(&'static str),
    User(CreateUserError),
}

impl fmt::Display for BootstrapError {
    fn fmt(&self, output: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Database => output.write_str("database operation failed"),
            Self::Invalid(message) => output.write_str(message),
            Self::User(error) => write!(output, "user operation failed: {error}"),
        }
    }
}

impl std::error::Error for BootstrapError {}

impl From<mongodb::error::Error> for BootstrapError {
    fn from(_: mongodb::error::Error) -> Self {
        Self::Database
    }
}

impl From<CreateUserError> for BootstrapError {
    fn from(error: CreateUserError) -> Self {
        Self::User(error)
    }
}

fn marker_collection(client: &Client, database: &str) -> Collection<BootstrapMarker> {
    client.database(database).collection(MARKER_COLLECTION)
}

fn users(client: &Client, database: &str) -> Collection<User> {
    client.database(database).collection("users")
}

pub async fn create_user_email_index(
    client: &Client,
    database: &str,
) -> mongodb::error::Result<()> {
    users(client, database)
        .create_index(
            IndexModel::builder()
                .keys(doc! { "email": 1 })
                .options(
                    mongodb::options::IndexOptions::builder()
                        .name("user_email_unique".to_owned())
                        .unique(true)
                        .build(),
                )
                .build(),
        )
        .await
        .map(|_| ())
}

pub async fn read_status(
    client: &Client,
    database: &str,
) -> Result<BootstrapStatus, BootstrapError> {
    let marker = marker_collection(client, database)
        .find_one(doc! { "_id": MARKER_ID })
        .await?;
    match marker {
        None => {
            let admins = existing_admins(client, database).await?;
            if !admins.is_empty() {
                return Ok(BootstrapStatus::AdoptionRequired { admins });
            }
            Ok(BootstrapStatus::Unclaimed)
        }
        Some(marker) if marker.state == "claimed" => {
            if marker.claimed_email.trim().is_empty() {
                return Err(BootstrapError::Invalid(
                    "bootstrap marker has no claimed email",
                ));
            }
            Ok(BootstrapStatus::Claimed {
                email: marker.claimed_email,
            })
        }
        Some(marker) if marker.state == "complete" => {
            validate_complete(client, database, &marker).await?;
            Ok(BootstrapStatus::Complete)
        }
        Some(_) => Err(BootstrapError::Invalid("invalid bootstrap marker state")),
    }
}

pub async fn validate_complete_state(
    client: &Client,
    database: &str,
) -> Result<(), BootstrapError> {
    let marker = marker_collection(client, database)
        .find_one(doc! { "_id": MARKER_ID })
        .await?
        .ok_or(BootstrapError::Invalid(
            "bootstrap is incomplete; run setup",
        ))?;
    if marker.state != "complete" {
        return Err(BootstrapError::Invalid(
            "bootstrap is incomplete; run setup",
        ));
    }
    validate_complete(client, database, &marker).await
}

async fn validate_complete(
    client: &Client,
    database: &str,
    marker: &BootstrapMarker,
) -> Result<(), BootstrapError> {
    let admin_id = marker
        .admin_id
        .ok_or(BootstrapError::Invalid("completed bootstrap has no admin"))?;
    let admin = find_account_by_id(client, database, admin_id)
        .await
        .ok_or(BootstrapError::Invalid("bootstrap admin is missing"))?;
    if !completed_admin_reference_is_valid(marker.admin_id, admin.id, admin.is_admin()) {
        return Err(BootstrapError::Invalid("bootstrap admin is invalid"));
    }
    Ok(())
}

pub fn completed_admin_reference_is_valid(
    marker_admin_id: Option<ObjectId>,
    user_id: Option<ObjectId>,
    is_admin: bool,
) -> bool {
    is_admin && marker_admin_id.is_some() && marker_admin_id == user_id
}

async fn existing_admins(
    client: &Client,
    database: &str,
) -> mongodb::error::Result<Vec<ExistingAdmin>> {
    let admins = users(client, database)
        .find(doc! { "role": Role::ADMIN })
        .await?
        .try_collect::<Vec<_>>()
        .await?;
    admins
        .into_iter()
        .map(|admin| {
            admin
                .id
                .map(|id| ExistingAdmin {
                    id,
                    email: admin.email,
                })
                .ok_or_else(|| mongodb::error::Error::custom("ADMIN user has no immutable id"))
        })
        .collect()
}

async fn admin_count(client: &Client, database: &str) -> mongodb::error::Result<u64> {
    users(client, database)
        .count_documents(doc! { "role": Role::ADMIN })
        .await
}

pub async fn bootstrap_admin(
    client: &Client,
    database: &str,
    email: &str,
    password: &str,
) -> Result<(), BootstrapError> {
    let marker = marker_collection(client, database)
        .find_one(doc! { "_id": MARKER_ID })
        .await?;
    let marker = match marker {
        Some(marker) => marker,
        None => {
            if admin_count(client, database).await? != 0 {
                return Err(BootstrapError::Invalid(
                    "ADMIN exists without bootstrap marker",
                ));
            }
            if users(client, database)
                .find_one(doc! { "email": email })
                .await?
                .is_some()
            {
                return Err(BootstrapError::Invalid(
                    "claimed email already belongs to a user",
                ));
            }
            let marker = BootstrapMarker {
                id: MARKER_ID.to_owned(),
                state: "claimed".to_owned(),
                claimed_email: email.to_owned(),
                admin_id: None,
            };
            marker_collection(client, database)
                .insert_one(marker.clone())
                .await?;
            marker
        }
    };

    if marker.state == "complete" {
        validate_complete(client, database, &marker).await?;
        return Ok(());
    }
    if marker.state != "claimed" || marker.claimed_email != email {
        return Err(BootstrapError::Invalid("bootstrap claim does not match"));
    }

    let current_admin_count = admin_count(client, database).await?;
    let existing = users(client, database)
        .find_one(doc! { "email": email })
        .await?;
    let admin = match existing {
        Some(user) if user.is_admin() && current_admin_count == 1 => user,
        Some(user) if user.is_admin() => {
            return Err(BootstrapError::Invalid(
                "claimed bootstrap has conflicting ADMIN users",
            ));
        }
        Some(_) => {
            return Err(BootstrapError::Invalid(
                "claimed email belongs to a non-ADMIN user",
            ));
        }
        None if current_admin_count != 0 => {
            return Err(BootstrapError::Invalid(
                "claimed bootstrap has an existing ADMIN",
            ));
        }
        None => create_account(client, database, email, password, Role::ADMIN).await?,
    };
    if admin_count(client, database).await? != 1 {
        return Err(BootstrapError::Invalid(
            "bootstrap must have exactly one ADMIN",
        ));
    }
    marker_collection(client, database)
        .update_one(
            doc! { "_id": MARKER_ID, "state": "claimed", "claimed_email": email },
            doc! { "$set": { "state": "complete", "admin_id": admin.id } },
        )
        .await?;
    validate_complete_state(client, database).await
}

pub async fn adopt_admin(
    client: &Client,
    database: &str,
    admin_id: ObjectId,
) -> Result<(), BootstrapError> {
    if marker_collection(client, database)
        .find_one(doc! { "_id": MARKER_ID })
        .await?
        .is_some()
    {
        return Err(BootstrapError::Invalid("bootstrap marker already exists"));
    }
    let admin = find_account_by_id(client, database, admin_id)
        .await
        .ok_or(BootstrapError::Invalid("selected ADMIN user is missing"))?;
    if !completed_admin_reference_is_valid(Some(admin_id), admin.id, admin.is_admin()) {
        return Err(BootstrapError::Invalid("selected user is not an ADMIN"));
    }
    marker_collection(client, database)
        .insert_one(BootstrapMarker {
            id: MARKER_ID.to_owned(),
            state: "complete".to_owned(),
            // This field is only consulted while state is claimed.  Keep a
            // useful snapshot for operators, but never use it for validation.
            claimed_email: admin.email,
            admin_id: Some(admin_id),
        })
        .await?;
    validate_complete_state(client, database).await
}

pub fn status_requires_email(status: &BootstrapStatus) -> bool {
    matches!(
        status,
        BootstrapStatus::Unclaimed | BootstrapStatus::Claimed { .. }
    )
}

#[cfg(test)]
mod tests {
    use super::{BootstrapStatus, completed_admin_reference_is_valid, status_requires_email};
    use mongodb::bson::oid::ObjectId;

    #[test]
    fn only_uncompleted_states_require_bootstrap_credentials() {
        assert!(status_requires_email(&BootstrapStatus::Unclaimed));
        assert!(status_requires_email(&BootstrapStatus::Claimed {
            email: "admin@example.com".to_owned()
        }));
        assert!(!status_requires_email(&BootstrapStatus::AdoptionRequired {
            admins: Vec::new()
        }));
        assert!(!status_requires_email(&BootstrapStatus::Complete));
    }

    #[test]
    fn completed_marker_uses_only_immutable_admin_id_and_role() {
        let id = ObjectId::new();
        assert!(completed_admin_reference_is_valid(Some(id), Some(id), true));
        assert!(!completed_admin_reference_is_valid(
            Some(id),
            Some(id),
            false
        ));
        assert!(!completed_admin_reference_is_valid(
            Some(id),
            Some(ObjectId::new()),
            true
        ));
        assert!(!completed_admin_reference_is_valid(None, Some(id), true));
    }
}
