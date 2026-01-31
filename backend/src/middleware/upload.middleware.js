import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { isCloudinaryConfigured } from '../utils/cloudinary.util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists (for local storage)
const uploadDir = process.env.UPLOAD_DIR || path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Disk storage (for local development)
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Memory storage (for cloud uploads - Cloudinary/S3)
const memoryStorage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
};

const pdfFileFilter = (req, file, cb) => {
  const isPdf = file.mimetype === 'application/pdf';
  const extname = path.extname(file.originalname).toLowerCase() === '.pdf';

  if (isPdf && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'));
  }
};

// Use memory storage if Cloudinary is configured (for production)
// Otherwise use disk storage (for local development)
const getStorage = () => {
  if (isCloudinaryConfigured() || (process.env.NODE_ENV === 'production' && process.env.AWS_ACCESS_KEY_ID)) {
    return memoryStorage;
  }
  return diskStorage;
};

export const upload = multer({
  storage: getStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
  },
  fileFilter: imageFileFilter
});

export const uploadPdf = multer({
  storage: getStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB for PDFs
  },
  fileFilter: pdfFileFilter
});
