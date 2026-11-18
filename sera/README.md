# Sera mobile app

React Native app built with Expo Router. The Assistant screen sends authenticated
messages to the API, polls the task run, and renders the saved reply as Markdown.

## Run with the local backend

From the repository root, run these in separate terminals:

```bash
npm run dev
```

```bash
npm run worker
```

The API listens on port `3333`. The worker processes queued messages; both need
access to the configured PostgreSQL database, and the worker needs `GROQ_API_KEY`.
Web searches also need the configured SearXNG service.

For an Android emulator or a device connected through ADB:

```bash
adb reverse tcp:3333 tcp:3333
```

Then start the mobile app from this directory:

```bash
npx expo start
```

Use a Sera development build for native Google sign-in. The app restores the saved
session, or shows sign-in when no valid session is available. UI preview mode in
`config/development.ts` is disabled for backend testing.

## API address

The default is `http://localhost:3333`, which works on Android with the ADB port
forward above. Repeat the forwarding command after reconnecting the device.

For a device testing over Wi-Fi, set `EXPO_PUBLIC_API_URL` in the mobile `.env` to
a reachable backend URL, then restart Metro. The Google Web client ID belongs in
`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`; it must match the backend's `GOOGLE_CLIENT_ID`.

## Chat behavior

The first message creates a conversation and a run. Later messages use that same
conversation. The app polls the run for its status and answer, pauses polling in
the background, and resumes when active. A failed status check can be retried
without submitting the message again. The new-chat button starts a separate
conversation once the current request finishes.

Conversation history restoration and passing earlier messages to the model are
not implemented yet. Closing the app loses the screen's current conversation,
but accepted requests and messages remain stored on the backend.
