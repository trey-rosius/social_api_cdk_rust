import * as ddb from '@aws-appsync/utils/dynamodb';
export function request(ctx) {
  const { email } = ctx.args;
  const index = 'getUserByEmail';

  const query = {
    email: { eq: email },
  };
  return ddb.query({
    query,
    index: index,
    scanIndexForward: false,
  });
}

export function response(ctx) {
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  //return a single user record

  return ctx.result.items[0];
}
