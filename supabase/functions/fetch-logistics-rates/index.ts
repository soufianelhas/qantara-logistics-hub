import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Route {
  mode: "Sea" | "Air" | "Road" | "Rail";
  provider: string;
  base_cost: number;
  transit_days: number;
  reliability_score: number;
  carbon_footprint: number;
  currency: string;
}

function getSimulatedRoutes(): Route[] {
  return [
    { mode: "Sea", provider: "Maersk Line", base_cost: 850, transit_days: 8, reliability_score: 88, carbon_footprint: 42, currency: "USD" },
    { mode: "Sea", provider: "CMA CGM", base_cost: 780, transit_days: 9, reliability_score: 85, carbon_footprint: 45, currency: "USD" },
    { mode: "Air", provider: "DHL Express", base_cost: 2400, transit_days: 2, reliability_score: 96, carbon_footprint: 180, currency: "USD" },
    { mode: "Air", provider: "Royal Air Maroc Cargo", base_cost: 1950, transit_days: 3, reliability_score: 91, carbon_footprint: 165, currency: "USD" },
    { mode: "Road", provider: "TransMaghreb Trucking", base_cost: 1200, transit_days: 3, reliability_score: 82, carbon_footprint: 95, currency: "USD" },
    { mode: "Road", provider: "Algeciras Express Haulage", base_cost: 1350, transit_days: 2, reliability_score: 87, carbon_footprint: 88, currency: "USD" },
    { mode: "Rail", provider: "ONCF Freight", base_cost: 650, transit_days: 5, reliability_score: 78, carbon_footprint: 35, currency: "USD" },
  ];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { origin_port, destination_market, e_factor } = await req.json();
    const eFactor = e_factor ?? 1.0;
    const routes = getSimulatedRoutes();

    // Generate strategic advice via Lovable AI Gateway
    let strategic_advice = "";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (LOVABLE_API_KEY) {
      const riskContext = eFactor > 1.2
        ? "CRITICAL: Maritime E-Factor is above 1.2, indicating severe weather risk at Moroccan ports (high winds >25 knots, potential port shutdowns). Sea routes are HIGH RISK. Strongly recommend Air or Road alternatives."
        : eFactor > 1.1
        ? "MODERATE: Maritime E-Factor is elevated above 1.1. Some weather disruption possible. Consider reliability tradeoffs."
        : "LOW RISK: Weather conditions are favorable across all modes.";

      const prompt = `You are a logistics advisor for Moroccan exports. Given these transport options and current conditions, provide a 2-3 sentence strategic recommendation.

Origin: ${origin_port || "Casablanca"}
Destination: ${destination_market || "EU"}
E-Factor: ×${eFactor}
Risk Context: ${riskContext}

Routes available:
${routes.map(r => `- ${r.mode}: ${r.provider} — $${r.base_cost}, ${r.transit_days} days, ${r.reliability_score}% reliable`).join("\n")}

Respond with ONLY the recommendation text, no formatting.`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [{ role: "user", content: prompt }],
          }),
        });

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          strategic_advice = aiData.choices?.[0]?.message?.content || "";
        } else {
          console.error("AI gateway error:", aiResp.status);
        }
      } catch (aiErr) {
        console.error("AI call failed:", aiErr);
      }
    }

    if (!strategic_advice) {
      strategic_advice = eFactor > 1.2
        ? "Due to critical maritime weather risk (E-Factor ×" + eFactor.toFixed(2) + "), we recommend switching to Road or Air transport to avoid port delays at Tanger Med and Casablanca."
        : "Current conditions are favorable. Sea freight offers the best cost-efficiency for non-time-sensitive shipments.";
    }

    return new Response(JSON.stringify({ routes, strategic_advice }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-logistics-rates error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
