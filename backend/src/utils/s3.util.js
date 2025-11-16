import AWS from 'aws-sdk';
import fs from 'fs';
import path from 'path';

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

export async function uploadToS3(file) {
  try {
    const fileContent = fs.readFileSync(file.path);
    const fileName = `${Date.now()}-${file.filename || path.basename(file.path)}`;

    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      ContentType: file.mimetype || 'application/octet-stream',
      ACL: 'public-read'
    };

    const result = await s3.upload(params).promise();
    
    // Delete local file after upload
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    return result.Location;
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

    await s3.deleteObject(params).promise();
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
      Expires: expiresIn
    };

    const url = await s3.getSignedUrlPromise('getObject', params);
    return url;
  } catch (error) {
    console.error('Get signed URL error:', error);
    throw error;
  }
}
