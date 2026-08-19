use super::LiveSyncHub;
use actix_identity::Identity;
use actix_web::error::ErrorBadRequest;
use actix_web::{HttpRequest, HttpResponse, Result, get, web};
use futures::StreamExt;
use serde::Deserialize;

const READY_MESSAGE: &str = r#"{"type":"ready"}"#;
const MAX_CLIENT_ID_LENGTH: usize = 128;

#[derive(Deserialize)]
struct LiveSyncQuery {
    #[serde(rename = "clientId")]
    client_id: String,
    device: Option<String>,
}

#[get("/live")]
pub async fn live_sync(
    request: HttpRequest,
    payload: web::Payload,
    user: Identity,
    query: web::Query<LiveSyncQuery>,
    hub: web::Data<LiveSyncHub>,
) -> Result<HttpResponse> {
    validate_client_id(&query.client_id)?;
    let user_id = user.id()?;
    let (response, session, messages) = actix_ws::handle(&request, payload)?;
    let query = query.into_inner();
    let device = sanitize_device(query.device);
    let (connection_id, outgoing) = hub.register(&user_id, query.client_id, device);

    actix_web::rt::spawn(run_connection(
        session,
        messages,
        outgoing,
        hub,
        user_id,
        connection_id,
    ));

    Ok(response)
}

fn validate_client_id(client_id: &str) -> Result<()> {
    if client_id.is_empty()
        || client_id.len() > MAX_CLIENT_ID_LENGTH
        || client_id
            .chars()
            .any(|character| character.is_control() || character.is_whitespace())
    {
        return Err(ErrorBadRequest("invalid clientId"));
    }

    Ok(())
}

fn sanitize_device(device: Option<String>) -> String {
    let cleaned: String = device
        .unwrap_or_default()
        .chars()
        .filter(|character| !character.is_control())
        .take(64)
        .collect();
    let cleaned = cleaned.trim();
    if cleaned.is_empty() {
        "Unknown device".to_owned()
    } else {
        cleaned.to_owned()
    }
}

async fn run_connection(
    mut session: actix_ws::Session,
    mut messages: actix_ws::MessageStream,
    mut outgoing: tokio::sync::mpsc::UnboundedReceiver<String>,
    hub: web::Data<LiveSyncHub>,
    user_id: String,
    connection_id: u64,
) {
    let mut close_reason = None;

    if session.text(READY_MESSAGE).await.is_ok() {
        loop {
            tokio::select! {
                incoming = messages.next() => {
                    match incoming {
                        Some(Ok(actix_ws::Message::Ping(bytes))) => {
                            if session.pong(&bytes).await.is_err() {
                                break;
                            }
                        }
                        Some(Ok(actix_ws::Message::Pong(_))) => {}
                        Some(Ok(actix_ws::Message::Close(reason))) => {
                            close_reason = reason;
                            break;
                        }
                        Some(Ok(_)) => {}
                        Some(Err(_)) | None => break,
                    }
                }
                invalidation = outgoing.recv() => {
                    match invalidation {
                        Some(message) => {
                            if session.text(message).await.is_err() {
                                break;
                            }
                        }
                        None => break,
                    }
                }
            }
        }
    }

    let _ = session.close(close_reason).await;
    hub.unregister(&user_id, connection_id);
}

#[cfg(test)]
mod tests {
    use super::validate_client_id;

    #[test]
    fn validates_client_ids() {
        assert!(validate_client_id("client-123_abc").is_ok());
        assert!(validate_client_id("").is_err());
        assert!(validate_client_id("client\n123").is_err());
        assert!(validate_client_id("   ").is_err());
        assert!(validate_client_id(&"a".repeat(129)).is_err());
    }
}
