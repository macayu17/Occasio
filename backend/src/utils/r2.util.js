import AWS from 'aws-sdk';

const isTruthy = (value) => String(value || '').trim().length > 0;

export const isR2Configured = () => {
  return (
    isTruthy(process.env.R2_ACCOUNT_ID) &&
    isTruthy(process.env.R2_ACCESS_KEY_ID) &&
    isTruthy(process.env.R2_SECRET_ACCESS_KEY) &&
    isTruthy(process.env.R2_BUCKET) &&
    isTruthy(process.env.R2_ENDPOINT)
  );
};

const getR2Client = () => {
  if (!isR2Configured()) {
    throw new Error('R2 is not configured');
  }

  return new AWS.S3({
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    endpoint: process.env.R2_ENDPOINT,
    region: process.env.R2_REGION || 'auto',
    signatureVersion: 'v4',
    s3ForcePathStyle: true,
  });
};

const parseR2Ref = (templateRef) => {
  if (!templateRef) return null;

  if (templateRef.startsWith('r2://')) {
    const withoutProtocol = templateRef.slice('r2://'.length);
    const firstSlashIndex = withoutProtocol.indexOf('/');
    if (firstSlashIndex === -1) return null;
    const bucket = withoutProtocol.slice(0, firstSlashIndex);
    const key = withoutProtocol.slice(firstSlashIndex + 1);
    return bucket && key ? { bucket, key } : null;
  }

  try {
    const parsed = new URL(templateRef);
    if (!parsed.hostname.includes('r2.cloudflarestorage.com')) return null;
    const pathParts = parsed.pathname.replace(/^\//, '').split('/');
    if (pathParts.length < 2) return null;
    const bucket = pathParts[0];
    const key = pathParts.slice(1).join('/');
    return bucket && key ? { bucket, key } : null;
  } catch {
    return null;
  }
};

export const isR2TemplateRef = (templateRef) => Boolean(parseR2Ref(templateRef));

export const uploadBufferToR2 = async ({ buffer, key, contentType = 'application/octet-stream' }) => {
  const s3 = getR2Client();
  const bucket = process.env.R2_BUCKET;

  await s3.upload({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }).promise();

  return `r2://${bucket}/${key}`;
};

export const getR2ObjectBuffer = async (templateRef) => {
  const parsed = parseR2Ref(templateRef);
  if (!parsed) {
    throw new Error('Invalid R2 template reference');
  }

  const s3 = getR2Client();
  const object = await s3.getObject({
    Bucket: parsed.bucket,
    Key: parsed.key,
  }).promise();

  if (!object?.Body) {
    throw new Error('R2 object has no body');
  }

  return Buffer.isBuffer(object.Body) ? object.Body : Buffer.from(object.Body);
};
