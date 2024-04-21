import { util, runtime } from '@aws-appsync/utils';

export function request(ctx) {
  console.log(`results  ${ctx.prev.result}`);
  const table_name = ctx.env.TABLE_NAME;
  const items = ctx.prev.result.items;
  if (items.length <= 0) {
    runtime.earlyReturn(ctx.prev.result.items);
  }
  return {
    operation: 'BatchGetItem',
    tables: {
      table_name: {
        keys: items.map((item) => {
          console.log(`Item GSI3SK is ${item.GSI3SK}`);
          const idParts = item.GSI3SK.split('#');
          const id = idParts[1];

          console.log(`Item id is ${id}`);

          return util.dynamodb.toMapValues({
            PK: `USER#${id}`,
            SK: `USER#${id}`,
          });
        }),
        consistentRead: true,
      },
    },
  };
}

/**
 * Returns the BatchGetItem table items
 * @param {import('@aws-appsync/utils').Context} ctx the context
 * @returns {[*]} the items
 */
export function response(ctx) {
  const table_name = ctx.env.TABLE_NAME;
  if (ctx.error) {
    util.error(ctx.error.message, ctx.error.type);
  }
  console.log(`response results  ${ctx.result.data[table_name]}`);

  return ctx.result.data[table_name];
}
