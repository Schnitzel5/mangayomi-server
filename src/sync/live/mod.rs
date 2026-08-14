pub mod controller;
mod hub;

pub use hub::{Domain, LiveSyncHub};

pub(crate) fn has_mutations<const N: usize>(reset_all: Option<bool>, lengths: [usize; N]) -> bool {
    reset_all == Some(true) || lengths.into_iter().any(|length| length != 0)
}

pub(crate) fn origin_client_id(headers: &actix_web::http::header::HeaderMap) -> Option<&str> {
    headers
        .get("X-Sync-Client")
        .and_then(|value| value.to_str().ok())
}

#[cfg(test)]
mod tests {
    use super::has_mutations;

    #[test]
    fn detects_only_payloads_that_contain_mutations() {
        assert!(!has_mutations(Some(false), [0, 0, 0]));
        assert!(!has_mutations(None, [0, 0, 0]));
        assert!(has_mutations(Some(true), [0, 0, 0]));
        assert!(has_mutations(None, [0, 1, 0]));
    }
}
