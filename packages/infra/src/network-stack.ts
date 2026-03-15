import { Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
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

    const bastionSecurityGroup = new ec2.SecurityGroup(
      this,
      'BastionSecurityGroup',
      {
        vpc: this.vpc,
        securityGroupName: `${stage}-trellis-bastion-sg`,
        description: 'Security group for SSM bastion host',
      },
    );

    this.dbSecurityGroup.addIngressRule(
      bastionSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow bastion to reach RDS',
    );

    const bastionRole = new iam.Role(this, 'BastionRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'AmazonSSMManagedInstanceCore',
        ),
      ],
    });

    new ec2.Instance(this, 'Bastion', {
      instanceName: `${stage}-trellis-bastion`,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.NANO,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      vpc: this.vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroup: bastionSecurityGroup,
      role: bastionRole,
    });
  }
}
