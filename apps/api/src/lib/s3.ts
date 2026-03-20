import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const s3 = new S3Client({ region: process.env.AWS_REGION ?? 'us-west-2' });
export const BUCKET = process.env.TRELLIS_S3_BUCKET ?? 'trellis-documents-dev';
export const PRESIGN_EXPIRY_SECONDS = 300;

export async function getPresignedUploadUrl(
  fileKey: string,
  contentType: string,
): Promise<{ uploadUrl: string; fileKey: string }> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
    ContentType: contentType,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
  return { uploadUrl, fileKey };
}

export async function getPresignedDownloadUrl(fileKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: fileKey,
  });
  return getSignedUrl(s3, command, { expiresIn: PRESIGN_EXPIRY_SECONDS });
}

export function buildFileUrl(fileKey: string): string {
  return `https://${BUCKET}.s3.amazonaws.com/${fileKey}`;
}

export function buildDocumentFileKey(
  tenantId: number,
  category: string,
  filename: string,
): string {
  const year = new Date().getFullYear();
  const uniqueId = crypto.randomUUID();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `documents/${tenantId}/${category}/${year}/${uniqueId}-${sanitized}`;
}
