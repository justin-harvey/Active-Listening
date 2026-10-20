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

## DONE (2026-10-19): author accounts + edit/delete (`build 2026-10-19d`)
Posts now belong to a signed-in author who can edit and delete them. This was built
after a post's text was lost to a reformat with no way to recover it.

- **Auth:** Supabase email+password. `currentUser` holds the session; `initAuth()`
  reads the session on boot and subscribes to `onAuthStateChange`. Login screen at
  `#/login` (`renderLogin`/`submitAuth`, sign-in + sign-up with display_name in user
  metadata). Nav has a `#navAuth` slot (`renderAuthUI`): shows author name + Sign out,
  or a Sign in button. Reading stays fully public; writing/editing/deleting need a session.
- **Ownership:** new `posts.user_id uuid` (→ auth.users) + `posts.source text` (raw
  composer text so a post can be reopened and edited). `COLS` updated. RLS is now
  **public read, owner-only insert/update/delete** (`auth.uid() = user_id`).
- **Composer:** `renderComposer(editId?)` is async, gated behind login (shows "Sign in
  to write" when logged out). Edit route `#/edit/:id` prefills from `source` (or
  `htmlToSource(html)` for legacy posts like the seed). `publish(editId?)` mints a new
  post or updates the existing one; always writes `source` + `user_id`. On edit, leaving
  the audio field empty keeps the existing recording.
- **Edit/Delete:** the reader byline shows Edit + Delete buttons only on posts you own
  (`store.update` / `store.remove`; delete has a confirm). Legacy/seed rows (no user_id)
  are read-only.
- **REQUIRES the migration** (storage section already run earlier; now also run the
  posts section of `supabase-schema.sql`): adds user_id/source + the owner RLS policies.
  Until it's run, publishing breaks (missing columns / insert policy). Also recommend
  Supabase → Auth → Providers → Email → uncheck "Confirm email" so signups are instant.
- Verified: client-side flows (gating, login UI, owner-action visibility, html↔source
  round-trip) all green locally with no console errors. Full cloud E2E (signup→publish
  →edit→delete) pending the migration being applied.

Not built (offered, declined for now): autosave drafts, post version history.

---

## DONE (2026-10-19): author audio upload in the composer
Authors can now attach their own recording when they write a post. Shipped and
verified end-to-end on the live site (`build 2026-10-19a · author-audio-upload`).

- **UI:** optional "Narration audio" file field on `#/new` (accepts mp3/m4a/aac/ogg/wav),
  shows file name + size, rejects >50 MB (`AUDIO_MAX_MB`), disabled when no cloud.
- **Publish flow:** `publish()` calls `uploadAuthorAudio(post, file)` → uploads to the
  `narration` Storage bucket at `author/<post-id>.<ext>` → sets `post.audio_url` to the
  public URL. An uploaded file takes priority over any auto-synth; failure falls back to
  text-only with a toast (never blocks publishing).
- **Reader:** the "Author's recording" / "Read it to me" engine toggle (`#enginePick`)
  renders **only when `post.audio_url` exists** — text-only posts show no toggle (by design).
- **Supabase Storage bucket `narration` now EXISTS** (public, with read+write policies) —
  the storage section of `supabase-schema.sql` was run on 2026-10-19. The old
  "bucket not created" caveat above is resolved.

Remaining idea: auto-generate a spoken version for text-only posts (server TTS via
`TTS_ENDPOINT` → Piper on TrueNAS) so they could also offer a "play audio" option.

---

## (ORIGINAL) NEXT TASK: upload an audio file of the author reading the essay
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
