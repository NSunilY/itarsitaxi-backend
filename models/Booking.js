// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, default: '' },
  gstNumber: { type: String, default: '' },

  carType: { type: String },
  distance: { type: Number },
  duration: { type: String, default: '' },

  tollCount: { type: Number, default: 0 },
  totalFare: { type: Number },
  advanceAmount: { type: Number, default: 0 },

  pickupLocation: { type: String, default: '' },
  dropLocation: { type: String, default: '' },
  pickupDate: { type: String, default: '' },
  pickupTime: { type: String, default: '' },
  tripType: { type: String, default: '' },

  paymentMode: { type: String },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Success', 'Failed', 'Paid'], // ✅ Added 'Paid'
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

