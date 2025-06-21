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
    const response = await axios({
      method: "POST",
      url: "https://www.fast2sms.com/dev/api", // ✅ latest endpoint
      headers: {
        authorization: apiKey,
        "Content-Type": "application/json",
      },
      data: {
        route: "q", // 'q' is quick route; use 'v3' if your account allows it
        message: message,
        language: "english",
        flash: 0,
        numbers: to,
      },
    });

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

