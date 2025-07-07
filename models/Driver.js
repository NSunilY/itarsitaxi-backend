// models/Driver.js
const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  licenseNumber: { type: String, required: true },
  licenseExpiry: { type: Date, required: true },
  vehicleType: {
    type: String,
    enum: ['Hatchback', 'Sedan', 'MUV', 'SUV'],
    required: true
  },
  vehicleNumber: { type: String, required: true },
  vehicleMakeModel: { type: String, required: true },
  insuranceExpiry: { type: Date, required: true },
  pucExpiry: { type: Date, required: true },

  // ✅ New fields for uploaded documents (Cloudinary URLs)
  rcUrl: { type: String },
  dlUrl: { type: String },
  insuranceUrl: { type: String },
  pucUrl: { type: String }
}, {
  timestamps: true
});

module.exports = mongoose.model('Driver', driverSchema);

