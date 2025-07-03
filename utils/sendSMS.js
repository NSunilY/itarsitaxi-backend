// utils/sendSMS.js
const axios = require('axios');

const sendSMS = async (number, message) => {
  try {
    const response = await axios.post(
      'https://www.fast2sms.com/dev/bulkV2',
      {
        message,
        language: 'english', // ✅ Force English language
        route: 'q',          // ✅ Quick SMS route
        numbers: number,     // ✅ Should be comma-separated string or plain number
      },
      {
        headers: {
          authorization: process.env.FAST2SMS_API_KEY,
        },
      }
    );

    console.log(`✅ SMS sent to ${number}:`, response.data);
  } catch (error) {
    console.error(`❌ SMS sending failed to ${number}:`, error.response?.data || error.message);
  }
};

module.exports = sendSMS;

