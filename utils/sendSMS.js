// utils/sendSMS.js
const axios = require("axios");
require("dotenv").config();

const sendSMS = async (to, message) => {
  const apiKey = process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    console.error("❌ FAST2SMS_API_KEY missing in .env");
    throw new Error("SMS API key not configured");
  }

  try {
    const response = await axios.post(
      "https://www.fast2sms.com/dev/bulkV2",
      {
        sender_id: "TXTIND",
        message: message,
        language: "english",
        route: "v3",
        numbers: to,
      },
      {
        headers: {
          Authorization: apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.return !== true) {
      console.error("❌ SMS API Error:", response.data);
      throw new Error("Failed to send SMS");
    }

    console.log("✅ SMS sent successfully to", to);
    return response.data;
  } catch (error) {
    console.error("❌ SMS sending failed:", error.response?.data || error.message);
    throw new Error("Failed to send SMS");
  }
};

module.exports = sendSMS;

