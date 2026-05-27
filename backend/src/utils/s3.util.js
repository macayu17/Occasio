import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl as createSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

const isS3Configured = () => Boolean(
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.S3_BUCKET_NAME
);

const getS3Client = () => {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured');
  }

  return new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
};

const buildPublicS3Url = (bucket, region, key) => {
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  if (region === 'us-east-1') {
    return `https://${bucket}.s3.amazonaws.com/${encodedKey}`;
  }
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
};

export async function uploadToS3(file) {
  try {
    const fileContent = file.buffer || fs.readFileSync(file.path);
    const fallbackName = file.originalname || (file.path ? path.basename(file.path) : 'upload.bin');
    const fileName = `${Date.now()}-${file.filename || path.basename(fallbackName)}`;

    const bucket = process.env.S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || 'us-east-1';
    const s3 = getS3Client();
    const params = {
      Bucket: bucket,
      Key: fileName,
      Body: fileContent,
      ContentType: file.mimetype || 'application/octet-stream',
      ACL: 'public-read'
    };

    await s3.send(new PutObjectCommand(params));
    
    // Delete local file after upload
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return buildPublicS3Url(bucket, region, fileName);
  } catch (error) {
    console.error('S3 upload error:', error);
    throw error;
  }
}

export async function deleteFromS3(fileUrl) {
  try {
    const fileName = fileUrl.split('/').pop();
    
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName
    };

    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand(params));
    console.log('File deleted from S3:', fileName);
  } catch (error) {
    console.error('S3 delete error:', error);
    throw error;
  }
}

export async function getSignedUrl(fileKey, expiresIn = 3600) {
  try {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileKey,
    };

    const s3 = getS3Client();
    const url = await createSignedUrl(s3, new GetObjectCommand(params), { expiresIn });
    return url;
  } catch (error) {
    console.error('Get signed URL error:', error);
    throw error;
  }
}
