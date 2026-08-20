use std::time::Duration;

use mongodb::Client;
use mongodb::bson::doc;
use mongodb::options::ClientOptions;

pub async fn create_client(uri: &str) -> mongodb::error::Result<Client> {
    let mut options = ClientOptions::parse(uri).await?;
    options.max_connecting = Some(20);
    options.min_pool_size = Some(1);
    options.server_selection_timeout = Some(Duration::from_secs(5));
    Client::with_options(options)
}

pub async fn ping(client: &Client) -> mongodb::error::Result<()> {
    client
        .database("admin")
        .run_command(doc! { "ping": 1 })
        .await?;
    Ok(())
}
