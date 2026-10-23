require('dotenv').config();
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const COIN_PACKAGES = {
  'starter': { name: 'Starter Pack (50 Coins)', amount: 200, coins: 50 },
  'pro': { name: 'Pro Pack (150 Coins)', amount: 500, coins: 150 },
  'champion': { name: 'Champion Pack (500 Coins)', amount: 1300, coins: 500 },
  'weekly_pass': { name: 'Weekly Tournament Pass', amount: 300, coins: 0 }
};

async function getMpesaAccessToken(req, res, next) {
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

  try {
    const response = await axios.get(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}` } }
    );
    req.mpesaAccessToken = response.data.access_token;
    next();
  } catch (error) {
    console.error('M-Pesa Auth Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to authenticate with Safaricom M-Pesa.' });
  }
}

app.post('/api/mpesa-checkout', getMpesaAccessToken, async (req, res) => {
  try {
    const { phone, packageId } = req.body;
    const pkg = COIN_PACKAGES[packageId];
    if (!pkg) return res.status(400).json({ error: 'Invalid package selected.' });

    const date = new Date();
    const timestamp = date.getFullYear().toString() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0') +
      String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0') +
      String(date.getSeconds()).padStart(2, '0');

    const shortCode = process.env.MPESA_SHORTCODE || '174379';
    const passkey = process.env.MPESA_PASSKEY;
    const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');

    const payload = {
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: pkg.amount,
      PartyA: phone,
      PartyB: shortCode,
      PhoneNumber: phone,
      CallBackURL: 'https://example.com/api/mpesa-callback',
      AccountReference: 'TriviaClash',
      TransactionDesc: `Purchase ${pkg.name}`
    };

    const response = await axios.post(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      payload,
      { headers: { Authorization: `Bearer ${req.mpesaAccessToken}` } }
    );

    res.json({ success: true, message: 'STK push initiated.', coins: pkg.coins, data: response.data });
  } catch (error) {
    console.error('STK Push Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to trigger M-Pesa STK push.' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
