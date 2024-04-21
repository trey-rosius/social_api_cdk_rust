import { util } from '@aws-appsync/utils';
import { put } from '@aws-appsync/utils/dynamodb';

export function request(ctx) {
  const { commentInput } = ctx.args;
  const id = util.autoKsuid();

  const key = {
    PK: `COMMENT#`,
    SK: `COMMENT#${id}`,
  };

  const commentItem = {
    ...commentInput,
    id: id,
    GSI4PK: `POST#${commentInput.postId}`,
    GSI4SK: `COMMENT#${id}`,
    createdOn: util.time.nowEpochMilliSeconds(),
  };

  return put({ key: key, item: commentItem });
}

export function response(ctx) {
  return ctx.result;
}
