const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOADS_DIR = path.resolve(__dirname, '../uploads');
const PROFILE_UPLOADS_DIR = path.join(UPLOADS_DIR, 'profile');
const DEPOSIT_UPLOADS_DIR = path.join(UPLOADS_DIR, 'deposit-proofs');

fs.mkdirSync(PROFILE_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(DEPOSIT_UPLOADS_DIR, { recursive: true });

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const buildStorage = (destinationPath) => multer.diskStorage({
  destination: (req, file, cb) => cb(null, destinationPath),
  filename: (req, file, cb) => {
    const originalExtension = path.extname(file.originalname || '').toLowerCase();
    const extension = originalExtension || MIME_EXTENSION_MAP[file.mimetype] || '.jpg';
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (MIME_EXTENSION_MAP[file.mimetype]) {
    cb(null, true);
    return;
  }

  const error = new Error('Solo se permiten imágenes JPG, PNG, WEBP o GIF');
  error.status = 400;
  cb(error);
};

const createImageUpload = (destinationPath) => multer({
  storage: buildStorage(destinationPath),
  fileFilter,
  limits: {
    fileSize: 8 * 1024 * 1024,
  },
});

const uploadProfileImage = createImageUpload(PROFILE_UPLOADS_DIR);
const uploadDepositProof = createImageUpload(DEPOSIT_UPLOADS_DIR);

const getBackendPublicUrl = (req) => (
  process.env.BACKEND_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  `${req.protocol}://${req.get('host')}`
).replace(/\/$/, '');

const getUploadUrl = (req, folder, filename) => `${getBackendPublicUrl(req)}/uploads/${folder}/${filename}`;

const getProfileUploadUrl = (req, filename) => getUploadUrl(req, 'profile', filename);
const getDepositProofUrl = (req, filename) => getUploadUrl(req, 'deposit-proofs', filename);

const deleteUploadedFileByUrl = async (fileUrl) => {
  if (!fileUrl) {
    return;
  }

  try {
    const parsedUrl = new URL(fileUrl);
    const pathname = parsedUrl.pathname || '';
    if (!pathname.startsWith('/uploads/profile/')) {
      return;
    }

    const filename = path.basename(pathname);
    const filePath = path.join(PROFILE_UPLOADS_DIR, filename);
    await fs.promises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT' && error.code !== 'ERR_INVALID_URL') {
      throw error;
    }
  }
};

module.exports = {
  UPLOADS_DIR,
  uploadProfileImage,
  uploadDepositProof,
  getProfileUploadUrl,
  getDepositProofUrl,
  deleteUploadedFileByUrl,
};
