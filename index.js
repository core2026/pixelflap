/**
 * =============================================================================
 * PixelJump Leaderboard API (Cloudflare Worker + D1)
 * Version: v2.1.01
 *
 * Talks to a D1 database (binding name: DB, database: "game-leaderboard")
 * with a table shaped like:
 *
 *   CREATE TABLE leaderboard (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     player_name TEXT NOT NULL,
 *     score INTEGER NOT NULL,
 *     created_at TEXT NOT NULL
 *   );
 *
 * Endpoints:
 *   GET  /api/leaderboard  -> top 15 scores, highest first
 *   POST /api/leaderboard  -> { name: "ACE", score: 42 } adds a new entry
 *
 * =============================================================================
 * AI / DEVELOPER EDITING REQUIREMENT
 * =============================================================================
 * Anyone (human or AI) who edits this file MUST bump the "Version:" comment
 * above using semantic versioning (MAJOR.MINOR.PATCH):
 *   PATCH -> bug fixes / tiny tweaks / comment-only changes
 *   MINOR -> new endpoints or non-breaking behavior changes
 *   MAJOR -> breaking changes to the API contract
 * =============================================================================
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Allow requests from your game's frontend (GitHub Pages / Cloudflare
    // Pages / anywhere else it's hosted). Tighten this to your exact domain
    // once you know it, for slightly better security.
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    // Preflight requests: just acknowledge and let the browser proceed.
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // -----------------------------------------------------------------
      // GET /api/leaderboard -> top 15 high scores, highest score first
      // -----------------------------------------------------------------
      if (url.pathname === "/api/leaderboard" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT player_name, score, created_at FROM leaderboard ORDER BY score DESC LIMIT 15"
        ).all();

        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // -----------------------------------------------------------------
      // POST /api/leaderboard -> insert a new score
      // Body: { "name": "ACE", "score": 42 }
      // -----------------------------------------------------------------
      if (url.pathname === "/api/leaderboard" && request.method === "POST") {
        const body = await request.json();
        const rawName = typeof body.name === "string" ? body.name : "";
        const rawScore = body.score;

        // --- Basic server-side validation so the leaderboard (and any kid
        //     playing) can't be griefed by garbage or absurd submissions. ---
        const name = rawName.trim().toUpperCase().replace(/[^A-Z]/g, "").substring(0, 3) || "---";
        const score = Math.trunc(Number(rawScore));

        if (!Number.isFinite(score) || score < 0 || score > 100000) {
          return new Response(JSON.stringify({ error: "Invalid score." }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const timestamp = new Date().toISOString();

        await env.DB.prepare(
          "INSERT INTO leaderboard (player_name, score, created_at) VALUES (?, ?, ?)"
        ).bind(name, score, timestamp).run();

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response("API Endpoint Not Found", { status: 404, headers: corsHeaders });
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
