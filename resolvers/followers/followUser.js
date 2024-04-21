import { put } from '@aws-appsync/utils/dynamodb';
export function request(ctx) {
  const { followerId, followingId } = ctx.args;

  const key = {
    PK: `FOLLOWERID#${followerId}`,
    SK: `FOLLOWINGID#${followingId}`,
  };

  const item = {
    followerId,
    followingId,
    entity: 'FOLLOW',
    GSI3PK: `FOLLOWINGID#${followingId}`,
    GSI3SK: `FOLLOWERID#${followerId}`,
  };

  return put({ key: key, item: item });
}

export function response(ctx) {
  return {
    followerId: ctx.args.followerId,
    followingId: ctx.args.followingId,
  };
}
