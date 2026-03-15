import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

interface TrellisComputeStackProps extends StackProps {
  readonly stage: string;
  readonly vpc: ec2.IVpc;
  readonly appRunnerSecurityGroup: ec2.ISecurityGroup;
  readonly dbSecret: secretsmanager.ISecret;
  readonly documentsBucket: s3.IBucket;
}

export class TrellisComputeStack extends Stack {
  readonly serviceUrl: string;

  constructor(scope: Construct, id: string, props: TrellisComputeStackProps) {
    super(scope, id, props);

    const { stage, vpc, appRunnerSecurityGroup, dbSecret, documentsBucket } =
      props;
    const isProd = stage === 'prod';

    const privateSubnetIds = vpc.selectSubnets({
      subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
    }).subnetIds;

    const vpcConnector = new apprunner.CfnVpcConnector(this, 'VpcConnector', {
      vpcConnectorName: `${stage}-trellis-connector`,
      subnets: privateSubnetIds,
      securityGroups: [appRunnerSecurityGroup.securityGroupId],
    });

    const instanceRole = new iam.Role(this, 'InstanceRole', {
      roleName: `${stage}-trellis-apprunner-instance`,
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
    });

    dbSecret.grantRead(instanceRole);
    documentsBucket.grantReadWrite(instanceRole);

    const cpu = isProd ? '1024' : '256';
    const memory = isProd ? '2048' : '512';
    const maxSize = isProd ? 4 : 1;

    const autoScalingConfig = new apprunner.CfnAutoScalingConfiguration(
      this,
      'AutoScaling',
      {
        autoScalingConfigurationName: `${stage}-trellis-scaling`,
        maxConcurrency: 100,
        maxSize,
        minSize: 1,
      },
    );

    const service = new apprunner.CfnService(this, 'Service', {
      serviceName: `${stage}-trellis-api`,
      sourceConfiguration: {
        imageRepository: {
          imageIdentifier:
            'public.ecr.aws/aws-containers/hello-app-runner:latest',
          imageRepositoryType: 'ECR_PUBLIC',
          imageConfiguration: {
            port: '3000',
            runtimeEnvironmentVariables: [
              { name: 'STAGE', value: stage },
              { name: 'TRELLIS_DB_SECRET_ARN', value: dbSecret.secretArn },
              {
                name: 'TRELLIS_S3_BUCKET',
                value: documentsBucket.bucketName,
              },
            ],
          },
        },
        autoDeploymentsEnabled: false,
      },
      instanceConfiguration: {
        cpu,
        memory,
        instanceRoleArn: instanceRole.roleArn,
      },
      networkConfiguration: {
        egressConfiguration: {
          egressType: 'VPC',
          vpcConnectorArn: vpcConnector.attrVpcConnectorArn,
        },
      },
      autoScalingConfigurationArn:
        autoScalingConfig.attrAutoScalingConfigurationArn,
      healthCheckConfiguration: {
        protocol: 'HTTP',
        path: '/health',
        interval: 10,
        timeout: 5,
        healthyThreshold: 1,
        unhealthyThreshold: 5,
      },
    });

    this.serviceUrl = service.attrServiceUrl;

    new CfnOutput(this, 'ApiUrl', {
      value: `https://${service.attrServiceUrl}`,
      description: 'Trellis API endpoint',
    });
  }
}
