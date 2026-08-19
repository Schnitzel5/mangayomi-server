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
    device: String,
    sender: UnboundedSender<String>,
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
        device: String,
    ) -> (u64, UnboundedReceiver<String>) {
        let connection_id = self.next_connection_id.fetch_add(1, Ordering::Relaxed);
        let (sender, receiver) = mpsc::unbounded_channel();
        let connection = Connection {
            client_id,
            device,
            sender,
        };

        let mut all_connections = self.connections();
        let user_connections = all_connections.entry(user_id.to_owned()).or_default();
        user_connections.insert(connection_id, connection);
        Self::send_presence(user_connections);

        (connection_id, receiver)
    }

    pub(crate) fn unregister(&self, user_id: &str, connection_id: u64) {
        let mut all_connections = self.connections();
        let remove_user = if let Some(user_connections) = all_connections.get_mut(user_id) {
            user_connections.remove(&connection_id);
            if user_connections.is_empty() {
                true
            } else {
                Self::send_presence(user_connections);
                false
            }
        } else {
            false
        };

        if remove_user {
            all_connections.remove(user_id);
        }
    }

    fn send_presence(user_connections: &mut HashMap<u64, Connection>) {
        let mut devices_by_client: HashMap<&str, &str> = HashMap::new();
        for connection in user_connections.values() {
            devices_by_client.insert(connection.client_id.as_str(), connection.device.as_str());
        }
        let devices: Vec<_> = devices_by_client
            .iter()
            .map(|(client_id, device)| {
                serde_json::json!({ "clientId": client_id, "device": device })
            })
            .collect();
        let message = serde_json::json!({ "type": "presence", "devices": devices }).to_string();
        user_connections.retain(|_, connection| connection.sender.send(message.clone()).is_ok());
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

                if connection.sender.send(domain.message().to_owned()).is_ok() {
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
    use tokio::sync::mpsc::UnboundedReceiver;
    use tokio::sync::mpsc::error::TryRecvError;

    fn register(
        hub: &LiveSyncHub,
        user: &str,
        client: &str,
        device: &str,
    ) -> (u64, UnboundedReceiver<String>) {
        hub.register(user, client.to_owned(), device.to_owned())
    }

    fn drain_presence(receiver: &mut UnboundedReceiver<String>) {
        while let Ok(message) = receiver.try_recv() {
            assert!(
                message.contains(r#""type":"presence""#),
                "unexpected non-presence message: {message}"
            );
        }
    }

    #[test]
    fn broadcasts_only_to_the_authenticated_user() {
        let hub = LiveSyncHub::default();
        let (_, mut target) = register(&hub, "user-a", "client-a", "Device A");
        let (_, mut other_user) = register(&hub, "user-b", "client-b", "Device B");
        drain_presence(&mut target);
        drain_presence(&mut other_user);

        assert_eq!(hub.broadcast("user-a", None, Domain::Manga), 1);
        assert_eq!(
            target.try_recv(),
            Ok(r#"{"type":"sync","domain":"manga"}"#.to_owned())
        );
        assert_eq!(other_user.try_recv(), Err(TryRecvError::Empty));
    }

    #[test]
    fn excludes_every_connection_for_the_origin_client() {
        let hub = LiveSyncHub::default();
        let (_, mut origin) = register(&hub, "user", "origin", "Origin");
        let (_, mut origin_duplicate) = register(&hub, "user", "origin", "Origin");
        let (_, mut peer) = register(&hub, "user", "peer", "Peer");
        drain_presence(&mut origin);
        drain_presence(&mut origin_duplicate);
        drain_presence(&mut peer);

        assert_eq!(hub.broadcast("user", Some("origin"), Domain::Histories), 1);
        assert_eq!(origin.try_recv(), Err(TryRecvError::Empty));
        assert_eq!(origin_duplicate.try_recv(), Err(TryRecvError::Empty));
        assert_eq!(
            peer.try_recv(),
            Ok(r#"{"type":"sync","domain":"histories"}"#.to_owned())
        );
    }

    #[test]
    fn removes_dead_senders_without_affecting_future_broadcasts() {
        let hub = LiveSyncHub::default();
        let (_, dead_receiver) = register(&hub, "user", "dead", "Dead");
        drop(dead_receiver);

        assert_eq!(hub.broadcast("user", None, Domain::Updates), 0);
        assert_eq!(hub.connection_count("user"), 0);

        let (_, mut live_receiver) = register(&hub, "user", "live", "Live");
        drain_presence(&mut live_receiver);
        assert_eq!(hub.broadcast("user", None, Domain::Settings), 1);
        assert_eq!(
            live_receiver.try_recv(),
            Ok(r#"{"type":"sync","domain":"settings"}"#.to_owned())
        );
    }

    #[test]
    fn presence_announces_devices_on_register_and_unregister() {
        let hub = LiveSyncHub::default();
        let (phone_id, mut phone) = register(&hub, "user", "phone", "Pixel");
        let first = phone.try_recv().expect("own registration presence");
        assert!(first.contains(r#""type":"presence""#));
        assert!(first.contains("Pixel"));

        let (_, mut laptop) = register(&hub, "user", "laptop", "MacBook");
        let update = phone.try_recv().expect("presence after laptop joined");
        assert!(update.contains("Pixel"));
        assert!(update.contains("MacBook"));
        assert!(
            laptop
                .try_recv()
                .expect("initial presence")
                .contains("MacBook")
        );

        hub.unregister("user", phone_id);
        let after = laptop.try_recv().expect("presence after phone left");
        assert!(after.contains(r#""type":"presence""#));
        assert!(!after.contains("Pixel"));
        assert!(after.contains("MacBook"));
    }
}
