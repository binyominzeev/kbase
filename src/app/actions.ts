"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  buildKnowledgeBase,
  deleteKnowledgeBase,
  renameKnowledgeBase,
  renameTopic,
} from "@/lib/knowledge-base/service";

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

export type DeleteFormState = {
  error?: string;
};

export async function deleteKnowledgeBaseAction(
  _previousState: DeleteFormState,
  formData: FormData
): Promise<DeleteFormState> {
  const slug = formData.get("slug");

  if (typeof slug !== "string" || !slug) {
    return { error: "Missing knowledge base slug." };
  }

  const deleted = await deleteKnowledgeBase(slug);

  if (!deleted) {
    return { error: "KBase could not find that knowledge base." };
  }

  revalidatePath("/");
  return {};
}

export type RenameFormState = {
  error?: string;
  slug?: string;
};

const renameKnowledgeBaseSchema = z.object({
  slug: z.string().trim().min(1, "Missing knowledge base slug."),
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title is too long."),
});

export async function renameKnowledgeBaseAction(
  _previousState: RenameFormState,
  formData: FormData
): Promise<RenameFormState> {
  const parsed = renameKnowledgeBaseSchema.safeParse({
    slug: formData.get("slug"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid title.",
    };
  }

  const renamed = await renameKnowledgeBase(parsed.data.slug, parsed.data.title);

  if (!renamed) {
    return { error: "KBase could not find that knowledge base." };
  }

  revalidatePath("/");
  revalidatePath(`/${parsed.data.slug}`);
  revalidatePath(`/${renamed.slug}`);
  return { slug: renamed.slug };
}

const renameTopicSchema = z.object({
  knowledgeBaseSlug: z.string().trim().min(1, "Missing knowledge base slug."),
  topicSlug: z.string().trim().min(1, "Missing topic slug."),
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Title is too long."),
});

export async function renameTopicAction(
  _previousState: RenameFormState,
  formData: FormData
): Promise<RenameFormState> {
  const parsed = renameTopicSchema.safeParse({
    knowledgeBaseSlug: formData.get("knowledgeBaseSlug"),
    topicSlug: formData.get("topicSlug"),
    title: formData.get("title"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid title.",
    };
  }

  const renamed = await renameTopic(
    parsed.data.knowledgeBaseSlug,
    parsed.data.topicSlug,
    parsed.data.title
  );

  if (!renamed) {
    return { error: "KBase could not find that topic." };
  }

  revalidatePath(`/${parsed.data.knowledgeBaseSlug}`);
  return { slug: renamed.slug };
}
