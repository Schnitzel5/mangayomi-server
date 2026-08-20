use reqwest::header::{ACCEPT, HeaderMap, HeaderValue, USER_AGENT};
use semver::Version;
use serde::Deserialize;
use std::time::Duration;

const RELEASES_URL: &str =
    "https://api.github.com/repos/Schnitzel5/mangayomi-server/releases/latest";
const GITHUB_API_VERSION: &str = "2022-11-28";

#[derive(Debug, Deserialize)]
struct LatestRelease {
    tag_name: String,
    html_url: String,
}

pub async fn check_for_update() {
    if let Err(error) = check_for_update_inner().await {
        log::debug!("release update check failed: {error}");
    }
}

async fn check_for_update_inner() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut headers = HeaderMap::new();
    headers.insert(
        ACCEPT,
        HeaderValue::from_static("application/vnd.github+json"),
    );
    headers.insert(
        "X-GitHub-Api-Version",
        HeaderValue::from_static(GITHUB_API_VERSION),
    );
    headers.insert(
        USER_AGENT,
        HeaderValue::from_static(concat!("mangayomi-server/", env!("CARGO_PKG_VERSION"))),
    );
    let client = reqwest::Client::builder()
        .default_headers(headers)
        .timeout(Duration::from_secs(5))
        .build()?;
    let release = client
        .get(RELEASES_URL)
        .send()
        .await?
        .error_for_status()?
        .json::<LatestRelease>()
        .await?;
    let current = Version::parse(env!("CARGO_PKG_VERSION"))?;
    if should_notify(&current, &release.tag_name) {
        log::info!(
            "A newer Mangayomi server release is available: {} ({})",
            release.tag_name,
            release.html_url
        );
    }
    Ok(())
}

fn release_version(tag: &str) -> Option<Version> {
    let version = tag
        .strip_prefix('v')
        .or_else(|| tag.strip_prefix('V'))
        .unwrap_or(tag);
    Version::parse(version).ok()
}

fn should_notify(current: &Version, tag: &str) -> bool {
    release_version(tag).is_some_and(|latest| latest > *current)
}

#[cfg(test)]
mod tests {
    use super::{release_version, should_notify};
    use semver::Version;

    #[test]
    fn parses_optional_release_prefix() {
        assert_eq!(release_version("v1.2.3"), Some(Version::new(1, 2, 3)));
        assert_eq!(release_version("V1.2.3"), Some(Version::new(1, 2, 3)));
        assert!(release_version("latest").is_none());
    }

    #[test]
    fn only_newer_valid_releases_notify() {
        let current = Version::new(1, 2, 3);
        assert!(should_notify(&current, "v1.2.4"));
        assert!(!should_notify(&current, "1.2.3"));
        assert!(!should_notify(&current, "v1.2.3-beta.1"));
        assert!(!should_notify(&current, "not-semver"));
    }
}
