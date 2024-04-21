export function request(ctx) {
  const prompt = ctx.args.prompt;

  return {
    resourcePath: "/model/amazon.titan-image-generator-v1/invoke",
    method: "POST",
    params: {
      headers: {
        "Content-Type": "application/json",
      },
      body: {
        taskType: "TEXT_IMAGE",
        textToImageParams: {
          text: prompt,
        },

        imageGenerationConfig: {
          numberOfImages: 3,
          height: 512,
          width: 512,
          cfgScale: 8.0,
          seed: 0,
        },
      },
    },
  };
}

export function response(ctx) {
  return ctx.result.body;
}
