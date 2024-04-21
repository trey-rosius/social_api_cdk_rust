import { get } from "@aws-appsync/utils/dynamodb";
export function request(ctx) {
  const { userId } = ctx.source;

  const key = {
    PK: `USER#${userId}`,
    SK: `USER#${userId}`,
  };

  return get({ key: key });
}

export function response(ctx) {
  return ctx.result;
}
