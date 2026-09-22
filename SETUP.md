# Active Listener — Supabase setup

Active Listener runs as a single static `index.html`. Without keys it stores posts in the
browser (localStorage). Add a Supabase project and posts become shared across
everyone's phones. Nothing else in the app changes.

## 1. Create the project
- Go to [supabase.com](https://supabase.com) → **New project**. Pick a name and a
  strong database password. Wait ~2 min for it to provision.

## 2. Create the table
- Left sidebar → **SQL Editor** → **New query**.
- Paste the contents of **`supabase-schema.sql`** and click **Run**.
- This creates the `posts` table and the Row Level Security policies
  (public can read + create posts; the public key cannot edit or delete).

## 3. Get your keys
- Left sidebar → **Project Settings** → **API**.
- Copy two values:
  - **Project URL** — looks like `https://abcxyz.supabase.co`
  - **anon public** key — a long token under "Project API keys"
- Both are safe to ship in a static file. The anon key is public by design;
  RLS is what actually protects the data.

## 4. Paste them into `index.html`
Near the top of the `<script>` block (search for `backend config`):

```js
const SUPABASE_URL = 'https://abcxyz.supabase.co';
const SUPABASE_ANON_KEY = 'paste-the-anon-public-key-here';
```

Save and reload. On first load Active Listener auto-seeds Andrew's post into the table,
and the composer now publishes for everyone. The composer banner will say
"Connected to Supabase" when it's live.

## 5. Deploy
Any static host works (Netlify drag-and-drop, GitHub Pages, etc.). Because the
data lives in Supabase, every visitor sees the same feed and can publish to it.

---

## Lock-screen audio (background playback)

On-device TTS is paused by phones when the screen locks — there's no way around
that in a browser. To get **real background/lock-screen playback**, a post's text
is synthesized to an MP3 once, stored in Supabase Storage, and played through an
`<audio>` element wired to the OS lock-screen controls (MediaSession). Posts with
narration show **"Lock-screen ready 🔒"**; posts without it fall back to on-device
TTS. New posts get narration generated automatically at publish time.

### 1. Deploy the narration endpoint (keeps your TTS key server-side)
The function is already in the repo at **`supabase/functions/narrate/`** — it
proxies ElevenLabs or OpenAI, handles CORS, and chunks long posts. Deploy it:

```bash
supabase link --project-ref <your-project-ref>

# choose a provider and set its key:
supabase secrets set TTS_PROVIDER=elevenlabs
supabase secrets set ELEVENLABS_API_KEY=sk_...
#   — or —
supabase secrets set TTS_PROVIDER=openai
supabase secrets set OPENAI_API_KEY=sk-...

supabase functions deploy narrate --no-verify-jwt
```

Full details (voices, local serve, curl test) are in
`supabase/functions/narrate/README.md`.

### 2. Point Active Listener at it
In `index.html`, `narration config` block:
```js
const TTS_ENDPOINT = 'https://abcxyz.supabase.co/functions/v1/narrate';
const TTS_VOICE = 'aria';
```
`supabase-schema.sql` already creates the public `narration` storage bucket the
generated MP3s are written to. That's it — publish a post and it comes back with
lock-screen audio.

---

### Notes
- **Offline / key typo:** the app silently falls back to localStorage and shows
  a small "offline" note, so it never breaks.
- **Moderation / spam:** current policy lets anyone insert a post. When you're
  ready, add Supabase Auth and change the insert policy to
  `with check (auth.uid() is not null)` so only signed-in users can post, and add
  an owner column for edit/delete.
- **Schema fields** map 1:1 to a post object:
  `id, title, dek, author, initials, date, tags[], html`.
