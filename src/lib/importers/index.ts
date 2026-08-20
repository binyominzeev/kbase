import { importChatGptConversation } from "@/lib/importers/chatgpt";
import type { NormalizedConversation } from "@/lib/importers/types";

export async function importPublicConversation(
  sourceUrl: string
): Promise<NormalizedConversation> {
  const url = new URL(sourceUrl);

  if (["chatgpt.com", "chat.openai.com"].includes(url.hostname)) {
    return importChatGptConversation(sourceUrl);
  }

  throw new Error("This importer only supports public ChatGPT share URLs today.");
}
