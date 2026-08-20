import type { NormalizedConversation } from "@/lib/importers/types";
import type { ExtractedKnowledgeBase } from "@/lib/knowledge-base/schema";
import { slugify } from "@/lib/utils";

function pickSentences(text: string, count: number) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, count);
}

export async function extractKnowledgeBaseWithMock(
  conversation: NormalizedConversation
): Promise<ExtractedKnowledgeBase> {
  const userTurns = conversation.turns.filter((turn) => turn.role === "user");
  const assistantTurns = conversation.turns.filter((turn) => turn.role === "assistant");
  const title = conversation.title.replace(/\s*-\s*ChatGPT$/i, "").trim();

  const problem = pickSentences(userTurns.map((turn) => turn.text).join(" "), 3);
  const solution = pickSentences(
    assistantTurns.map((turn) => turn.text).join(" "),
    4
  );

  return {
    title,
    slug: slugify(title),
    overview:
      solution[0] ??
      "This knowledge base was generated from a public ChatGPT conversation.",
    topics: [
      {
        title: "Overview",
        summary:
          solution[0] ??
          "A synthesized overview of the imported conversation.",
        article: [
          "## Conversation snapshot",
          solution.join(" "),
          "## Source framing",
          problem.join(" "),
        ]
          .filter(Boolean)
          .join("\n\n"),
        relatedTopics: ["Source Questions"],
        decisions: [],
        openQuestions: [],
        uncertainties: [],
        children: [],
      },
      {
        title: "Source Questions",
        summary:
          problem[0] ??
          "The main requests and concerns raised in the conversation.",
        article: [
          "## Main prompts",
          ...userTurns.slice(0, 5).map((turn) => `- ${turn.text}`),
        ].join("\n\n"),
        relatedTopics: ["Overview"],
        decisions: [],
        openQuestions: problem.slice(0, 3),
        uncertainties: [],
        children: [],
      },
    ],
  };
}
