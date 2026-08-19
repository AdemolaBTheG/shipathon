# Joylogue Link Resolver

The resolver turns public TikTok and Instagram links into structured game-title detections. It runs as a private authenticated worker behind the Expo Router API routes.

The worker first extracts platform metadata with `yt-dlp`, oEmbed, and Open Graph tags. When possible, it downloads a bounded copy of the public video, uploads it to Gemini's Files API, and asks Gemini to identify the exact released game from both visual and audio evidence. If media extraction fails, it falls back to metadata-only detection.

## Runtime requirements

- Node.js 20 or newer
- `yt-dlp`
- `ffmpeg`
- A Gemini API key
- A long random bearer token shared only with the Expo server

## API

- `GET /healthz`
- `POST /v1/jobs` with `{ "url": "https://..." }`
- `GET /v1/jobs/:id`

All `/v1` endpoints require `Authorization: Bearer <RESOLVER_API_TOKEN>`.
