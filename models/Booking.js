// models/Booking.js
const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  name: String,
  mobile: String,
  email: String,
  paymentMode: String,
  carType: String,
  distance: Number,
  totalFare: Number,
  pickupDate: String,
  pickupTime: String,
  dropLocation: String,
  tripType: String,
  duration: String,
  status: {
    type: String,
    default: 'pending', // You can also use 'confirmed' if preferred
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Booking', bookingSchema);

