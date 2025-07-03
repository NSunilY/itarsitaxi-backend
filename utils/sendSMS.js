// utils/sendSMS.js
const axios = require('axios');

const sendSMS = async (mobile, message) => {
  try {
    const response = await axios.get('https://www.fast2sms.com/dev/bulkV2', {
      params: {
        authorization: process.env.FAST2SMS_API_KEY,
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: mobile,
      },
    });

    console.log(`✅ SMS sent to ${mobile}:`, response.data);
  } catch (error) {
    console.error(`❌ SMS sending failed to ${mobile}:`, error.response?.data || error.message);
  }
};

module.exports = sendSMS;

