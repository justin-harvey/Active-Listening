# narrate — Active Listener narration endpoint

Synthesizes a post's text into an MP3 for lock-screen / background playback.
The static app POSTs `{ text, voice }` and gets back `audio/mpeg`. Your TTS
provider key stays in function secrets, never in the browser.

## Deploy

```bash
# from the repo root, once:
supabase link --project-ref <your-project-ref>

# pick a provider and set its key:
supabase secrets set TTS_PROVIDER=elevenlabs
supabase secrets set ELEVENLABS_API_KEY=sk_...
#   — or —
supabase secrets set TTS_PROVIDER=openai
supabase secrets set OPENAI_API_KEY=sk-...

# optional: lock CORS to your site (default is *)
supabase secrets set CORS_ORIGIN=https://your-aloud-site.com

# ship it:
supabase functions deploy narrate --no-verify-jwt
```

Your endpoint URL will be:
`https://<project-ref>.supabase.co/functions/v1/narrate`

Put that in `index.html` → `const TTS_ENDPOINT = '...'`.

## Test

```bash
curl -X POST https://<project-ref>.supabase.co/functions/v1/narrate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello from Active Listener.","voice":"aria"}' \
  --output test.mp3
```

## Run locally

```bash
supabase functions serve narrate --no-verify-jwt --env-file supabase/functions/narrate/.env
# then POST to http://localhost:54321/functions/v1/narrate
```

## Notes

- **Providers:** `elevenlabs` (default) or `openai`. Any provider works if it
  returns `audio/mpeg`; add a branch in `synth()`.
- **Voices:** the app sends a friendly name (`aria`, `roger`, `sarah`, `george`),
  mapped per provider in `index.ts`. Unknown names pass through, so you can also
  send a raw provider voice id.
- **Long posts:** text is chunked under the provider's per-request limit on
  paragraph/sentence boundaries and the MP3 parts are concatenated, so full
  essays synthesize in order.
