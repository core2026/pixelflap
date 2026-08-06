/**
 * Cloudflare Worker API for PixelJump / PixelFlap Leaderboard
 * Interacts with Cloudflare D1 Database (env.DB)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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
      // 2. GET /api/leaderboard - Fetch Top 15 Scores
      if (request.method === "GET" && url.pathname === "/api/leaderboard") {
        const { results } = await env.DB.prepare(
          `SELECT 
            player_name, 
            score, 
            COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at 
           FROM leaderboard 
           ORDER BY score DESC 
           LIMIT 15`
        ).all();

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

        if (isNaN(score)) {
          return new Response(JSON.stringify({ error: "Invalid score" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Insert new score with automatic server timestamp
        await env.DB.prepare(
          `INSERT INTO leaderboard (player_name, score, created_at) 
           VALUES (?, ?, CURRENT_TIMESTAMP)`
        ).bind(cleanName, score).run();

        return new Response(JSON.stringify({ success: true, name: cleanName, score }), {
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