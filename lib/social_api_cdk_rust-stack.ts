import * as cdk from 'aws-cdk-lib';
import * as db from 'aws-cdk-lib/aws-dynamodb';

import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as events from 'aws-cdk-lib/aws-events';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as events_target from 'aws-cdk-lib/aws-events-targets';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { RustFunction } from 'cargo-lambda-cdk';
import path = require('path');

const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const CURRENT_DATE = new Date();
const KEY_EXPIRATION_DATE = new Date(CURRENT_DATE.getTime() + SEVEN_DAYS);

export class SocialApiCdkRustStack extends cdk.Stack {
  api: cdk.aws_appsync.GraphqlApi;
  table: cdk.aws_dynamodb.Table;
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPool: cognito.UserPool = new cognito.UserPool(
      this,
      'cdk-rust-social-api-userpool',
      {
        selfSignUpEnabled: true,
        accountRecovery: cognito.AccountRecovery.PHONE_AND_EMAIL,
        userVerification: {
          emailStyle: cognito.VerificationEmailStyle.CODE,
        },
        autoVerify: {
          email: true,
        },
        standardAttributes: {
          email: {
            required: true,
            mutable: true,
          },
        },
      },
    );

    const userPoolClient: cognito.UserPoolClient = new cognito.UserPoolClient(
      this,
      'CdkRustSocialUserPoolClient',
      {
        userPool,
      },
    );

    this.api = new appsync.GraphqlApi(this, 'CdkRustSocialApi', {
      name: 'social-cdk-rust-api-example',
      definition: appsync.Definition.fromFile('./graphql/schema.graphql'),
      logConfig: { fieldLogLevel: appsync.FieldLogLevel.ALL },

      authorizationConfig: {
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.USER_POOL,
            userPoolConfig: {
              userPool: userPool,
            },
          },
        ],

        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,

          apiKeyConfig: {
            name: 'default',
            description: 'default auth mode',
            expires: cdk.Expiration.atDate(KEY_EXPIRATION_DATE),
          },
        },
      },
    });

    //define dynamodb table and all global secondary indexes

    this.table = new db.Table(this, 'social-cdk-rust-db', {
      partitionKey: { name: 'PK', type: db.AttributeType.STRING },
      sortKey: { name: 'SK', type: db.AttributeType.STRING },

      billingMode: db.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.api.addEnvironmentVariable('TABLE_NAME', this.table.tableName);

    this.table.addGlobalSecondaryIndex({
      indexName: 'getAllUsers',
      partitionKey: { name: 'GSI1PK', type: db.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: db.AttributeType.STRING },
      projectionType: db.ProjectionType.ALL,
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'getAllPosts',
      partitionKey: { name: 'GSI2PK', type: db.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: db.AttributeType.STRING },
      projectionType: db.ProjectionType.ALL,
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'getAllFollowers',
      partitionKey: { name: 'GSI3PK', type: db.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: db.AttributeType.STRING },
      projectionType: db.ProjectionType.KEYS_ONLY,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'getPostComments',
      partitionKey: { name: 'GSI4PK', type: db.AttributeType.STRING },
      sortKey: { name: 'GSI4SK', type: db.AttributeType.STRING },
      projectionType: db.ProjectionType.ALL,
    });

    this.table.addGlobalSecondaryIndex({
      indexName: 'getUserByEmail',
      partitionKey: { name: 'email', type: db.AttributeType.STRING },
      projectionType: db.ProjectionType.INCLUDE,
      nonKeyAttributes: [
        'PK',
        'SK',
        'id',
        'username',
        'about',
        'profilePicUrl',
        'profilePicKey',
        'address',
        'userType',
        'firstName',
        'lastName',
        'createdOn',
      ],
    });

    const sendMessageLambdaFunction = new RustFunction(
      this,
      'sendMessageLambdaFunction',
      {
        manifestPath: path.join(__dirname, '..', 'rust-functions'),
      },
    );

    //add permissions
    this.table.grantWriteData(sendMessageLambdaFunction);
    sendMessageLambdaFunction.addEnvironment(
      'TABLE_NAME',
      this.table.tableName,
    );

    const lambdaDataSource = this.api.addLambdaDataSource(
      'sendMessageLambdaDataSource',
      sendMessageLambdaFunction,
    );

    //define event bridge rule

    const eventBus = new events.EventBus(this, 'CdkRustSocialEventBus', {
      eventBusName: 'CdkRustSocialEventBus',
    });

    // adding datasource

    const dbDataSource = this.api.addDynamoDbDataSource(
      'CdkSocialRustDataSource',
      this.table,
    );

    const noneDataSource = this.api.addNoneDataSource('none');
    const eventBridgeDataSource = this.api.addEventBridgeDataSource(
      'eventBridgeDataSource',
      eventBus,
    );
    const formatUserAccountFunction = new appsync.AppsyncFunction(
      this,
      'formatUserAccountInput',
      {
        api: this.api,
        dataSource: noneDataSource,
        name: 'formatUserAccountInput',
        code: appsync.Code.fromAsset(
          './resolvers/user/formatUserAccountInput.js',
        ),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      },
    );

    const createUserAccountFunction = new appsync.AppsyncFunction(
      this,
      'createUserAccountFunction',
      {
        api: this.api,
        dataSource: dbDataSource,
        name: 'createUserAccountFunction',
        code: appsync.Code.fromAsset('./resolvers/user/createUserAccount.js'),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      },
    );

    this.api.createResolver('createUserAccount', {
      typeName: 'Mutation',
      code: appsync.Code.fromAsset('./resolvers/pipeline/default.js'),
      fieldName: 'createUserAccount',
      pipelineConfig: [formatUserAccountFunction, createUserAccountFunction],

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    this.api.createResolver('createComment', {
      typeName: 'Mutation',
      fieldName: 'createComment',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/comment/createComment.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });
    this.api.createResolver('getUserByEmail', {
      typeName: 'Query',
      fieldName: 'getUserByEmail',
      dataSource: dbDataSource,

      code: appsync.Code.fromAsset('./resolvers/user/getUserByEmail.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    this.api.createResolver('updateUserAccount', {
      typeName: 'Mutation',
      fieldName: 'updateUserAccount',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/user/updateUserAccount.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    this.api.createResolver('getUserAccount', {
      typeName: 'Query',
      fieldName: 'getUserAccount',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/user/getUserAccount.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    const createPostFunction = new appsync.AppsyncFunction(
      this,
      'createPostFunction',
      {
        api: this.api,
        dataSource: dbDataSource,
        name: 'createPostFunction',
        code: appsync.Code.fromAsset('./resolvers/post/createPost.js'),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      },
    );
    const eventBridgeFunction = new appsync.AppsyncFunction(
      this,
      'eventBridgeFunction',
      {
        api: this.api,
        dataSource: eventBridgeDataSource,
        name: 'eventBridgeFunction',
        code: appsync.Code.fromAsset('./resolvers/events/putEvents.js'),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      },
    );
    const bedrockDataSource = this.api.addHttpDataSource(
      'bedrockDS',
      'https://bedrock-runtime.us-east-1.amazonaws.com',
      {
        authorizationConfig: {
          signingRegion: 'us-east-1',
          signingServiceName: 'bedrock',
        },
      },
    );

    bedrockDataSource.grantPrincipal.addToPrincipalPolicy(
      new iam.PolicyStatement({
        resources: [
          'arn:aws:bedrock:us-east-1::foundation-model/amazon.titan-image-generator-v1',
        ],
        actions: ['bedrock:InvokeModel'],
      }),
    );
    const sendBulkEmailSF = new sfn.StateMachine(this, 'SendBulkEmailSF', {
      definitionBody: sfn.DefinitionBody.fromFile(
        './state_workflow/send_email_workflow.asl.json',
      ),
    });

    this.table.grantReadData(sendBulkEmailSF);
    //grant step functions permissions to send bulk email
    sendBulkEmailSF.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: [
          'ses:SendEmail',
          'ses:SendTemplatedEmail',
          'ses:SendBulkTemplatedEmail',
          'ses:SendBulkEmail',
          'sesv2:SendBulkEmail',
          'ses:VerifyEmailIdentity',
        ],
        resources: ['*'],
        effect: cdk.aws_iam.Effect.ALLOW,
      }),
    );

    const rule = new events.Rule(this, 'send-email-rule', {
      eventBus: eventBus,
      eventPattern: {
        detailType: events.Match.exactString('postCreated'),
        source: ['email.socialEvent'],
      },
      targets: [new events_target.SfnStateMachine(sendBulkEmailSF)],
    });

    const eventRole = new iam.Role(this, 'event-role-for-step-functions', {
      assumedBy: new iam.ServicePrincipal('events.amazonaws.com'),
    });
    sendBulkEmailSF.grantStartExecution(eventRole);

    this.api.createResolver('createPost', {
      typeName: 'Mutation',
      fieldName: 'createPost',
      pipelineConfig: [createPostFunction, eventBridgeFunction],

      code: appsync.Code.fromAsset('./resolvers/pipeline/default.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });
    this.api.createResolver('generatePostImageResolver', {
      dataSource: bedrockDataSource,
      typeName: 'Query',
      fieldName: 'generatePostImages',
      code: appsync.Code.fromAsset('./resolvers/post/generatePostImages.js'),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });
    this.api.createResolver('getPost', {
      typeName: 'Query',
      fieldName: 'getPost',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/post/getPost.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    const sendMessageAppSyncfunction = new appsync.AppsyncFunction(
      this,
      'sendMessageAppSyncfunction',
      {
        api: this.api,
        dataSource: lambdaDataSource,
        name: 'sendMessageAppSyncfunction',
        code: appsync.Code.fromAsset('./resolvers/invoke/invoker.js'),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      },
    );

    const getAllPosts = this.api.createResolver('getAllPosts', {
      typeName: 'Query',
      fieldName: 'getAllPosts',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/post/getAllPosts.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });
    const getUserPerPost = this.api.createResolver('getUserPerPost', {
      typeName: 'Post',
      fieldName: 'user',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/post/getUserPerPost.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });
    getUserPerPost.node.addDependency(getAllPosts);

    const getUserPerComment = this.api.createResolver('getUserPerComment', {
      typeName: 'Comment',
      fieldName: 'user',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/post/getUserPerComment.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    getUserPerPost.node.addDependency(getAllPosts);

    const getCommentsPerPost = this.api.createResolver('getCommentsPerPost', {
      typeName: 'Query',
      fieldName: 'getCommentsPerPost',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/comment/getcommentsPerPost.js'),

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    getUserPerComment.node.addDependency(getCommentsPerPost);
    const getFollowerIdFunction = new appsync.AppsyncFunction(
      this,
      'getFollowerIdFunction',
      {
        api: this.api,
        dataSource: dbDataSource,
        name: 'getFollowerIdFunction',
        code: appsync.Code.fromAsset('./resolvers/followers/getFollowerIds.js'),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      },
    );

    const batchGetFollowerDetailsFunction = new appsync.AppsyncFunction(
      this,
      'batchGetFollowerDetailsFunction',
      {
        api: this.api,
        dataSource: dbDataSource,
        name: 'batchGetFollowerDetailsFunction',
        code: appsync.Code.fromAsset(
          './resolvers/followers/batchGetFollowerDetails.js',
        ),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      },
    );
    const afterBatchGetFollowerDetailsFunction = new appsync.AppsyncFunction(
      this,
      'afterBatchGetFollowerDetailsFunction',
      {
        api: this.api,
        dataSource: noneDataSource,
        name: 'afterBatchGetFollowerDetailsFunction',
        code: appsync.Code.fromAsset(
          './resolvers/followers/afterBatchGetFollowerDetails.js',
        ),
        runtime: appsync.FunctionRuntime.JS_1_0_0,
      },
    );
    this.api.createResolver('followUser', {
      typeName: 'Mutation',
      fieldName: 'followUser',
      dataSource: dbDataSource,
      code: appsync.Code.fromAsset('./resolvers/followers/followUser.js'),
      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });

    this.api.createResolver('getUserFollowers', {
      typeName: 'Query',
      code: appsync.Code.fromAsset('./resolvers/pipeline/default.js'),
      fieldName: 'getUserFollowers',
      pipelineConfig: [
        getFollowerIdFunction,
        batchGetFollowerDetailsFunction,
        afterBatchGetFollowerDetailsFunction,
      ],

      runtime: appsync.FunctionRuntime.JS_1_0_0,
    });
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'GraphQLAPI_ID', { value: this.api.apiId });
    new cdk.CfnOutput(this, 'GraphQLAPI_URL', { value: this.api.graphqlUrl });
    new cdk.CfnOutput(this, 'GraphQLAPI_KEY', { value: this.api.apiKey! });
    new cdk.CfnOutput(this, 'STACK_REGION', { value: this.region });
  }
}
