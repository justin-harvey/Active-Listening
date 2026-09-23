# Active Listener

**🔊 Live:** https://active-listener.netlify.app/

**Hear what people are thinking.** A place to post what's on your mind and let
anyone listen — press play and it's read aloud, hands-free, while you drive,
walk, or train. Built for listening to other people's thoughts while you
multitask.

Single static `index.html` (no build step). Three views via hash routing:

- **Feed** `#/` — posts with prominent tags and listen/read length
- **Reader** `#/post/:id` — clean reading layout + a "Read this to me" banner
  (play, skip, speed, voice picker, chapter jump, follow-along highlight)
- **Composer** `#/new` — a lightweight CMS: anyone writes a post and publishes it

## Voice

- **On-device screen reader** — the reader speaks with the Web Speech API, using
  the best voice installed on the listener's device. It prefers **on-device**
  voices (cloud voices can fail silently) and reads **one sentence at a time**,
  which keeps iOS Safari from stalling at the first period. No key, no server.
  - Phones, Mac, and Windows ship voices out of the box. Linux desktop often
    has none — install one with `sudo apt install speech-dispatcher espeak-ng`
    and restart the browser.
- **Lock-screen audio (optional, dormant)** — the player also has an audio
  engine wired to the OS **MediaSession** (background playback, lock-screen
  controls, cover art, seek). It activates when a post has a narration MP3, which
  a server TTS endpoint generates. Point `TTS_ENDPOINT` at a self-hosted
  [Piper](https://github.com/rhasspy/piper) backend to turn it on — see
  [SETUP.md](SETUP.md).

## Backend / CMS

Posts live in **Supabase** (with an automatic localStorage fallback so the file
runs before any keys are set). Publishing writes to a shared `posts` table, so
every visitor sees the same feed. See **[SETUP.md](SETUP.md)** for the
walkthrough and **[supabase-schema.sql](supabase-schema.sql)** for the table and
Row Level Security policies.

Configure at the top of the `<script>` in `index.html`:

```js
const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR-ANON-PUBLIC-KEY';
const TTS_ENDPOINT = ''; // narration endpoint for lock-screen audio (optional)
```

## Deploy

Hosted on **Netlify** at https://active-listener.netlify.app/. Any static host
works — it's a single `index.html`. Data is in Supabase, so every visitor sees
the same feed and can publish to it.

## Debugging the reader

Add `?debug=1` to the URL to show an on-screen speech log (voice chosen, each
sentence, start/end/error, watchdog, live speaking state) with a copy button —
handy for diagnosing TTS on a phone. Turn it off with `?debug=0`.

---

Seeded with the first post, *The Same Quiet Conversation* by Andrew Word.
