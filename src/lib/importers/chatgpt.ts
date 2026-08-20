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

// React Router 7 "single fetch" streaming payload constants (turbo-stream format).
const STREAM_HOLE = -1;
const STREAM_NAN = -2;
const STREAM_NEGATIVE_INFINITY = -3;
const STREAM_NEGATIVE_ZERO = -4;
const STREAM_NULL = -5;
const STREAM_POSITIVE_INFINITY = -6;
const STREAM_UNDEFINED = -7;

const STREAM_TYPE_SET = "S";
const STREAM_TYPE_MAP = "M";

function extractEnqueuedChunks(html: string): string[] {
  const matches = html.matchAll(/streamController\.enqueue\("((?:[^"\\]|\\.)*)"\)/g);
  return Array.from(matches, (match) => match[1]);
}

function decodeTurboStreamChunk(rawChunk: string): unknown[] | null {
  try {
    const jsString = JSON.parse(`"${rawChunk}"`) as string;
    const parsed = JSON.parse(jsString) as unknown;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// Reconstructs the object graph the app's client would normally hydrate in the browser.
function hydrateTurboStream(chunks: string[]): unknown {
  const values: unknown[] = [];
  let rootIndex: number | null = null;

  for (const chunk of chunks) {
    const parsedChunk = decodeTurboStreamChunk(chunk);
    if (!parsedChunk || parsedChunk.length === 0) {
      continue;
    }

    const startIndex = values.length;
    values.push(...parsedChunk);

    if (rootIndex === null) {
      rootIndex = startIndex;
    }
  }

  if (rootIndex === null) {
    return null;
  }

  const hydrated: unknown[] = [];
  const hydrating = new Set<number>();

  function hydrate(index: number): unknown {
    switch (index) {
      case STREAM_UNDEFINED:
        return undefined;
      case STREAM_NULL:
        return null;
      case STREAM_NAN:
        return NaN;
      case STREAM_POSITIVE_INFINITY:
        return Infinity;
      case STREAM_NEGATIVE_INFINITY:
        return -Infinity;
      case STREAM_NEGATIVE_ZERO:
        return -0;
    }

    if (index in hydrated) {
      return hydrated[index];
    }

    if (hydrating.has(index)) {
      return undefined;
    }
    hydrating.add(index);

    const value = values[index];

    if (!value || typeof value !== "object") {
      hydrated[index] = value;
      return value;
    }

    if (Array.isArray(value)) {
      if (typeof value[0] === "string") {
        const [type] = value as [string, ...unknown[]];

        if (type === STREAM_TYPE_SET) {
          const set = new Set<unknown>();
          hydrated[index] = set;
          for (let i = 1; i < value.length; i++) {
            set.add(hydrate(value[i] as number));
          }
          return set;
        }

        if (type === STREAM_TYPE_MAP) {
          const map = new Map<unknown, unknown>();
          hydrated[index] = map;
          for (let i = 1; i < value.length; i += 2) {
            map.set(hydrate(value[i] as number), hydrate(value[i + 1] as number));
          }
          return map;
        }

        // Dates, URLs, bigints, regexes, symbols, promises and errors aren't
        // needed to extract conversation text, so skip decoding them fully.
        hydrated[index] = null;
        return null;
      }

      const array: unknown[] = [];
      hydrated[index] = array;
      for (let i = 0; i < value.length; i++) {
        const entryIndex = value[i];
        if (entryIndex !== STREAM_HOLE) {
          array[i] = hydrate(entryIndex as number);
        }
      }
      return array;
    }

    const object: Record<string, unknown> = {};
    hydrated[index] = object;
    const record = value as Record<string, number>;
    for (const key of Object.keys(record)) {
      const keyName = hydrate(Number(key.slice(1)));
      object[String(keyName)] = hydrate(record[key]);
    }
    return object;
  }

  return hydrate(rootIndex);
}

function looksLikeConversationMapping(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).some(
    (node) => node && typeof node === "object" && "message" in (node as Record<string, unknown>)
  );
}

function findConversationMapping(
  value: unknown,
  seen: Set<unknown> = new Set()
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return null;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findConversationMapping(entry, seen);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const objectValue = value as Record<string, unknown>;

  if (looksLikeConversationMapping(objectValue.mapping)) {
    return objectValue.mapping as Record<string, unknown>;
  }

  if (looksLikeConversationMapping(objectValue)) {
    return objectValue;
  }

  for (const key of Object.keys(objectValue)) {
    const found = findConversationMapping(objectValue[key], seen);
    if (found) {
      return found;
    }
  }

  return null;
}

function collectTurnsFromMapping(mapping: Record<string, unknown>): RawTurn[] {
  const turns: RawTurn[] = [];

  for (const node of Object.values(mapping)) {
    if (!node || typeof node !== "object") {
      continue;
    }

    const message = (node as Record<string, unknown>).message;
    if (!message || typeof message !== "object") {
      continue;
    }

    const messageObj = message as Record<string, unknown>;
    const author = messageObj.author as Record<string, unknown> | undefined;
    const roleValue = typeof author?.role === "string" ? author.role : "";
    const normalizedRole =
      roleValue === "assistant" || roleValue === "system" ? roleValue : "user";
    const content = messageObj.content as Record<string, unknown> | undefined;
    const text = extractText(content?.parts ?? content?.text ?? content).join("\n");

    if (roleValue && text) {
      turns.push({
        role: normalizedRole,
        text,
        order:
          typeof messageObj.create_time === "number"
            ? messageObj.create_time
            : turns.length,
      });
    }
  }

  return turns;
}

function parseConversationFromStream(html: string): ConversationTurn[] {
  const chunks = extractEnqueuedChunks(html);
  if (chunks.length === 0) {
    return [];
  }

  const root = hydrateTurboStream(chunks);
  const mapping = findConversationMapping(root);
  if (!mapping) {
    return [];
  }

  const turns = collectTurnsFromMapping(mapping);

  return Array.from(
    new Map(
      turns
        .sort((left, right) => left.order - right.order)
        .map((turn) => [`${turn.role}:${turn.text}`, turn] as const)
    ).values()
  ).map(({ role, text }) => ({ role, text }));
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

  const streamTurns = parseConversationFromStream(html);
  if (streamTurns.length > 0) {
    return streamTurns;
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
