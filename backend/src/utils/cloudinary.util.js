import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Check if Cloudinary is configured
 */
export const isCloudinaryConfigured = () => {
    return !!(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
    );
};

/**
 * Upload an image buffer to Cloudinary
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} folder - The folder to upload to (e.g., 'posters', 'tickets')
 * @returns {Promise<string>} - The secure URL of the uploaded image
 */
export const uploadToCloudinary = (fileBuffer, folder = 'posters') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `occasio/${folder}`,
                resource_type: 'image',
                transformation: [
                    { quality: 'auto:good' },
                    { fetch_format: 'auto' }
                ]
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result.secure_url);
                }
            }
        );

        uploadStream.end(fileBuffer);
    });
};

/**
 * Upload a PDF buffer to Cloudinary (using raw resource type with signed URL)
 * @param {Buffer} pdfBuffer - The PDF buffer to upload
 * @param {string} folder - The folder to upload to
 * @returns {Promise<string>} - The signed URL of the uploaded PDF (valid for 1 year)
 */
export const uploadPdfToCloudinary = (pdfBuffer, folder = 'tickets') => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `occasio/${folder}`,
                resource_type: 'raw',  // Important for PDFs!
                format: 'pdf',
                type: 'authenticated'  // Use authenticated for signed URL access
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    // Generate a signed URL that's valid for 1 year (bypasses untrusted customer restriction)
                    const signedUrl = cloudinary.url(result.public_id, {
                        resource_type: 'raw',
                        type: 'authenticated',
                        sign_url: true,
                        expires_at: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year
                    });
                    resolve(signedUrl);
                }
            }
        );

        uploadStream.end(pdfBuffer);
    });
};

/**
 * Delete an image from Cloudinary by URL
 * @param {string} imageUrl - The Cloudinary URL of the image
 */
export const deleteFromCloudinary = async (imageUrl) => {
    try {
        // Extract public_id from URL
        const urlParts = imageUrl.split('/');
        const publicIdWithExtension = urlParts.slice(-2).join('/').split('.')[0];
        const publicId = `occasio/${publicIdWithExtension}`;

        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error('Failed to delete from Cloudinary:', error);
    }
};

export default cloudinary;
