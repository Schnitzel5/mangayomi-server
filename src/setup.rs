use crate::bootstrap::{self, BootstrapStatus, ExistingAdmin};
use crate::config;
use crate::db;
use mongodb::bson::oid::ObjectId;
use std::io::{self, Write};
use std::path::Path;

pub async fn run(path: &Path) -> Result<(), String> {
    let mut raw = config::load_raw(path)?;
    raw.database_url = Some(prompt_uri(raw.database_url.as_deref())?);
    raw.database_db = Some(prompt_default(
        "Database name",
        raw.database_db.as_deref().unwrap_or("mangayomi"),
    )?);
    raw.host = Some(prompt_default(
        "Host",
        raw.host.as_deref().unwrap_or("0.0.0.0"),
    )?);
    raw.port = Some(prompt_default(
        "Port",
        raw.port.as_deref().unwrap_or("8080"),
    )?);
    raw.session_ttl_days = Some(prompt_default(
        "Session TTL in days",
        raw.session_ttl_days.as_deref().unwrap_or("30"),
    )?);
    raw.allow_registration = Some(
        prompt_bool(
            "Allow public registration",
            raw.allow_registration
                .as_deref()
                .map(|value| matches!(value, "true" | "1" | "yes"))
                .unwrap_or(false),
        )?
        .to_string(),
    );
    let config = config::from_raw_for_setup(raw)?;

    let client = db::create_client(&config.database_url)
        .await
        .map_err(|_| "could not connect to MongoDB".to_owned())?;
    db::ping(&client)
        .await
        .map_err(|_| "could not connect to MongoDB".to_owned())?;
    let status = bootstrap::read_status(&client, &config.database_db)
        .await
        .map_err(|_| "bootstrap state is invalid".to_owned())?;

    enum BootstrapAction {
        Create { email: String, password: String },
        Adopt(ObjectId),
    }
    let action = match &status {
        BootstrapStatus::Unclaimed | BootstrapStatus::Claimed { .. }
            if bootstrap::status_requires_email(&status) =>
        {
            let claimed = match &status {
                BootstrapStatus::Claimed { email } => Some(email.as_str()),
                _ => None,
            };
            let email = prompt_email(claimed)?;
            if let Some(claimed) = claimed {
                if email != claimed {
                    return Err("bootstrap claim email does not match".to_owned());
                }
            }
            let password = loop {
                let password = prompt_password("Admin password")?;
                if password.chars().count() >= 8 {
                    break password;
                }
                println!("The admin password must be at least 8 characters.");
            };
            let confirmation = prompt_password("Confirm admin password")?;
            if password != confirmation {
                return Err("passwords do not match".to_owned());
            }
            Some(BootstrapAction::Create { email, password })
        }
        BootstrapStatus::AdoptionRequired { admins } => {
            Some(BootstrapAction::Adopt(select_existing_admin(admins)?))
        }
        BootstrapStatus::Complete => None,
        _ => return Err("invalid bootstrap state".to_owned()),
    };

    if !prompt_bool("Write configuration and finish setup", false)? {
        return Err("setup cancelled".to_owned());
    }

    if let Some(action) = action {
        bootstrap::create_user_email_index(&client, &config.database_db)
            .await
            .map_err(|_| "could not prepare user storage".to_owned())?;
        match action {
            BootstrapAction::Create { email, password } => {
                bootstrap::bootstrap_admin(&client, &config.database_db, &email, &password)
                    .await
                    .map_err(|error| format!("could not complete bootstrap: {error}"))?
            }
            BootstrapAction::Adopt(admin_id) => {
                bootstrap::adopt_admin(&client, &config.database_db, admin_id)
                    .await
                    .map_err(|error| format!("could not adopt ADMIN: {error}"))?;
            }
        }
    }
    config::write_dotenv(path, &config).map_err(|_| "could not write configuration".to_owned())
}

fn prompt_required(label: &str, default: Option<&str>) -> Result<String, String> {
    loop {
        let value = prompt_default(label, default.unwrap_or(""))?;
        if !value.trim().is_empty() {
            return Ok(value);
        }
        println!("A value is required.");
    }
}

fn prompt_uri(existing: Option<&str>) -> Result<String, String> {
    print!("MongoDB URI: ");
    io::stdout()
        .flush()
        .map_err(|_| "input failed".to_owned())?;
    let mut value = String::new();
    io::stdin()
        .read_line(&mut value)
        .map_err(|_| "input cancelled".to_owned())?;
    let value = value.trim_end_matches(['\r', '\n']);
    if value.trim().is_empty() {
        existing
            .filter(|value| !value.trim().is_empty())
            .map(str::to_owned)
            .ok_or_else(|| "a MongoDB URI is required".to_owned())
    } else {
        Ok(value.to_owned())
    }
}

fn prompt_email(default: Option<&str>) -> Result<String, String> {
    loop {
        let email = prompt_required("Admin email", default)?;
        if config::valid_email(&email) {
            return Ok(email);
        }
        println!("Please enter a valid email address.");
    }
}

fn select_existing_admin(admins: &[ExistingAdmin]) -> Result<ObjectId, String> {
    println!("Existing ADMIN accounts were found. Select one to adopt:");
    for (index, admin) in admins.iter().enumerate() {
        println!("  {}. {}", index + 1, admin.email);
    }
    loop {
        let value = prompt_required("ADMIN number", None)?;
        let Ok(number) = value.parse::<usize>() else {
            println!("Please select one of the listed accounts.");
            continue;
        };
        let Some(admin) = admins.get(number.saturating_sub(1)) else {
            println!("Please select one of the listed accounts.");
            continue;
        };
        if prompt_bool(&format!("Adopt {}", admin.email), false)? {
            return Ok(admin.id);
        }
        println!("No account was adopted; select an account again.");
    }
}

fn prompt_default(label: &str, default: &str) -> Result<String, String> {
    print!("{label} [{default}]: ");
    io::stdout()
        .flush()
        .map_err(|_| "input failed".to_owned())?;
    let mut value = String::new();
    io::stdin()
        .read_line(&mut value)
        .map_err(|_| "input cancelled".to_owned())?;
    let value = value.trim_end_matches(['\r', '\n']);
    if value.is_empty() {
        Ok(default.to_owned())
    } else {
        Ok(value.to_owned())
    }
}

fn prompt_password(label: &str) -> Result<String, String> {
    rpassword::prompt_password(format!("{label}: "))
        .map_err(|_| "password input cancelled".to_owned())
}

fn prompt_bool(label: &str, default: bool) -> Result<bool, String> {
    loop {
        let value = prompt_default(label, if default { "Y/n" } else { "y/N" })?;
        match value.trim().to_ascii_lowercase().as_str() {
            "y" | "yes" | "true" | "1" => return Ok(true),
            "n" | "no" | "false" | "0" => return Ok(false),
            _ => println!("Please answer yes or no."),
        }
    }
}
