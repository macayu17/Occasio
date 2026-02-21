import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const url = 'https://res.cloudinary.com/dkymmvuv5/raw/authenticated/s--5OULgmzH--/v1/occasio/events/certificates/pl5ckz0w3dswjmpne434.pdf?_a=BAMAMieC0';

// Extract public ID
const urlObj = new URL(url);
const pathParts = urlObj.pathname.split('/');
const rawIdx = pathParts.indexOf('raw');
let startIdx = rawIdx + 2;
if (pathParts[startIdx] && pathParts[startIdx].startsWith('s--')) startIdx++;
if (pathParts[startIdx] && /^v\d+$/.test(pathParts[startIdx])) startIdx++;
const publicId = pathParts.slice(startIdx).join('/');
const publicIdNoExt = publicId.replace(/\.[^.]+$/, '');
console.log('publicId (no ext):', publicIdNoExt);
console.log('publicId (with ext):', publicId);

// Test 1: Signed URL without extension
const signedUrl1 = cloudinary.url(publicIdNoExt, {
  resource_type: 'raw', type: 'authenticated', sign_url: true,
  expires_at: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
});
console.log('\nTest 1 - Signed URL (no ext):', signedUrl1);
const r1 = await fetch(signedUrl1);
console.log('  Status:', r1.status, r1.statusText);

// Test 2: Signed URL WITH extension
const signedUrl2 = cloudinary.url(publicId, {
  resource_type: 'raw', type: 'authenticated', sign_url: true,
  expires_at: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
});
console.log('\nTest 2 - Signed URL (with ext):', signedUrl2);
const r2 = await fetch(signedUrl2);
console.log('  Status:', r2.status, r2.statusText);

// Test 3: Admin API lookup
console.log('\n--- Admin API lookup ---');
try {
  const result = await cloudinary.api.resource(publicIdNoExt, { resource_type: 'raw', type: 'authenticated' });
  console.log('Found (no ext):', result.public_id, result.bytes, 'bytes');
} catch (err) {
  console.log('Not found (no ext):', err?.error?.message || err.message);
}

// Test 4: List resources in folder  
console.log('\n--- Listing resources in folder ---');
try {
  const result = await cloudinary.api.resources({
    resource_type: 'raw', type: 'authenticated',
    prefix: 'occasio/', max_results: 20
  });
  console.log('Resources found:', result.resources.length);
  for (const r of result.resources) {
    console.log('  ' + r.public_id + ' (' + r.bytes + ' bytes)');
  }
} catch (err) {
  console.log('List error:', err?.error?.message || err.message);
}
