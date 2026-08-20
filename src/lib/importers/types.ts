export type ConversationTurn = {
  role: "user" | "assistant" | "system";
  text: string;
};

export type NormalizedConversation = {
  provider: "chatgpt";
  sourceUrl: string;
  title: string;
  turns: ConversationTurn[];
  transcript: string;
};
