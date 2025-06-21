const axios = require("axios");
require("dotenv").config();

const sendSMS = async (number, bookingId, fare) => {
  const apiKey = process.env.FAST2SMS_API_KEY;
  const senderId = process.env.FAST2SMS_SENDER_ID;  // e.g., 'ITRCTX'
  const messageId = process.env.FAST2SMS_TEMPLATE_ID; // Your approved message ID

  const payload = new URLSearchParams({
    sender_id: senderId,
    message: messageId,
    variables_values: `${bookingId}|${fare}`,
    route: "dlt",
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

