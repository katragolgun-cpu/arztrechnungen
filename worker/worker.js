// Cloudflare Worker: KI-Hilfe für die App „PKV & Beihilfe“
// Nimmt Text (z. B. aus einem Bescheid) entgegen und fragt Workers AI.
// Schutz: nur die eigene App-Adresse (Origin) und ein geheimer Schlüssel (APP_KEY, im Dashboard als Secret gesetzt).

const ORIGIN = "https://katragolgun-cpu.github.io";
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_INPUT = 12000; // Zeichen, damit das Gratis-Kontingent reicht

const SYSTEM = `Du hilfst einer Familie in Deutschland bei Arztrechnungen.
Die Familie ist bei der Beihilfe des Bundes (BVA) und privat bei AXA versichert.
Antworte immer auf Deutsch, kurz und klar, ohne Emojis.
Erfinde nichts. Wenn etwas im Text nicht steht, sage das.
Gib zuerst den nächsten konkreten Schritt an, dann eine kurze Begründung.`;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": origin === ORIGIN ? ORIGIN : "null",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-App-Key",
    "Access-Control-Max-Age": "86400",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const h = cors(origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: h });
    if (request.method !== "POST") return new Response("Nur POST", { status: 405, headers: h });
    if (origin !== ORIGIN) return new Response("Nicht erlaubt", { status: 403, headers: h });
    if (!env.APP_KEY || request.headers.get("X-App-Key") !== env.APP_KEY)
      return new Response("Schlüssel fehlt oder falsch", { status: 401, headers: h });

    let body;
    try { body = await request.json(); } catch { return new Response("Ungültige Anfrage", { status: 400, headers: h }); }
    const question = String(body.question || "").slice(0, 4000);
    const context = String(body.context || "").slice(0, MAX_INPUT);
    if (!question) return new Response("Frage fehlt", { status: 400, headers: h });

    const messages = [
      { role: "system", content: SYSTEM },
      { role: "user", content: (context ? `Unterlagen:\n${context}\n\n` : "") + `Frage: ${question}` },
    ];
    try {
      const maxTokens = Math.min(1500, Math.max(100, Number(body.max_tokens) || 600));
      const r = await env.AI.run(MODEL, { messages, max_tokens: maxTokens, temperature: 0.2 });
      return new Response(JSON.stringify({ answer: r.response || "" }), {
        headers: { ...h, "Content-Type": "application/json; charset=utf-8" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: String(e.message || e) }), {
        status: 502, headers: { ...h, "Content-Type": "application/json; charset=utf-8" },
      });
    }
  },
};
