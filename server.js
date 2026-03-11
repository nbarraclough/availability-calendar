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
const NYLAS_API_KEY = process.env.NYLAS_API_KEY;
const NYLAS_GRANT_ID = process.env.NYLAS_GRANT_ID;
const NYLAS_EMAIL = process.env.NYLAS_EMAIL;
const NYLAS_CALENDAR_ID = 'primary';

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

  try {
    const url = `https://api.us.nylas.com/v3/grants/${NYLAS_GRANT_ID}/events`
      + `?calendar_id=${encodeURIComponent(NYLAS_CALENDAR_ID)}&notify_participants=true`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NYLAS_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        title: safeTitle,
        description: safeDescription,
        when: { start_time, end_time },
        participants: [{ email, name: safeName }],
        conferencing: { provider: 'Google Meet', autocreate: {} },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Nylas create event error:', data);
      return res.status(response.status).json({ error: 'Failed to create event' });
    }

    res.json({ success: true, event: data.data });
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
