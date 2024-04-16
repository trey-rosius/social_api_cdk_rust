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
        'userType',
        'firstName',
        'lastName',
        'createdOn',
      ],
    });

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

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'GraphQLAPI_ID', { value: this.api.apiId });
    new cdk.CfnOutput(this, 'GraphQLAPI_URL', { value: this.api.graphqlUrl });
    new cdk.CfnOutput(this, 'GraphQLAPI_KEY', { value: this.api.apiKey! });
    new cdk.CfnOutput(this, 'STACK_REGION', { value: this.region });
  }
}
