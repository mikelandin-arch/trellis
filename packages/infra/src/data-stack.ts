import { Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import type * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import type { Construct } from 'constructs';

interface TrellisDataStackProps extends StackProps {
  readonly stage: string;
  readonly vpc: ec2.IVpc;
  readonly dbSecurityGroup: ec2.ISecurityGroup;
}

export class TrellisDataStack extends Stack {
  readonly dbInstance: rds.DatabaseInstance;
  readonly dbSecret: secretsmanager.ISecret;
  readonly documentsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: TrellisDataStackProps) {
    super(scope, id, props);

    const { stage, vpc, dbSecurityGroup } = props;
    const isProd = stage === 'prod';

    this.dbInstance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `${stage}-trellis-rds`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.MICRO,
      ),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSecurityGroup],
      credentials: rds.Credentials.fromGeneratedSecret('trellis_admin', {
        secretName: `${stage}/trellis/db-credentials`,
      }),
      databaseName: 'trellis',
      allocatedStorage: 20,
      maxAllocatedStorage: 40,
      multiAz: false,
      storageEncrypted: true,
      deletionProtection: isProd,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      backupRetention: isProd ? Duration.days(7) : Duration.days(1),
    });

    this.dbSecret = this.dbInstance.secret!;

    this.documentsBucket = new s3.Bucket(this, 'DocumentsBucket', {
      bucketName: `${stage}-trellis-documents-${this.account}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      lifecycleRules: [
        {
          id: 'archive',
          transitions: [
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(90),
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: Duration.days(365),
            },
          ],
        },
      ],
    });
  }
}
