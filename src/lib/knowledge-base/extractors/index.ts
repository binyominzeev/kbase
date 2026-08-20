import type { NormalizedConversation } from "@/lib/importers/types";
import { extractKnowledgeBaseWithMock } from "@/lib/knowledge-base/extractors/mock";
import { extractKnowledgeBaseWithOpenAi } from "@/lib/knowledge-base/extractors/openai";
import type { ExtractedKnowledgeBase } from "@/lib/knowledge-base/schema";

export async function extractKnowledgeBase(
  conversation: NormalizedConversation
): Promise<ExtractedKnowledgeBase> {
  const provider = process.env.LLM_PROVIDER ?? "openai";

  if (provider === "mock") {
    return extractKnowledgeBaseWithMock(conversation);
  }

  if (provider === "openai") {
    return extractKnowledgeBaseWithOpenAi(conversation);
  }

  throw new Error(`Unsupported LLM_PROVIDER "${provider}".`);
}
