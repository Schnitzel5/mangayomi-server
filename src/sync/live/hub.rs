use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, MutexGuard};
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Domain {
    Manga,
    Histories,
    Updates,
    Settings,
}

impl Domain {
    fn message(self) -> &'static str {
        match self {
            Self::Manga => r#"{"type":"sync","domain":"manga"}"#,
            Self::Histories => r#"{"type":"sync","domain":"histories"}"#,
            Self::Updates => r#"{"type":"sync","domain":"updates"}"#,
            Self::Settings => r#"{"type":"sync","domain":"settings"}"#,
        }
    }
}

struct Connection {
    client_id: String,
    sender: UnboundedSender<&'static str>,
}

#[derive(Default)]
pub struct LiveSyncHub {
    next_connection_id: AtomicU64,
    connections: Mutex<HashMap<String, HashMap<u64, Connection>>>,
}

impl LiveSyncHub {
    pub(crate) fn register(
        &self,
        user_id: &str,
        client_id: String,
    ) -> (u64, UnboundedReceiver<&'static str>) {
        let connection_id = self.next_connection_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = mpsc::unbounded_channel();
        let connection = Connection { client_id, sender };

        self.connections()
            .entry(user_id.to_owned())
            .or_default()
            .insert(connection_id, connection);

        (connection_id, receiver)
    }

    pub(crate) fn unregister(&self, user_id: &str, connection_id: u64) {
        let mut all_connections = self.connections();
        let remove_user = if let Some(user_connections) = all_connections.get_mut(user_id) {
            user_connections.remove(&connection_id);
            user_connections.is_empty()
        } else {
            false
        };

        if remove_user {
            all_connections.remove(user_id);
        }
    }

    pub(crate) fn broadcast(
        &self,
        user_id: &str,
        excluded_client_id: Option<&str>,
        domain: Domain,
    ) -> usize {
        let mut all_connections = self.connections();
        let mut delivered = 0;
        let remove_user = if let Some(user_connections) = all_connections.get_mut(user_id) {
            user_connections.retain(|_, connection| {
                if excluded_client_id == Some(connection.client_id.as_str()) {
                    return true;
                }

                if connection.sender.send(domain.message()).is_ok() {
                    delivered += 1;
                    true
                } else {
                    false
                }
            });
            user_connections.is_empty()
        } else {
            false
        };

        if remove_user {
            all_connections.remove(user_id);
        }

        delivered
    }

    fn connections(&self) -> MutexGuard<'_, HashMap<String, HashMap<u64, Connection>>> {
        self.connections
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    #[cfg(test)]
    fn connection_count(&self, user_id: &str) -> usize {
        self.connections().get(user_id).map_or(0, HashMap::len)
    }
}

#[cfg(test)]
mod tests {
    use super::{Domain, LiveSyncHub};
    use tokio::sync::mpsc::error::TryRecvError;

    #[test]
    fn broadcasts_only_to_the_authenticated_user() {
        let hub = LiveSyncHub::default();
        let (_, mut target) = hub.register("user-a", "client-a".to_owned());
        let (_, mut other_user) = hub.register("user-b", "client-b".to_owned());

        assert_eq!(hub.broadcast("user-a", None, Domain::Manga), 1);
        assert_eq!(target.try_recv(), Ok(r#"{"type":"sync","domain":"manga"}"#));
        assert_eq!(other_user.try_recv(), Err(TryRecvError::Empty));
    }

    #[test]
    fn excludes_every_connection_for_the_origin_client() {
        let hub = LiveSyncHub::default();
        let (_, mut origin) = hub.register("user", "origin".to_owned());
        let (_, mut origin_duplicate) = hub.register("user", "origin".to_owned());
        let (_, mut peer) = hub.register("user", "peer".to_owned());

        assert_eq!(hub.broadcast("user", Some("origin"), Domain::Histories), 1);
        assert_eq!(origin.try_recv(), Err(TryRecvError::Empty));
        assert_eq!(origin_duplicate.try_recv(), Err(TryRecvError::Empty));
        assert_eq!(
            peer.try_recv(),
            Ok(r#"{"type":"sync","domain":"histories"}"#)
        );
    }

    #[test]
    fn removes_dead_senders_without_affecting_future_broadcasts() {
        let hub = LiveSyncHub::default();
        let (_, dead_receiver) = hub.register("user", "dead".to_owned());
        drop(dead_receiver);

        assert_eq!(hub.broadcast("user", None, Domain::Updates), 0);
        assert_eq!(hub.connection_count("user"), 0);

        let (_, mut live_receiver) = hub.register("user", "live".to_owned());
        assert_eq!(hub.broadcast("user", None, Domain::Settings), 1);
        assert_eq!(
            live_receiver.try_recv(),
            Ok(r#"{"type":"sync","domain":"settings"}"#)
        );
    }
}
