# Availability Calendar

A simple web app that shows your free/busy availability in a weekly calendar view, without exposing any calendar event details. Built to share scheduling availability with external teams.

## How it works

- Visitors enter a shared password to access the calendar
- The app displays a Monday–Friday grid showing 30-minute time slots
- Slots are marked as **available** (green), **busy** (grey), or **passed** (faded) based on live calendar data
- The calendar is anchored to your working hours (9am–6pm MST) but displayed in the visitor's local timezone, which they can override
- A "Copy available times" button lets visitors copy a formatted list of your open windows to their clipboard, ready to paste into an email or message

## Why Nylas

We use the [Nylas free/busy API endpoint](https://developer.nylas.com/docs/v3/calendar/check-free-busy/) to fetch availability. This is a deliberate choice:

- **Privacy**: The free/busy endpoint only returns time blocks marked as busy — it never reveals event titles, descriptions, attendees, or any other calendar content
- **Simplicity**: A single API call returns everything we need for the entire week
- **Provider-agnostic**: Nylas connects to Google Calendar, Microsoft Outlook, and other providers through a single API, so this works regardless of which calendar you use

## Tech stack

- **Backend**: Node.js + Express — proxies requests to the Nylas API, keeping the API key and grant ID server-side
- **Frontend**: Single HTML file with vanilla CSS and JavaScript — no build step, no framework
- **Deployment**: Vercel (serverless)

## Setup

### Prerequisites

- Node.js 18+
- A [Nylas](https://www.nylas.com/) account with API v3 access
- A connected grant (Google, Microsoft, etc.)

### Environment variables

Create a `.env` file in the project root:

```
NYLAS_API_KEY=your_nylas_api_key
NYLAS_GRANT_ID=your_nylas_grant_id
NYLAS_EMAIL=your_email@example.com
PASSWORD=your_shared_password
```

| Variable | Description |
|---|---|
| `NYLAS_API_KEY` | Your Nylas API key (from the Nylas dashboard) |
| `NYLAS_GRANT_ID` | The grant ID for the connected calendar account |
| `NYLAS_EMAIL` | The email address associated with the grant |
| `PASSWORD` | The password visitors need to enter (case-insensitive) |

### Run locally

```bash
npm install
npm start
```

Open http://localhost:3000.

### Deploy to Vercel

1. Push the repo to GitHub
2. Connect the repo in [Vercel](https://vercel.com/)
3. Add the four environment variables above in Vercel's project settings
4. Deploy — Vercel auto-deploys on every push to `main`

The included `vercel.json` handles the serverless routing. No additional configuration needed.

## Configuration

Working hours and timezone are defined in `public/index.html`:

```javascript
const WORK_TZ = 'America/Denver';
const WORK_START = 9;  // 9am
const WORK_END = 18;   // 6pm
```

Change these to adjust which hours are shown in the calendar grid.
