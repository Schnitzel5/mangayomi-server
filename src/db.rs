use lazy_static::lazy_static;
use mongodb::Client;
use tokio::sync::OnceCell;

lazy_static! {
    /// Global variable for the database connection
    pub static ref CONN: OnceCell<Client> = OnceCell::const_new();
}
