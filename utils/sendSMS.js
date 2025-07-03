// utils/sendSMS.js
const axios = require('axios');

const sendSMS = async (message, numbers) => {
  try {
    const res = await axios.post('https://www.fast2sms.com/dev/bulk', null, {
      params: {
        authorization: process.env.FAST2SMS_API_KEY,
        sender_id: 'FSTSMS',
        message,
        language: 'english',
        route: 'q', // 'q' is for Quick SMS (Transactional)
        numbers: numbers.join(','),
      },
    });

    console.log('✅ SMS sent:', res.data);
  } catch (err) {
    console.error('❌ SMS sending failed:', err.response?.data || err.message);
  }
};

module.exports = sendSMS;

