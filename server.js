import express from 'express';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const PASSWORD = process.env.PASSWORD || 'workos';
const NYLAS_API_KEY          = process.env.NYLAS_API_KEY;
const NYLAS_GRANT_ID         = process.env.NYLAS_GRANT_ID;         // work account (nick@nylas.com) — free/busy + block
const NYLAS_EMAIL            = process.env.NYLAS_EMAIL;
const NYLAS_PERSONAL_GRANT_ID = process.env.NYLAS_PERSONAL_GRANT_ID; // personal account — real meeting + Meet link

function requireAuth(req, res, next) {
  const input = (req.headers['x-password'] || '').replace(/[\u201C\u201D\u2018\u2019"']/g, '').trim().toLowerCase();
  if (input !== PASSWORD.toLowerCase()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.post('/api/free-busy', requireAuth, async (req, res) => {
  const { start_time, end_time } = req.body;

  try {
    const response = await fetch(
      `https://api.us.nylas.com/v3/grants/${NYLAS_GRANT_ID}/calendars/free-busy`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NYLAS_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          start_time,
          end_time,
          emails: [NYLAS_EMAIL],
        }),
      }
    );

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Nylas API error:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

app.post('/api/book', requireAuth, async (req, res) => {
  const { start_time, end_time, title, description, name, email } = req.body;

  if (!start_time || !end_time || !title || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (typeof start_time !== 'number' || typeof end_time !== 'number' || end_time <= start_time) {
    return res.status(400).json({ error: 'Invalid time range' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }
  if (typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const safeTitle       = title.trim().slice(0, 200);
  const safeName        = (typeof name === 'string' ? name.trim().slice(0, 100) : '') || email;
  const safeDescription = typeof description === 'string' ? description.trim().slice(0, 2000) : '';

  const nylasHeaders = {
    'Authorization': `Bearer ${NYLAS_API_KEY}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  try {
    // 1. Create the real meeting from the personal account (participant invited, Google Meet attached)
    const meetingRes = await fetch(
      `https://api.us.nylas.com/v3/grants/${NYLAS_PERSONAL_GRANT_ID}/events?calendar_id=primary&notify_participants=true`,
      {
        method: 'POST',
        headers: nylasHeaders,
        body: JSON.stringify({
          title: safeTitle,
          description: safeDescription,
          when: { start_time, end_time },
          participants: [{ email, name: safeName }],
          conferencing: { provider: 'Google Meet', autocreate: {} },
        }),
      }
    );

    const meetingData = await meetingRes.json();
    if (!meetingRes.ok) {
      console.error('Nylas create meeting error:', meetingData);
      return res.status(meetingRes.status).json({ error: 'Failed to create meeting' });
    }

    // 2. Block the same slot on the work calendar so it shows as busy
    const blockRes = await fetch(
      `https://api.us.nylas.com/v3/grants/${NYLAS_GRANT_ID}/events?calendar_id=primary`,
      {
        method: 'POST',
        headers: nylasHeaders,
        body: JSON.stringify({
          title: 'Blocked',
          when: { start_time, end_time },
          visibility: 'private',
        }),
      }
    );

    if (!blockRes.ok) {
      const blockData = await blockRes.json();
      console.error('Nylas create block error:', blockData);
      // Non-fatal — meeting was created, just log the failure
    }

    res.json({ success: true, event: meetingData.data });
  } catch (error) {
    console.error('Book error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
