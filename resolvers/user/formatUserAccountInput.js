import { util } from "@aws-appsync/utils";

export function request(ctx) {
  const id = util.autoKsuid();
  const { ...values } = ctx.args;

  const pk = `USER#${id}`;
  const sk = `USER#${id}`;

  const key = { PK: pk, SK: sk };

  values.userInput.id = id;
  values.userInput.PK = pk;
  values.userInput.SK = sk;

  values.userInput.ENTITY = "USER";
  values.userInput.GSI1PK = "USER#";
  values.userInput.GSI1SK = pk;

  values.userInput.createdOn = util.time.nowEpochMilliSeconds();
  const condition = { PK: { attributeExists: false } };

  return {
    payload: {
      key: key,
      values: values.userInput,
      condition: condition,
    },
  };
}

export function response(ctx) {
  return ctx.result;
}
