// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  name: { type: String, required: true },
  mobile: { type: String, required: true },
  email: { type: String, default: '' },
  paymentMode: { type: String, required: true },
  carType: { type: String, required: true },
  distance: { type: Number, required: true },
  totalFare: { type: Number, required: true },
  pickupDate: { type: String, default: '' },
  pickupTime: { type: String, default: '' },
  dropLocation: { type: String, default: '' },
  tripType: { type: String, default: '' },
  duration: { type: String, default: '' },
  status: {
    type: String,
    default: 'pending',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  }
});

module.exports = mongoose.model('Booking', bookingSchema);

