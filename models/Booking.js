// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, default: '' },
  gstNumber: { type: String, default: '' },

  carType: { type: String }, // Removed required
  distance: { type: Number }, // Removed required
  duration: { type: String, default: '' },

  tollCount: { type: Number, default: 0 },
  totalFare: { type: Number }, // Removed required
  advanceAmount: { type: Number, default: 0 },

  pickupLocation: { type: String, default: '' },
  dropLocation: { type: String, default: '' },
  pickupDate: { type: String, default: '' },
  pickupTime: { type: String, default: '' },
  tripType: { type: String, default: '' },

  paymentMode: { type: String }, // Removed required
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Success', 'Failed'],
    default: 'Pending',
  },
  transactionId: { type: String, default: '' },
  merchantOrderId: { type: String, default: '' },

  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending',
  },

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);

