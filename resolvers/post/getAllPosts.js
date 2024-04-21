import * as ddb from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { limit = 10, nextToken } = ctx.args;
  const index = 'getAllPosts';

  const query = {
    GSI2PK: { eq: 'POST#' },
    GSI2SK: { beginsWith: 'POST#' },
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
  if (ctx.result.items.length <= 0) {
    runtime.earlyReturn({
      items: [],
      nextToken: null,
    });
  } else {
    return {
      items: ctx.result.items,
      nextToken: ctx.result.nextToken,
    };
  }
}
