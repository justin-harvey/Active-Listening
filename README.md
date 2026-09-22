# Active Listener

**Thoughts, read out loud.** A place to post what's on your mind and let anyone
listen — press play and it reads aloud, hands-free, while you drive, walk, or train.

Single static `index.html` (no build step). Three views via hash routing:

- **Feed** `#/` — posts with prominent tags and listen/read length
- **Reader** `#/post/:id` — clean reading layout + a "Read this to me" banner
  (play, skip, speed, voice picker, chapter jump, follow-along highlight)
- **Composer** `#/new` — a lightweight CMS: anyone writes a post and publishes it

## Playback

- **On-device TTS** — the reader uses the Web Speech API with the best voice
  installed on the listener's device. Works everywhere, screen-on.
- **Lock-screen audio** — when a narration MP3 is generated for a post, it plays
  through an `<audio>` element wired to the OS **MediaSession**: real background
  playback that survives a locked screen, with lock-screen transport controls,
  cover art, and a seek bar.

## Backend

Posts and narration live in **Supabase** (with an automatic localStorage
fallback so the file runs before you add keys). See **[SETUP.md](SETUP.md)** for
the walkthrough and **[supabase-schema.sql](supabase-schema.sql)** for the table,
Row Level Security policies, and the narration storage bucket.

Configure at the top of the `<script>` in `index.html`:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
const TTS_ENDPOINT = ''; // narration endpoint for lock-screen audio (optional)
```

## Deploy

Any static host — Netlify drag-and-drop, GitHub Pages, etc. Data is in Supabase,
so every visitor sees the same feed and can publish to it.

---

Seeded with the first post, *The Same Quiet Conversation* by Andrew Word.
