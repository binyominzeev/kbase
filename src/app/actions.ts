"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { buildKnowledgeBase } from "@/lib/knowledge-base/service";

const buildFormSchema = z.object({
  sourceUrl: z
    .string()
    .trim()
    .url("Enter a valid URL.")
    .refine(
      (value) => {
        try {
          const url = new URL(value);
          return (
            ["chatgpt.com", "chat.openai.com"].includes(url.hostname) &&
            url.pathname.startsWith("/share/")
          );
        } catch {
          return false;
        }
      },
      "Use a public ChatGPT share URL."
    ),
});

export type BuildFormState = {
  error?: string;
};

function toUserFacingMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "KBase could not build that knowledge base.";
  }

  const safeMessagePrefixes = [
    "OPENAI_API_KEY is required",
    "ChatGPT import failed with status",
    "KBase could not extract conversation turns",
    "KBase could not allocate a unique URL slug",
    "This importer only supports public ChatGPT share URLs today.",
    'Unsupported LLM_PROVIDER "',
  ];

  return safeMessagePrefixes.some((prefix) => error.message.startsWith(prefix))
    ? error.message
    : "KBase could not build that knowledge base.";
}

export async function buildKnowledgeBaseAction(
  _previousState: BuildFormState,
  formData: FormData
): Promise<BuildFormState> {
  const parsed = buildFormSchema.safeParse({
    sourceUrl: formData.get("sourceUrl"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid share URL.",
    };
  }

  let slug: string;

  try {
    const knowledgeBase = await buildKnowledgeBase(parsed.data.sourceUrl);
    slug = knowledgeBase.slug;
  } catch (error) {
    return {
      error: toUserFacingMessage(error),
    };
  }

  redirect(`/${slug}`);
}
