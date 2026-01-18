// @ts-nocheck
// This file runs in the Supabase Edge Functions (Deno) runtime.
// If you want full typechecking in-editor, enable the Deno extension for this folder.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Use the Deno-targeted build so type-checkers and the Edge runtime can resolve it cleanly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Fetch knowledge base to build context
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: knowledge } = await supabase
      .from("ai_knowledge")
      .select("*")
      .order("created_at", { ascending: false });

    // Also fetch published blog posts for context
    const { data: blogPosts } = await supabase
      .from("blog_posts")
      .select("title, content, excerpt")
      .eq("published", true)
      .limit(10);

    // Build knowledge context
    let knowledgeContext = "";

    if (knowledge && knowledge.length > 0) {
      knowledgeContext += "## Personal Information\n";
      knowledge.forEach((item) => {
        knowledgeContext += `\n### ${item.title} (${item.type})\n${item.content}\n`;
      });
    }

    if (blogPosts && blogPosts.length > 0) {
      knowledgeContext += "\n## Blog Posts Written by Mustafa\n";
      blogPosts.forEach((post) => {
        knowledgeContext += `\n### ${post.title}\n${post.excerpt || post.content.substring(0, 500)}\n`;
      });
    }

    const systemPrompt = `You are Mustafa.ai, a friendly and knowledgeable AI assistant that represents Mustafa. Your job is to answer questions about Mustafa based on the knowledge provided below.

${knowledgeContext ? `Here is what you know about Mustafa:\n${knowledgeContext}` : "Note: No personal information has been added yet. Encourage visitors to explore the portfolio and mention that the admin can add information through the dashboard."}

Guidelines:
- Be friendly, professional, and conversational
- If asked about something not in your knowledge base, politely say you don't have that specific information and suggest they reach out directly via the contact section
- Highlight Mustafa's skills, experience, and projects when relevant
- Keep responses concise but informative
- Use a warm, personable tone that reflects well on Mustafa
- If the knowledge base is empty, explain that you're still learning about Mustafa and suggest exploring the portfolio sections`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages.map((msg: { role: string; content: string }) => ({
            role: msg.role,
            content: msg.content,
          })),
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits needed. Please try again later." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "I apologize, I couldn't generate a response.";

    return new Response(
      JSON.stringify({ message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("mustafa-chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});