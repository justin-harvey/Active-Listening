# Aloud — Supabase setup

Aloud runs as a single static `index.html`. Without keys it stores posts in the
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

Save and reload. On first load Aloud auto-seeds Andrew's post into the table,
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

### 1. Deploy a narration endpoint (keeps your TTS key server-side)
Create a Supabase Edge Function that proxies a TTS provider. Example using
ElevenLabs (`supabase/functions/narrate/index.ts`):

```ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const VOICE = { aria: "9BWtsMINqrJLrRacOk9x" }; // map your names -> voice ids

Deno.serve(async (req) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const { text, voice } = await req.json();
  const id = VOICE[voice] ?? VOICE.aria;
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5" }),
  });
  return new Response(r.body, { headers: { ...cors, "Content-Type": "audio/mpeg" } });
});
```

Deploy + set the secret:
```
supabase functions deploy narrate --no-verify-jwt
supabase secrets set ELEVENLABS_API_KEY=sk_...
```
(Any provider works — OpenAI `tts-1`, Google, Azure — as long as the function
returns `audio/mpeg`.)

### 2. Point Aloud at it
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
