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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;
