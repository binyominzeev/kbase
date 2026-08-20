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

  try {
    const knowledgeBase = await buildKnowledgeBase(parsed.data.sourceUrl);
    redirect(`/${knowledgeBase.slug}`);
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "KBase could not build that knowledge base.",
    };
  }
}
