/**
 * =============================================================================
 * [AI REQUIREMENT]: Always increment/bump the file version number whenever 
 * any modifications or updates are made to this file.
 * =============================================================================
 * Cloudflare Worker Leaderboard Serverless API API
 * Version: v1.16.0
 * Database: game-leaderboard (Cloudflare D1 Binding: DB)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Cross-Origin Resource Sharing (CORS) Configuration
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // 1. GET Request: Fetch Top 15 High Scores from Cloudflare D1
      if (url.pathname === "/api/leaderboard" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT player_name, score, created_at FROM leaderboard ORDER BY score DESC LIMIT 15"
        ).all();

        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // 2. POST Request: Submit New High Score to Cloudflare D1
      if (url.pathname === "/api/leaderboard" && request.method === "POST") {
        const { name, score } = await request.json();

        // Format short date string matching front-end timestamp formatting
        const d = new Date();
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const timestamp = `${months[d.getMonth()]} ${String(d.getDate()).padStart(2, '0')}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

        await env.DB.prepare(
          "INSERT INTO leaderboard (player_name, score, created_at) VALUES (?, ?, ?)"
        ).bind(name || '---', score || 0, timestamp).run();

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