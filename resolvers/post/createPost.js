import { util } from '@aws-appsync/utils';
import { put } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { postInput } = ctx.args;

  const id = util.autoKsuid();

  const key = {
    PK: `USER#${postInput.userId}`,
    SK: `POST#${id}`,
  };

  const postItem = {
    ...postInput,
    id: id,
    GSI2PK: 'POST#',
    GSI2SK: `POST#${id}`,
    createdOn: util.time.nowEpochMilliSeconds(),
  };

  return put({ key: key, item: postItem });
}

export function response(ctx) {
  ctx.stash.event = {
    detailType: 'postCreated',
    detail: ctx.result,
  };
  return ctx.result;
}
