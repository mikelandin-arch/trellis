import { Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import type { Construct } from 'constructs';

interface TrellisNetworkStackProps extends StackProps {
  readonly stage: string;
}

export class TrellisNetworkStack extends Stack {
  readonly vpc: ec2.Vpc;
  readonly dbSecurityGroup: ec2.SecurityGroup;
  readonly appRunnerSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: TrellisNetworkStackProps) {
    super(scope, id, props);

    const { stage } = props;
    const isProd = stage === 'prod';

    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${stage}-trellis-vpc`,
      maxAzs: 2,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      natGateways: isProd ? 2 : 1,
      subnetConfiguration: [
        {
          name: 'public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 24,
        },
      ],
    });

    this.dbSecurityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: this.vpc,
      securityGroupName: `${stage}-trellis-rds-sg`,
      description: 'Security group for Trellis RDS instance',
      allowAllOutbound: false,
    });

    this.appRunnerSecurityGroup = new ec2.SecurityGroup(
      this,
      'AppRunnerSecurityGroup',
      {
        vpc: this.vpc,
        securityGroupName: `${stage}-trellis-apprunner-sg`,
        description: 'Security group for App Runner VPC connector',
      },
    );

    this.dbSecurityGroup.addIngressRule(
      this.appRunnerSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow App Runner to reach RDS',
    );
  }
}
