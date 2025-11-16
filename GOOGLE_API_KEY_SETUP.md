# Google API Key Setup for FreeBusy API

## Why We Need This

The FreeBusy API allows viewers to see when a calendar owner is busy **without requiring authentication**. This is perfect for sharing availability because:

- Viewers don't need to log in
- No OAuth tokens required
- Privacy-preserving (only shows busy/free times, not event details)
- Works with public calendars

## Setup Steps

### 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**

### 2. Create an API Key

1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the generated API key
4. (Optional) Restrict the key to only allow Calendar API requests

### 3. Add API Key to Code

Replace the placeholder in `src/frontend/utils/googleFreeBusy.ts`:

```typescript
const GOOGLE_API_KEY = "YOUR_ACTUAL_API_KEY_HERE";
```

### 4. Make Owner's Calendar Public

For the FreeBusy API to work, the calendar owner must make their calendar public:

**Option A: Via Google Calendar UI**

1. Open Google Calendar
2. Settings > Settings for my calendars > [Your Calendar]
3. Access permissions > Check "Make available to public"

**Option B: Via API (Automated)**

```typescript
await fetch(
  `https://www.googleapis.com/calendar/v3/calendars/${ownerEmail}/acl`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      role: "reader",
      scope: { type: "default" }, // Makes calendar public
    }),
  },
);
```

## How It Works

1. **Owner creates availability** → Stores their email in the availability
2. **Owner shares link** → Link contains availability ID
3. **Viewer opens link** → Frontend calls FreeBusy API with owner's email
4. **FreeBusy API returns busy times** → Displayed as gray "Busy" blocks
5. **Privacy preserved** → Viewer sees WHEN owner is busy, not WHAT they're doing

## Testing

To test if the API key works:

```bash
curl -X POST \
  "https://www.googleapis.com/calendar/v3/freeBusy?key=YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "timeMin": "2024-01-01T00:00:00Z",
    "timeMax": "2024-12-31T23:59:59Z",
    "items": [{"id": "test@gmail.com"}]
  }'
```

## Security Notes

- The API key is **safe to expose** in frontend code
- It only allows reading public calendar busy/free times
- No sensitive data or write operations are possible
- Consider adding HTTP referrer restrictions in Google Cloud Console
