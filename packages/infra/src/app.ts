import { App, Tags } from 'aws-cdk-lib';
import { TrellisComputeStack } from './compute-stack';
import { TrellisDataStack } from './data-stack';
import { TrellisNetworkStack } from './network-stack';

const app = new App();
const stage = (app.node.tryGetContext('stage') as string | undefined) || 'dev';
const env = { account: '572885593026', region: 'us-west-2' };

const network = new TrellisNetworkStack(app, `${stage}-trellis-network`, {
  env,
  stage,
});

const data = new TrellisDataStack(app, `${stage}-trellis-data`, {
  env,
  stage,
  vpc: network.vpc,
  dbSecurityGroup: network.dbSecurityGroup,
});

new TrellisComputeStack(app, `${stage}-trellis-compute`, {
  env,
  stage,
  vpc: network.vpc,
  appRunnerSecurityGroup: network.appRunnerSecurityGroup,
  dbSecret: data.dbSecret,
  documentsBucket: data.documentsBucket,
});

Tags.of(app).add('Project', 'trellis');
Tags.of(app).add('Stage', stage);
Tags.of(app).add('ManagedBy', 'cdk');

app.synth();
