import { load } from "cheerio";

import type { ConversationTurn, NormalizedConversation } from "@/lib/importers/types";

type RawTurn = ConversationTurn & {
  order: number;
};

function extractText(value: unknown): string[] {
  if (typeof value === "string") {
    const text = value.trim();
    return text ? [text] : [];
  }

  if (Array.isArray(value)) {
    return value.flatMap(extractText);
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;

    if (typeof objectValue.text === "string") {
      return extractText(objectValue.text);
    }

    if (Array.isArray(objectValue.parts)) {
      return extractText(objectValue.parts);
    }

    if (Array.isArray(objectValue.content)) {
      return extractText(objectValue.content);
    }
  }

  return [];
}

function collectTurns(value: unknown, turns: RawTurn[]) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectTurns(entry, turns));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  const objectValue = value as Record<string, unknown>;

  if (objectValue.message) {
    collectTurns(objectValue.message, turns);
  }

  const roleValue =
    typeof objectValue.role === "string"
      ? objectValue.role
      : typeof (objectValue.author as { role?: unknown } | undefined)?.role === "string"
        ? ((objectValue.author as { role?: string }).role ?? "")
        : "";

  const normalizedRole =
    roleValue === "assistant" || roleValue === "system" ? roleValue : "user";

  const text = extractText(objectValue.content ?? objectValue.parts ?? objectValue.text).join(
    "\n"
  );

  if (roleValue && text) {
    turns.push({
      role: normalizedRole,
      text,
      order:
        typeof objectValue.create_time === "number"
          ? objectValue.create_time
          : turns.length,
    });
  }

  Object.values(objectValue).forEach((entry) => collectTurns(entry, turns));
}

function parseJsonScripts(html: string) {
  const matches = html.matchAll(
    /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/g
  );

  return Array.from(matches, (match) => match[1]).filter(Boolean);
}

function parseConversationFromHtml(html: string) {
  const candidates = parseJsonScripts(html);
  const turns: RawTurn[] = [];

  for (const candidate of candidates) {
    try {
      collectTurns(JSON.parse(candidate), turns);
    } catch {
      continue;
    }
  }

  const uniqueTurns = Array.from(
    new Map(
      turns
        .sort((left, right) => left.order - right.order)
        .map((turn) => [`${turn.role}:${turn.text}`, turn] as const)
    ).values()
  );

  if (uniqueTurns.length > 0) {
    return uniqueTurns.map(({ role, text }) => ({ role, text }));
  }

  const $ = load(html);
  const fallbackTurns: ConversationTurn[] = [];
  const sections = $("main p, main li, article p, article li")
    .toArray()
    .map((element) => $(element).text().trim())
    .filter(Boolean);

  if (sections.length > 0) {
    fallbackTurns.push({
      role: "assistant",
      text: sections.join("\n\n"),
    });
  }

  return fallbackTurns;
}

function formatTranscript(turns: ConversationTurn[]) {
  return turns
    .map((turn, index) => `Turn ${index + 1} (${turn.role}):\n${turn.text}`)
    .join("\n\n");
}

function loadMockConversation(sourceUrl: string): NormalizedConversation | null {
  const url = new URL(sourceUrl);

  if (process.env.LLM_PROVIDER !== "mock" || url.pathname !== "/share/mock-progtaxi") {
    return null;
  }

  const turns: ConversationTurn[] = [
    {
      role: "user",
      text: "I'm brainstorming a startup called ProgTaxi. It helps developers get on-demand help from senior engineers over short live sessions. Can you help me think through the product?",
    },
    {
      role: "assistant",
      text: "ProgTaxi could be framed as fast expert guidance for debugging, architecture reviews, and unblock sessions. The core product is a simple booking flow, a short context handoff, and a live session with a vetted engineer.",
    },
    {
      role: "user",
      text: "What should the MVP include and what are the biggest open risks?",
    },
    {
      role: "assistant",
      text: "The MVP should focus on instant matching, lightweight scheduling, structured problem intake, and post-call notes. The biggest risks are enough expert supply, users trusting the advice quality, and whether teams prefer async help over live sessions.",
    },
  ];

  return {
    provider: "chatgpt",
    sourceUrl,
    title: "ProgTaxi",
    turns,
    transcript: formatTranscript(turns),
  };
}

export async function importChatGptConversation(
  sourceUrl: string
): Promise<NormalizedConversation> {
  const mockConversation = loadMockConversation(sourceUrl);

  if (mockConversation) {
    return mockConversation;
  }

  const response = await fetch(sourceUrl, {
    headers: {
      "user-agent": "KBaseBot/1.0 (+https://github.com/binyominzeev/kbase)",
    },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`ChatGPT import failed with status ${response.status}.`);
  }

  const html = await response.text();
  const turns = parseConversationFromHtml(html);

  if (turns.length === 0) {
    throw new Error(
      "KBase could not extract conversation turns from that public ChatGPT page."
    );
  }

  const $ = load(html);
  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").text().trim() ||
    "Untitled conversation";

  return {
    provider: "chatgpt",
    sourceUrl,
    title,
    turns,
    transcript: formatTranscript(turns),
  };
}
