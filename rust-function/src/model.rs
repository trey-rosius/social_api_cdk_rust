use aws_sdk_dynamodb::Client;
use serde::{Deserialize, Serialize};


pub struct ConfigParameters {
    pub table_name: String,
    pub dynamodb_client: Client,
}




#[derive(Clone, Debug, Deserialize, Serialize,)]
#[serde(rename_all = "camelCase")]
pub struct Arguments<T> {
    pub input: T,
}

#[derive(Debug, Clone, PartialEq, Deserialize, Serialize,)]
#[serde(rename_all = "camelCase")]
pub struct Response {
    pub id: String,
    pub user_id: String,
    pub content: String,

    pub image_url: String,
    pub created_on: i64,
    pub updated_on: i64,
}


#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolverInput<T> {
    pub arguments: Arguments<T>,
    pub field: String,
    pub source: Option<String>, // Using Option to account for potential null values
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageInput {
    pub message_type: String,
    pub sender_id: String,
    pub receiver_id: String,
    pub text: Option<String>,
    pub image: Option<String>,
    pub read: bool,
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub id: String,
    pub message_type: String,
    pub sender_id: String,
    pub receiver_id: String,
    pub text: Option<String>,
    pub read: bool,
    pub image: Option<String>,
    pub created_on: i64,
}
