import { update, operations } from '@aws-appsync/utils/dynamodb';
export function request(ctx) {
  const { address, username, id, profilePicKey, profilePicUrl } =
    ctx.args.userInput;

  return update({
    key: { PK: `USER#${id}`, SK: `USER#${id}` },
    update: {
      profilePicKey: operations.add(profilePicKey),
      profilePicUrl: operations.add(profilePicUrl),
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
