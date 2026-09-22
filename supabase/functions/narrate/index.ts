// =====================================================================
// Aloud — `narrate` Edge Function
// ---------------------------------------------------------------------
// Turns a post's text into an MP3 so it can play with the screen locked.
// The browser POSTs { text, voice }; this returns audio/mpeg. Your TTS
// provider key stays here on the server, never in the static page.
//
// Deploy:
//   supabase functions deploy narrate --no-verify-jwt
// Secrets (set the one you use):
//   supabase secrets set TTS_PROVIDER=elevenlabs
//   supabase secrets set ELEVENLABS_API_KEY=sk_...
//   # or
//   supabase secrets set TTS_PROVIDER=openai
//   supabase secrets set OPENAI_API_KEY=sk-...
// Optional:
//   supabase secrets set CORS_ORIGIN=https://your-aloud-site.com   (default *)
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const PROVIDER = (Deno.env.get("TTS_PROVIDER") ?? "elevenlabs").toLowerCase();
const CORS_ORIGIN = Deno.env.get("CORS_ORIGIN") ?? "*";

const cors = {
  "Access-Control-Allow-Origin": CORS_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ---- voice name -> provider voice id -------------------------------------
// The static app sends a friendly name (e.g. "aria"). Map it per provider;
// an unknown name is passed straight through so you can send raw ids too.
const ELEVEN_VOICES: Record<string, string> = {
  aria: "9BWtsMINqrJLrRacOk9x",
  roger: "CwhRBWXzGAHq8TQ4Fs17",
  sarah: "EXAVITQu4vr4xnSDxMaL",
  george: "JBFqnCBsd6RMkjVDRZzb",
};
const OPENAI_VOICES: Record<string, string> = {
  aria: "nova", roger: "onyx", sarah: "shimmer", george: "fable",
  alloy: "alloy", echo: "echo", fable: "fable", onyx: "onyx", nova: "nova", shimmer: "shimmer",
};

// Provider per-request text ceilings (chunk below these).
const CHUNK_LIMIT = PROVIDER === "openai" ? 3800 : 2500;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return json({ error: "POST { text, voice }" }, 405);
  }

  let body: { text?: string; voice?: string };
  try { body = await req.json(); }
  catch { return json({ error: "invalid JSON body" }, 400); }

  const text = (body.text ?? "").trim();
  const voice = (body.voice ?? "aria").trim();
  if (!text) return json({ error: "no text" }, 400);

  try {
    const chunks = chunkText(text, CHUNK_LIMIT);
    const parts: Uint8Array[] = [];
    for (const chunk of chunks) {
      parts.push(await synth(chunk, voice));
    }
    return new Response(concat(parts), {
      headers: { ...cors, "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000" },
    });
  } catch (e) {
    console.error("narrate failed:", e);
    return json({ error: String(e?.message ?? e) }, 502);
  }
});

// ---- providers -----------------------------------------------------------
async function synth(text: string, voice: string): Promise<Uint8Array> {
  if (PROVIDER === "openai") return synthOpenAI(text, voice);
  return synthElevenLabs(text, voice);
}

async function synthElevenLabs(text: string, voice: string): Promise<Uint8Array> {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) throw new Error("ELEVENLABS_API_KEY not set");
  const id = ELEVEN_VOICES[voice] ?? voice; // allow raw voice ids
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!r.ok) throw new Error(`ElevenLabs ${r.status}: ${await r.text()}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function synthOpenAI(text: string, voice: string): Promise<Uint8Array> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY not set");
  const v = OPENAI_VOICES[voice] ?? "nova";
  const r = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "tts-1", voice: v, input: text, response_format: "mp3" }),
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  return new Uint8Array(await r.arrayBuffer());
}

// ---- helpers -------------------------------------------------------------
// Split into chunks under `limit` chars on paragraph, then sentence, then
// hard boundaries — so long essays synthesize in order and concatenate.
function chunkText(text: string, limit: number): string[] {
  const chunks: string[] = [];
  let buf = "";
  const flush = () => { if (buf.trim()) chunks.push(buf.trim()); buf = ""; };

  for (const para of text.split(/\n{2,}/)) {
    for (const piece of splitToLimit(para, limit)) {
      if ((buf + "\n\n" + piece).length > limit) flush();
      buf = buf ? buf + "\n\n" + piece : piece;
    }
  }
  flush();
  return chunks.length ? chunks : [text.slice(0, limit)];
}

function splitToLimit(s: string, limit: number): string[] {
  if (s.length <= limit) return [s];
  const out: string[] = [];
  let buf = "";
  for (const sentence of s.match(/[^.!?]+[.!?]*\s*/g) ?? [s]) {
    if (sentence.length > limit) {
      if (buf) { out.push(buf); buf = ""; }
      for (let i = 0; i < sentence.length; i += limit) out.push(sentence.slice(i, i + limit));
      continue;
    }
    if ((buf + sentence).length > limit) { out.push(buf); buf = sentence; }
    else buf += sentence;
  }
  if (buf) out.push(buf);
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
