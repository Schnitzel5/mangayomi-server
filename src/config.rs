use std::collections::HashMap;
use std::env;
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use actix_web::cookie::Key;
use password_hash::rand_core::{OsRng, RngCore};
use regex::Regex;
use tempfile::NamedTempFile;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub database_db: String,
    pub host: String,
    pub port: u16,
    pub session_ttl_days: i64,
    pub allow_registration: bool,
    pub secret_key: [u8; 64],
}

impl Config {
    pub fn cookie_key(&self) -> Key {
        Key::from(&self.secret_key)
    }
}

#[derive(Clone, Debug, Default)]
pub struct RawConfig {
    pub database_url: Option<String>,
    pub database_db: Option<String>,
    pub host: Option<String>,
    pub port: Option<String>,
    pub session_ttl_days: Option<String>,
    pub allow_registration: Option<String>,
    pub secret_key: Option<String>,
}

pub fn default_path(path: Option<PathBuf>) -> PathBuf {
    path.unwrap_or_else(|| PathBuf::from(".env"))
}

pub fn load_raw(path: &Path) -> Result<RawConfig, String> {
    let mut values = HashMap::new();
    if path.exists() {
        let entries = dotenvy::from_path_iter(path).map_err(|_| "invalid config file")?;
        for entry in entries {
            let (key, value) = entry.map_err(|_| "invalid config file")?;
            values.insert(key, value);
        }
    }

    // dotenv values are defaults; an actual process environment always wins.
    for key in [
        "DATABASE_URL",
        "DATABASE_DB",
        "HOST",
        "PORT",
        "SESSION_TTL_DAYS",
        "ALLOW_REGISTRATION",
        "SECRET_KEY",
    ] {
        if let Ok(value) = env::var(key) {
            values.insert(key.to_owned(), value);
        }
    }

    Ok(RawConfig {
        database_url: values.remove("DATABASE_URL"),
        database_db: values.remove("DATABASE_DB"),
        host: values.remove("HOST"),
        port: values.remove("PORT"),
        session_ttl_days: values.remove("SESSION_TTL_DAYS"),
        allow_registration: values.remove("ALLOW_REGISTRATION"),
        secret_key: values.remove("SECRET_KEY"),
    })
}

pub fn from_raw(raw: RawConfig, require_database_url: bool) -> Result<Config, String> {
    from_raw_with_secret(raw, require_database_url, false)
}

pub fn from_raw_for_setup(raw: RawConfig) -> Result<Config, String> {
    from_raw_with_secret(raw, true, true)
}

fn from_raw_with_secret(
    raw: RawConfig,
    require_database_url: bool,
    generate_missing_secret: bool,
) -> Result<Config, String> {
    let database_url = match raw.database_url {
        Some(value) if !value.trim().is_empty() => value,
        _ if require_database_url => return Err("DATABASE_URL is required".to_owned()),
        _ => String::new(),
    };
    let database_db = raw.database_db.unwrap_or_else(|| "mangayomi".to_owned());
    if database_db.trim().is_empty() {
        return Err("DATABASE_DB must not be empty".to_owned());
    }
    let host = raw.host.unwrap_or_else(|| "0.0.0.0".to_owned());
    let port = parse_port(raw.port.as_deref().unwrap_or("8080"))?;
    let session_ttl_days = raw
        .session_ttl_days
        .as_deref()
        .unwrap_or("30")
        .parse::<i64>()
        .map_err(|_| "SESSION_TTL_DAYS must be a positive integer".to_owned())?;
    if session_ttl_days <= 0 {
        return Err("SESSION_TTL_DAYS must be a positive integer".to_owned());
    }
    let allow_registration = parse_bool(raw.allow_registration.as_deref().unwrap_or("false"))?;
    let secret_key = match raw.secret_key {
        Some(value) => parse_secret(&value)?,
        None if generate_missing_secret => generate_secret(),
        None => return Err("SECRET_KEY is required; run setup".to_owned()),
    };

    Ok(Config {
        database_url,
        database_db,
        host,
        port,
        session_ttl_days,
        allow_registration,
        secret_key,
    })
}

fn parse_port(value: &str) -> Result<u16, String> {
    let port = value
        .parse::<u16>()
        .map_err(|_| "PORT must be between 1 and 65535".to_owned())?;
    if port == 0 {
        return Err("PORT must be between 1 and 65535".to_owned());
    }
    Ok(port)
}

fn parse_bool(value: &str) -> Result<bool, String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "true" | "1" | "yes" => Ok(true),
        "false" | "0" | "no" => Ok(false),
        _ => Err("ALLOW_REGISTRATION must be true or false".to_owned()),
    }
}

fn parse_secret(value: &str) -> Result<[u8; 64], String> {
    let bytes = value.as_bytes();
    if bytes.len() == 128 && bytes.iter().all(u8::is_ascii_hexdigit) {
        let mut secret = [0; 64];
        for (index, pair) in bytes.chunks_exact(2).enumerate() {
            let text = std::str::from_utf8(pair).map_err(|_| "invalid SECRET_KEY".to_owned())?;
            secret[index] =
                u8::from_str_radix(text, 16).map_err(|_| "invalid SECRET_KEY".to_owned())?;
        }
        return Ok(secret);
    }
    // Older releases passed the UTF-8 bytes directly to `cookie::Key::from`.
    // That API accepts longer material but consumes only its first 64 bytes.
    if bytes.len() >= 64 {
        let mut secret = [0; 64];
        secret.copy_from_slice(&bytes[..64]);
        return Ok(secret);
    }
    Err("SECRET_KEY must contain 64 bytes".to_owned())
}

pub fn generate_secret() -> [u8; 64] {
    let mut secret = [0; 64];
    OsRng.fill_bytes(&mut secret);
    secret
}

pub fn secret_string(secret: &[u8; 64]) -> String {
    secret.iter().map(|byte| format!("{byte:02x}")).collect()
}

pub fn valid_email(email: &str) -> bool {
    Regex::new(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
        .map(|regex| regex.is_match(email))
        .unwrap_or(false)
}

pub fn write_dotenv(path: &Path, config: &Config) -> io::Result<()> {
    let original = match fs::read_to_string(path) {
        Ok(content) => content,
        Err(error) if error.kind() == io::ErrorKind::NotFound => String::new(),
        Err(error) => return Err(error),
    };
    let updates = [
        ("DATABASE_URL", config.database_url.clone()),
        ("DATABASE_DB", config.database_db.clone()),
        ("HOST", config.host.clone()),
        ("PORT", config.port.to_string()),
        ("SESSION_TTL_DAYS", config.session_ttl_days.to_string()),
        ("ALLOW_REGISTRATION", config.allow_registration.to_string()),
        ("SECRET_KEY", secret_string(&config.secret_key)),
    ];
    let content = update_dotenv_content(&original, &updates);
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    let mut temporary = NamedTempFile::new_in(parent)?;
    temporary.write_all(content.as_bytes())?;
    temporary.as_file().sync_all()?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(temporary.path(), fs::Permissions::from_mode(0o600))?;
    }
    temporary.persist(path).map_err(|error| error.error)?;
    Ok(())
}

fn update_dotenv_content(original: &str, updates: &[(&str, String)]) -> String {
    let mut found = HashMap::new();
    let mut lines = Vec::new();
    for line in original.lines() {
        let key = line.split_once('=').map(|(key, _)| key.trim());
        if let Some(key) = key {
            if let Some((_, value)) = updates.iter().find(|(name, _)| *name == key) {
                lines.push(format!("{key}={value}"));
                found.insert(key, true);
                continue;
            }
        }
        lines.push(line.to_owned());
    }
    for (key, value) in updates {
        if !found.contains_key(key) {
            lines.push(format!("{key}={value}"));
        }
    }
    let mut result = lines.join("\n");
    result.push('\n');
    result
}

#[cfg(test)]
mod tests {
    use super::{RawConfig, from_raw_for_setup, parse_secret, update_dotenv_content, valid_email};
    use tempfile::tempdir;

    #[test]
    fn defaults_and_environment_values_are_validated() {
        let config = from_raw_for_setup(RawConfig {
            database_url: Some("mongodb://localhost".to_owned()),
            ..RawConfig::default()
        })
        .expect("valid defaults");
        assert_eq!(config.database_db, "mangayomi");
        assert_eq!(config.port, 8080);
        assert_eq!(config.session_ttl_days, 30);
        assert!(!config.allow_registration);
    }

    #[test]
    fn validates_email_and_preserves_valid_secret() {
        assert!(valid_email("admin@example.com"));
        assert!(!valid_email("not-an-email"));
        let secret = "a".repeat(64);
        assert_eq!(parse_secret(&secret).expect("valid secret"), [b'a'; 64]);

        let generated = "ab".repeat(64);
        assert_eq!(parse_secret(&generated).expect("hex secret"), [0xab; 64]);
    }

    #[test]
    fn accepts_legacy_long_raw_secret_using_cookie_key_prefix() {
        let legacy = "A".repeat(88);
        assert_eq!(parse_secret(&legacy).expect("legacy secret"), [b'A'; 64]);
        assert!(parse_secret(&"short".repeat(12)).is_err());
    }

    #[test]
    fn dotenv_updates_are_deterministic_without_exposing_extra_values() {
        let output = update_dotenv_content(
            "# keep me\nPORT=1\nOTHER=value\n",
            &[
                ("PORT", "8080".to_owned()),
                ("HOST", "127.0.0.1".to_owned()),
            ],
        );
        assert!(output.contains("# keep me"));
        assert!(output.contains("PORT=8080"));
        assert!(output.contains("OTHER=value"));
        assert!(output.contains("HOST=127.0.0.1"));
    }

    #[test]
    fn dotenv_read_failures_are_not_treated_as_empty_files() {
        let directory = tempdir().expect("temporary directory");
        let config = from_raw_for_setup(RawConfig {
            database_url: Some("mongodb://localhost".to_owned()),
            ..RawConfig::default()
        })
        .expect("valid defaults");
        let error = super::write_dotenv(directory.path(), &config)
            .expect_err("reading a directory must fail");
        assert_ne!(error.kind(), std::io::ErrorKind::NotFound);
    }
}
