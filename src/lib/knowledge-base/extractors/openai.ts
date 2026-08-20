import OpenAI from "openai";

import type { NormalizedConversation } from "@/lib/importers/types";
import {
  extractedKnowledgeBaseSchema,
  type ExtractedKnowledgeBase,
} from "@/lib/knowledge-base/schema";

const systemPrompt = `You turn public AI conversations into encyclopedic knowledge bases.

Return valid JSON only.

Requirements:
- Identify the major concepts and topics.
- Build a useful hierarchy based on concepts, not chronology.
- Write concise encyclopedia-style articles.
- Surface decisions, open questions, and important uncertainty.
- Add related topic titles when concepts should be linked.
- Do not invent unsupported facts.
- Keep the hierarchy compact but meaningful.`;

export async function extractKnowledgeBaseWithOpenAi(
  conversation: NormalizedConversation
): Promise<ExtractedKnowledgeBase> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER is openai.");
  }

  const client = new OpenAI({ apiKey });
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task: "Generate a structured knowledge base from this normalized conversation.",
            schema: {
              title: "string",
              slug: "optional short URL slug",
              overview: "string",
              topics: [
                {
                  title: "string",
                  summary: "string",
                  article: "string with optional markdown headings like ## Section",
                  relatedTopics: ["topic title"],
                  decisions: ["decision"],
                  openQuestions: ["question"],
                  uncertainties: ["uncertainty"],
                  children: ["same topic schema recursively"],
                },
              ],
            },
            conversation,
          },
          null,
          2
        ),
      },
    ],
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI returned an empty response.");
  }

  return extractedKnowledgeBaseSchema.parse(JSON.parse(content));
}
