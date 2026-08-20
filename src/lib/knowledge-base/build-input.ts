import { z } from "zod";

export const buildFormSchema = z.object({
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

export function toBuildErrorMessage(error: unknown) {
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