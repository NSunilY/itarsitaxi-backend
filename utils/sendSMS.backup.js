const axios = require("axios");
require("dotenv").config();

const sendSMS = async (number, bookingId, fare) => {
  const apiKey = process.env.FAST2SMS_API_KEY;

  const messageText = `Dear customer, your ItarsiTaxi booking is confirmed.\nBooking ID: ${bookingId}\nEstimated Fare: ₹${fare}\nThank you for choosing us!`;

  const payload = new URLSearchParams({
    route: "q", // ✅ Use 'q' for custom messages (Non-DLT)
    message: messageText,
    language: "english",
    numbers: number
  });

  try {
    const res = await axios.post("https://www.fast2sms.com/dev/bulkV2", payload, {
      headers: {
        authorization: apiKey,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });

    if (res.data.return) {
      console.log("✅ SMS sent to", number);
    } else {
      console.error("❌ SMS sending failed:", res.data.message);
    }

    return res.data;

  } catch (err) {
    console.error("❌ SMS Error:", err.response?.data || err.message);
    throw err;
  }
};

module.exports = sendSMS;

