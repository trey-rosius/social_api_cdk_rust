import { util } from "@aws-appsync/utils";

export function request(ctx) {
  if (!ctx.stash.event) {
    util.error("InternalError", "Event missing in stash");
  }

  return {
    operation: "PutEvents",
    events: [
      {
        source: "email.socialEvent",
        ...ctx.stash.event,
      },
    ],
  };
}

export function response(ctx) {
  if (ctx.error) {
    util.error("Failed putting event in EventBride", "Error");
  }

  return ctx.prev.result;
}
