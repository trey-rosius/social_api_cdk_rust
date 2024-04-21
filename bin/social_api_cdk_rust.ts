#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SocialApiCdkRustStack } from '../lib/social_api_cdk_rust-stack';

const app = new cdk.App();
new SocialApiCdkRustStack(app, 'SocialApiCdkRustStack', {
  env: { account: 'xxxxxxxxxxxxxx', region: 'us-east-2' },
});
