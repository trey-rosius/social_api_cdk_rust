import { remove } from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  const { userId, postId } = ctx.args;

  const key = {
    PK: `USER#${userId}`,
    SK: `POST#${postId}`,
  };

  return remove({ key: key });
}

export function respose(ctx) {
  return ctx.result;
}
