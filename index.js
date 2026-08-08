/**
 * Cloudflare Worker API for PixelJump / PixelFlap Leaderboard
 * Interacts with Cloudflare D1 Database (env.DB)
 *
 * =============================================================================
 * ⚠️  AI / DEVELOPER NOTE — DEPLOYMENT IS A SEPARATE STEP FROM EDITING
 * =============================================================================
 * This file is only source code sitting in a repo/download — editing it
 * (even committing it to GitHub) does NOT update the live Worker that
 * game.js actually talks to. Cloudflare does not auto-deploy from GitHub
 * unless Git integration is explicitly configured for this Worker.
 *
 * After ANY change to this file, it must be deployed to Cloudflare before
 * it takes effect, e.g. one of:
 *   - Cloudflare dashboard → Workers & Pages → this Worker → Edit Code →
 *     paste the updated file → Save and Deploy
 *   - `wrangler deploy` from the project directory (with the local file
 *     matching this one)
 *
 * When Claude/an AI assistant modifies this file in a future session, it
 * should explicitly flag that a manual Cloudflare deployment (dashboard or
 * wrangler) is required afterward — editing the file alone is not enough.
 * =============================================================================
 *
 * =============================================================================
 * ONE-TIME MIGRATION REQUIRED before deploying this version
 * =============================================================================
 * This version adds per-difficulty leaderboards. Existing "leaderboard"
 * tables need a new "difficulty" column (existing rows are treated as
 * "normal" difficulty). Run this once against your D1 database, e.g. via
 * wrangler:
 *
 *   wrangler d1 execute <YOUR_DB_NAME> --remote --command \
 *     "ALTER TABLE leaderboard ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'normal';"
 *
 * (or run the same ALTER TABLE statement from the D1 tab in the Cloudflare
 * dashboard's Query Console). Deploying this Worker before running that
 * migration will cause every request to fail with a "no such column" error.
 * =============================================================================
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const VALID_DIFFICULTIES = new Set(["easy", "normal", "hard"]);

function cleanDifficulty(raw) {
  const d = String(raw || "normal").toLowerCase();
  return VALID_DIFFICULTIES.has(d) ? d : "normal";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Handle CORS Preflight Requests
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // 2. GET /api/leaderboard?difficulty=easy|normal|hard - Fetch Top 15
      if (request.method === "GET" && url.pathname === "/api/leaderboard") {
        const difficulty = cleanDifficulty(url.searchParams.get("difficulty"));

        const { results } = await env.DB.prepare(
          `SELECT 
            player_name, 
            score, 
            difficulty,
            strftime('%Y-%m-%dT%H:%M:%SZ', COALESCE(created_at, CURRENT_TIMESTAMP)) AS created_at 
           FROM leaderboard 
           WHERE difficulty = ?
           ORDER BY score DESC 
           LIMIT 15`
        ).bind(difficulty).all();

        return new Response(JSON.stringify(results || []), {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      // 3. POST /api/leaderboard - Submit a New Score
      if (request.method === "POST" && url.pathname === "/api/leaderboard") {
        const body = await request.json().catch(() => ({}));

        // Clean & validate input
        const rawName = body.name || body.player_name || "AAA";
        const cleanName = String(rawName).trim().toUpperCase().replace(/[^A-Z]/g, "").substring(0, 3) || "AAA";
        const score = parseInt(body.score, 10);
        const difficulty = cleanDifficulty(body.difficulty);

        if (isNaN(score)) {
          return new Response(JSON.stringify({ error: "Invalid score" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Insert new score with automatic server timestamp
        await env.DB.prepare(
          `INSERT INTO leaderboard (player_name, score, difficulty, created_at) 
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
        ).bind(cleanName, score, difficulty).run();

        return new Response(JSON.stringify({ success: true, name: cleanName, score, difficulty }), {
          status: 201,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }

      // 4. Catch-all for undefined endpoints
      return new Response(JSON.stringify({ error: "Endpoint not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message || "Internal Server Error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  },
};
