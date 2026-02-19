import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRESETS: Record<string, string> = {
  "muted-moroccan-sunlight":
    "Enhance the image with soft, diffused golden-hour lighting. Use a warm, desaturated color palette to evoke an authentic, artisanal feel. Keep shadows soft and natural.",
  "industrial-texture":
    "Increase micro-contrast to highlight raw material textures like hand-woven wool or hammered metal. Use cool, neutral lighting with sharp, clean shadows for a high-end gallery look.",
  "clean-white-background":
    "Remove background clutter and replace it with a studio-perfect #FFFFFF white. Normalize all lighting to be bright and even, ensuring the product's true colors are perfectly represented.",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, preset } = await req.json();

    if (!imageBase64 || !preset) {
      return new Response(
        JSON.stringify({ error: "imageBase64 and preset are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = PRESETS[preset];
    if (!systemPrompt) {
      return new Response(
        JSON.stringify({ error: `Unknown preset: ${preset}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine mime type from base64 prefix or default to jpeg
    let mimeType = "image/jpeg";
    if (imageBase64.startsWith("data:")) {
      const match = imageBase64.match(/^data:([^;]+);base64,/);
      if (match) mimeType = match[1];
    }
    const base64Data = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: systemPrompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage credits required. Please add credits to your workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "AI gateway error", detail: errText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Extract the enhanced image from the response
    // Gemini image model returns image data in content
    const content = data.choices?.[0]?.message?.content;
    
    // The image model returns content as array with image_url type
    let enhancedImageBase64: string | null = null;
    
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part.type === "image_url" && part.image_url?.url) {
          enhancedImageBase64 = part.image_url.url;
          break;
        }
      }
    } else if (typeof content === "string") {
      // Sometimes returned as inline data URI
      if (content.startsWith("data:image")) {
        enhancedImageBase64 = content;
      }
    }

    if (!enhancedImageBase64) {
      // Fallback: return the raw response for debugging
      console.error("No image in response:", JSON.stringify(data).slice(0, 500));
      return new Response(
        JSON.stringify({ error: "No image returned from AI model", debug: JSON.stringify(data).slice(0, 200) }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ enhancedImageBase64 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("image-enhance error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
