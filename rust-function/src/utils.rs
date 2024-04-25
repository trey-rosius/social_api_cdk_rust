use std::env;

use crate::model::ConfigParameters;
use aws_config::{load_defaults, BehaviorVersion};
use aws_sdk_dynamodb::Client;

pub fn setup_tracing() {
    tracing_subscriber::fmt()
        .json()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .init();
}

pub async fn init_env() -> ConfigParameters {
    // Initialize the AWS SDK for Rust
    // Initialize the AWS SDK for Rust
    let config = load_defaults(BehaviorVersion::v2023_11_09()).await;
    let table_name = env::var("TABLE_NAME").expect("TABLE_NAME must be set");
    let dynamodb_client = Client::new(&config);
    ConfigParameters {
        table_name,
        dynamodb_client,
    }
}
