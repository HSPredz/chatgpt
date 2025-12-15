require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const BASE_URL = 'https://api.mail.tm';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 5000;

// Generate random string
function randomString(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyz1234567890';
    let str = '';
    for (let i = 0; i < length; i++) str += chars[Math.floor(Math.random() * chars.length)];
    return str;
}

// Monitor inbox by polling
async function monitorInbox(token, email) {
    console.log(`Started monitoring inbox: ${email}`);
    const headers = { Authorization: `Bearer ${token}` };
    const seenMessages = new Set();

    setInterval(async () => {
        try {
            const res = await axios.get(`${BASE_URL}/messages`, { headers });
            const messages = res.data['hydra:member'];

            for (const msg of messages) {
                if (!seenMessages.has(msg.id)) {
                    seenMessages.add(msg.id);

                    // Fetch full email body
                    const fullMsgRes = await axios.get(`${BASE_URL}/messages/${msg.id}`, { headers });
                    const fullMsg = fullMsgRes.data;

                    console.log(`\nNew email for ${email}:\nFrom: ${fullMsg.from.address}\nSubject: ${fullMsg.subject}\nBody:\n${fullMsg.text}\n`);
                }
            }
        } catch (err) {
            console.error(`Inbox error for ${email}:`, err.response?.data || err.message);
        }
    }, POLL_INTERVAL);
}

// Root route for browser testing
app.get('/', (req, res) => {
    res.send('Mail.tm backend is running. gwn fella');
});

// Create account endpoint
app.post('/create-account', async (req, res) => {
    try {
        // Get available domain
        const domainRes = await axios.get(`${BASE_URL}/domains`);
        const domains = domainRes.data['hydra:member'];
        if (!domains || domains.length === 0) {
            return res.status(500).json({ error: 'No mail.tm domains available' });
        }
        const domain = domains[0].domain;

        // Generate email and password
        const email = `${randomString(8)}@${domain}`;
        const password = randomString(12);

        // Create account
        await axios.post(`${BASE_URL}/accounts`, { address: email, password });

        // Get token
        const tokenRes = await axios.post(`${BASE_URL}/token`, { address: email, password });
        const token = tokenRes.data.token;

        // Start inbox monitoring
        monitorInbox(token, email);

        res.json({
            email,
            password,
            token,
            status: 'Account created and inbox monitoring started'
        });
    } catch (err) {
        console.error('Error details:', err.response?.data || err.message);
        res.status(500).json({ error: err.response?.data || err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

