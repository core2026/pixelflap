export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Allow requests from your GitHub/GitLab Pages frontend
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // GET Top 15 High Scores
      if (url.pathname === "/api/leaderboard" && request.method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT player_name, score, created_at FROM leaderboard ORDER BY score DESC LIMIT 15"
        ).all();

        return new Response(JSON.stringify(results), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // POST New Score
      if (url.pathname === "/api/leaderboard" && request.method === "POST") {
        const { name, score } = await request.json();
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