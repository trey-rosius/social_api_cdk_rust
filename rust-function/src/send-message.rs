use aws_sdk_dynamodb::{types::AttributeValue, Client};
use rust_functions::{model::{MessageResponse, MessageInput, ResolverInput}, utils::{init_env, setup_tracing}};

use lambda_runtime::{service_fn, Error, LambdaEvent};

use svix_ksuid::{Ksuid, KsuidLike};
use tracing::{error, info};

#[tokio::main]
async fn main() -> Result<(), Error> {
    //initialize client

    let config = init_env().await;

    setup_tracing();
    lambda_runtime::run(service_fn(|request: LambdaEvent<serde_json::Value>| {
        send_message(&config.dynamodb_client, &config.table_name, request)
    }))
    .await?;

    Ok(())
}


async fn send_message(
    client: &Client,
    table_name: &str,
    request: LambdaEvent<serde_json::Value>,
) -> Result<Option<MessageResponse>, Error> {
    let ksuid = Ksuid::new(None, None);

    let id = ksuid.to_string();
   let id_ref = &id;
    let created_on = ksuid.timestamp_seconds();
  
    //create message input
    let user_input:ResolverInput<MessageInput> =  serde_json::from_value(request.payload).expect("Failed to get payload");
  

    let message_input = Box::new(user_input.arguments.input);
    let msg_input_ref = &message_input;
    let message_text = match &msg_input_ref.text{
        Some(text) => text,
        None => {
            error!("No message text provided");
            return Ok(None);
        }
    };
    let image_url = match &msg_input_ref.image{
        Some(image) => image,
        None => {
            error!("No image url provided");
            return Ok(None);
        }
    };
    

    // Put the item in the DynamoDB table
    let res = client
        .put_item()
        .table_name(table_name)
        .item("PK", AttributeValue::S("MESSAGE#".into()))
        .item("SK", AttributeValue::S(format!("MESSAGE#{}", id)))
      
        .item("id", AttributeValue::S(id_ref.to_string()))
        .item(
            "messageType",
            AttributeValue::S(msg_input_ref.message_type.to_string()),
        )
        .item(
            "senderId",
            AttributeValue::S(msg_input_ref.sender_id.to_string()),
        )
        .item(
            "receiverId",
            AttributeValue::S(msg_input_ref.receiver_id.to_string()),
        )
        .item("text", AttributeValue::S(message_text.to_string()))
        .item("image", AttributeValue::S(image_url.to_string()))
        .item("read", AttributeValue::Bool(false))
        .item("createdOn", AttributeValue::S(created_on.to_string()))
        .send()
        .await;

    match res {
        Ok(_response) => {
            let resp = MessageResponse {
                id:id_ref.to_string(),
                message_type: msg_input_ref.message_type.to_string(),
                sender_id: msg_input_ref.sender_id.to_string(),
                receiver_id: msg_input_ref.receiver_id.to_string(),
                text: Some(message_text.into()),
                read: msg_input_ref.read,
                image: Some(image_url.into()),
                created_on: created_on,
              
            };
            info!("Message sent successfully {:?}", resp);
            Ok(Some(resp))
        }
        Err(err) => {
            error!("An error occured while sending message {}", err);
            Ok(None)
        }
    }
}
