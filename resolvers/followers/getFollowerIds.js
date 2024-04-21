import * as ddb from "@aws-appsync/utils/dynamodb";

export function request(ctx) {
  const { limit = 10, nextToken, userId } = ctx.args;
  const index = "getAllFollowers";

  const query = {
    GSI3PK: { eq: `FOLLOWINGID#${userId}` },
    GSI3SK: { beginsWith: "FOLLOWERID#" },
  };
  return ddb.query({ query, limit, nextToken, index: index });
}

export function response(ctx) {
  ctx.stash.nextToken = ctx.result.nextToken;
  return ctx.result;
}
