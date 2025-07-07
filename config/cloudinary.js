// config/cloudinary.js
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Dynamic Cloudinary folder and naming
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    const driverId = req.body.driverId || req.params.id || 'unknown';
    const docType = file.fieldname || 'document';

    return {
      folder: `itarsitaxi-drivers/driver-${driverId}`,
      public_id: `${docType}-${Date.now()}`, // like dl-1728372993.jpg
      allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    };
  },
});

module.exports = { cloudinary, storage };

