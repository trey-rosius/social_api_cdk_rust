import { update, operations } from '@aws-appsync/utils/dynamodb';
export function request(ctx) {
  const { address, username } = ctx.args.userInput;

  return update({
    key: { PK: `USER#${username}`, SK: `USER#${username}` },
    update: {
      username: operations.replace(username),
      updatedOn: operations.add(util.time.nowEpochMilliSeconds()),
      address: operations.add({
        ...address,
      }),
    },
  });
}
export function response(ctx) {
  return ctx.result;
}
