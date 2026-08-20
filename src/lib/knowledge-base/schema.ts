import { z } from "zod";

export type ExtractedTopic = {
  title: string;
  summary: string;
  article: string;
  relatedTopics: string[];
  decisions: string[];
  openQuestions: string[];
  uncertainties: string[];
  children: ExtractedTopic[];
};

export const extractedTopicSchema: z.ZodType<ExtractedTopic> = z.lazy(() =>
  z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    article: z.string().min(1),
    relatedTopics: z.array(z.string()).default([]),
    decisions: z.array(z.string()).default([]),
    openQuestions: z.array(z.string()).default([]),
    uncertainties: z.array(z.string()).default([]),
    children: z.array(extractedTopicSchema).default([]),
  })
);

export const extractedKnowledgeBaseSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  overview: z.string().min(1),
  topics: z.array(extractedTopicSchema).min(1),
});

export type ExtractedKnowledgeBase = z.infer<typeof extractedKnowledgeBaseSchema>;
