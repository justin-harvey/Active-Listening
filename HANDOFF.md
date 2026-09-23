# Active Listener — Handoff

_Last updated: 2026-09-23_

## What it is
A static, single-file publish-and-listen app. Post a thought; anyone can press
play and have it read aloud, hands-free. Built for listening while multitasking.

- **Live:** https://active-listener.netlify.app/
- **Repo:** https://github.com/justin-harvey/Active-Listening (branch `main`)
- **Deploy:** Netlify auto-deploys on every push to `main`. No build step.
- **Everything is in `index.html`** (one file: HTML + CSS + JS, hash-routed SPA).
  Supporting files: `supabase-schema.sql`, `SETUP.md`, `README.md`, `netlify.toml`,
  `supabase/functions/narrate/` (Edge Function, not deployed).

## Deploy workflow
- Edit `index.html` → commit → `git push` → Netlify rebuilds (~15–60s).
- Push auth: paste a GitHub PAT inline in the push URL each time
  (`git push https://x-access-token:<PAT>@github.com/justin-harvey/Active-Listening.git main`).
  Do NOT persist the token to git config.
- **Build stamp:** footer shows `const BUILD` (e.g. `build 2026-09-23b · seed-from-code`).
  Bump it on meaningful changes so the running version is identifiable.
- `netlify.toml` sends `Cache-Control: no-cache` on HTML so a new deploy is never
  masked by a cached `index.html`.
- **Debug:** append `?debug=1` to the URL for an on-screen speech-event log (copy button).

## Architecture (in `index.html`)
- **Routes:** `#/` feed · `#/post/:id` reader · `#/new` composer (the CMS).
- **Data layer = `store`** (`all` / `get` / `add`, all async):
  - Backed by **Supabase** when configured, with a **localStorage fallback**.
  - `SEED` = array holding the flagship post (Andrew Word's essay). `ANDREW_HTML`
    is the essay body (verbatim, ~4,214 rendered words incl. nav labels).
  - **Seeds are canonical from CODE.** `store.get()` returns the `SEED` post for a
    seed id before any cache/cloud lookup; `store.all()` runs `refreshSeeds()` over
    cloud rows so a stored copy can never override the code version.
- **Word count / times are automatic**: `wordsOf(post.html)` → `readMin` (÷238),
  `listenMin` (÷150). Computed live on every render for every post.

## Supabase (already wired)
- Project URL + anon key are set at the top of the `<script>` (`SUPABASE_URL`,
  `SUPABASE_ANON_KEY`). Anon key is public by design; RLS protects data.
- **Table `posts` exists.** RLS currently: public **select + insert only**
  (no update/delete via anon). Columns: `id,title,dek,author,initials,date,tags,html,audio_url,created_at`.
- Storage bucket `narration` is defined in `supabase-schema.sql` but was **NOT**
  created (only the minimal posts-table SQL was run). Create it if you use Storage.

## Voice / playback — current state
The player is **dual-engine**, selected per post in `player.mount(post)`:
- **TTS engine (current default):** on-device Web Speech. Speaks **one sentence at
  a time** (`splitSentences`) to avoid iOS Safari stalling at the first period;
  prefers on-device voices; watchdog + error recovery; `?debug=1` traces it.
  Needs OS voices (phones/Mac/Windows have them; Linux desktop may not).
- **Audio engine (built, dormant):** if a post has `audio_url`, `mount()` calls
  `enableAudio(url)` and plays the file through one shared `<audio>` element wired
  to the **MediaSession API** → real background/lock-screen playback, transport
  controls, seek bar, and auto-generated cover art (`makeCover`).
- `TTS_ENDPOINT` (server narration, e.g. self-hosted Piper on TrueNAS) and the free
  StreamElements POC (`SE_ENABLED`) are both **off**. StreamElements' keyless
  endpoint now 401s — dead. `canGenerate` is false, so the 🔒 generate button is hidden.

## History worth knowing (so it isn't re-debugged)
- **"Essay was short" (resolved):** an early abridged build had written the
  ~2,100-word essay into the Supabase `posts` row; the app read that stale cloud
  row. Fixed by making seeds code-canonical (above). A stale row may still sit in
  the DB (harmless/ignored). Optional cleanup: `delete from public.posts where id='andrew-quiet-conversation';`
- Essay text was verified against `/home/nah/Downloads/wealth.docx` (97% 6-word
  shingle match; the gap is video URLs in link attributes + paragraph seams). It
  is the complete verbatim document.

---

## NEXT TASK: upload an audio file of the author reading the essay
The audio engine already exists — this is exactly what it was built for. Steps:

1. **Host the MP3 at a public URL.** Options:
   - **Simplest:** commit the file into the repo, e.g. `audio/the-same-quiet-conversation.mp3`,
     and reference it relatively (`audio/the-same-quiet-conversation.mp3`) — Netlify serves it.
   - **Supabase Storage:** create a public `narration` bucket (run the storage
     section of `supabase-schema.sql` or make it in the dashboard), upload, use the
     public URL.
2. **Attach it to the essay in code** — because seeds are code-canonical, add an
   `audio_url` to the `SEED` post object (the one with `id: 'andrew-quiet-conversation'`):
   ```js
   { id:'andrew-quiet-conversation', title:'…', /* … */, html: ANDREW_HTML,
     audio_url: 'audio/the-same-quiet-conversation.mp3' }
   ```
3. **That's it.** On load, `mount()` sees `audio_url` → `enableAudio()` → the reader
   switches to "Narrated audio", plays the real recording with lock-screen controls,
   speed, skip, and seek. Bump `BUILD`, commit, push.

**Notes / expectations:**
- The follow-along sentence highlight only works in TTS mode (no timestamps for an
  arbitrary recording) — the recording just plays as one seekable track. Fine/expected.
- Lock-screen cover art is auto-generated from the post (title + author).
- Keep the MP3 a sane size/bitrate (e.g. ~64–96 kbps mono for speech).
- This attaches audio to the *seed*. Giving every user-written post its own audio is
  a separate future path (server TTS via `TTS_ENDPOINT` → Piper on TrueNAS).
