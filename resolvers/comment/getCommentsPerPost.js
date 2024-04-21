import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { limit = 10, nextToken, postId } = ctx.args;

  const index = 'getPostComments';
  const query = {
    GSI4PK: { eq: `POST#${postId}` },
    GSI4SK: { beginsWith: 'COMMENT#' },
  };
  return ddb.query({
    query,
    limit,
    nextToken,
    index: index,
    scanIndexForward: false,
  });
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }

  return {
    items: ctx.result.items,
    nextToken: ctx.result.nextToken,
  };
}
