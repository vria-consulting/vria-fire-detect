import type { MetadataRoute } from "next";

// Tout est indexable, y compris par les crawlers des assistants IA
// (GPTBot, ClaudeBot, PerplexityBot…) : être cité par les LLM est un canal
// d'acquisition à part entière pour kanari.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/veille"] }],
    sitemap: ["https://kanari.io/sitemap.xml", "https://kanari.io/sitemap-events.xml"],
  };
}
