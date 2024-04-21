export function request(ctx) {
  return {};
}

export function response(ctx) {
  return {
    items: ctx.prev.result,
    nextToken: ctx.stash.nextToken,
  };
}
