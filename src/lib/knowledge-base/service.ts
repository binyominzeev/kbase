import type { Prisma } from "@prisma/client";

import { importPublicConversation } from "@/lib/importers";
import { extractKnowledgeBase } from "@/lib/knowledge-base/extractors";
import type {
  ExtractedKnowledgeBase,
  ExtractedTopic,
} from "@/lib/knowledge-base/schema";
import { prisma } from "@/lib/prisma";
import { ensureArrayOfStrings, slugify } from "@/lib/utils";

export type TopicTreeNode = {
  slug: string;
  title: string;
  summary: string;
  article: string;
  decisions: string[];
  openQuestions: string[];
  uncertainties: string[];
  relatedTopics: Array<{ slug: string; title: string }>;
  children: TopicTreeNode[];
};

export type HydratedKnowledgeBase = {
  slug: string;
  title: string;
  overview: string;
  topicTree: TopicTreeNode[];
  topicsBySlug: Map<string, TopicTreeNode>;
};

const knowledgeBaseSlugLimit = 5;

function parseStoredJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return [];
  }
}

function buildUniqueSlug(base: string, usedSlugs: Set<string>) {
  let slug = base || "topic";
  let suffix = 2;

  while (usedSlugs.has(slug)) {
    slug = `${base || "topic"}-${suffix}`;
    suffix += 1;
  }

  usedSlugs.add(slug);
  return slug;
}

async function createTopicBranch(
  tx: Prisma.TransactionClient,
  knowledgeBaseId: string,
  topic: ExtractedTopic,
  parentId: string | null,
  order: number,
  parentPath: string[],
  usedSlugs: Set<string>
) {
  const pathPart = buildUniqueSlug(slugify(topic.title), usedSlugs);
  const slug = [...parentPath, pathPart].join("/");
  const createdTopic = await tx.topic.create({
    data: {
      knowledgeBaseId,
      parentId,
      slug,
      title: topic.title,
      summary: topic.summary,
      article: topic.article,
      order,
      relatedTopicSlugs: JSON.stringify(topic.relatedTopics),
      decisions: JSON.stringify(topic.decisions),
      openQuestions: JSON.stringify(topic.openQuestions),
      uncertainties: JSON.stringify(topic.uncertainties),
    },
    select: {
      id: true,
    },
  });

  for (const [childIndex, child] of topic.children.entries()) {
    await createTopicBranch(
      tx,
      knowledgeBaseId,
      child,
      createdTopic.id,
      childIndex,
      [...parentPath, pathPart],
      usedSlugs
    );
  }
}

function buildKnowledgeBaseSlug(extracted: ExtractedKnowledgeBase, attempt: number) {
  const baseSlug = slugify(extracted.slug ?? extracted.title) || "knowledge-base";

  return attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
}

export async function buildKnowledgeBase(sourceUrl: string) {
  const conversation = await importPublicConversation(sourceUrl);
  const extracted = await extractKnowledgeBase(conversation);

  for (let attempt = 0; attempt < knowledgeBaseSlugLimit; attempt += 1) {
    const slug = buildKnowledgeBaseSlug(extracted, attempt);
    const usedSlugs = new Set<string>();

    try {
      return await prisma.$transaction(async (tx) => {
        const knowledgeBase = await tx.knowledgeBase.create({
          data: {
            slug,
            title: extracted.title,
            sourceUrl: conversation.sourceUrl,
            sourceProvider: conversation.provider,
            sourceConversation: JSON.stringify(conversation),
            overview: extracted.overview,
          },
          select: {
            id: true,
            slug: true,
          },
        });

        for (const [index, topic] of extracted.topics.entries()) {
          await createTopicBranch(tx, knowledgeBase.id, topic, null, index, [], usedSlugs);
        }

        return {
          slug: knowledgeBase.slug,
        };
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new Error("KBase could not allocate a unique URL slug for this knowledge base.");
}

function buildTopicTree(
  topics: Array<{
    slug: string;
    title: string;
    summary: string;
    article: string;
    order: number;
    parentId: string | null;
    id: string;
    relatedTopicSlugs: string;
    decisions: string;
    openQuestions: string;
    uncertainties: string;
  }>
) {
  const nodesById = new Map<string, TopicTreeNode>();
  const nodesBySlug = new Map<string, TopicTreeNode>();
  const nodesByLowerTitle = new Map<string, TopicTreeNode>();
  const nodesBySlugTail = new Map<string, TopicTreeNode>();

  for (const topic of topics) {
    const node: TopicTreeNode = {
      slug: topic.slug,
      title: topic.title,
      summary: topic.summary,
      article: topic.article,
      decisions: ensureArrayOfStrings(parseStoredJson(topic.decisions)),
      openQuestions: ensureArrayOfStrings(parseStoredJson(topic.openQuestions)),
      uncertainties: ensureArrayOfStrings(parseStoredJson(topic.uncertainties)),
      relatedTopics: [],
      children: [],
    };

    nodesById.set(topic.id, node);
    nodesBySlug.set(topic.slug, node);
    nodesByLowerTitle.set(topic.title.toLowerCase(), node);
    nodesBySlugTail.set(topic.slug.split("/").at(-1) ?? topic.slug, node);
  }

  const roots: TopicTreeNode[] = [];

  for (const topic of topics) {
    const node = nodesById.get(topic.id);

    if (!node) {
      continue;
    }

    const relatedSlugs = ensureArrayOfStrings(
      parseStoredJson(topic.relatedTopicSlugs)
    );
    node.relatedTopics = relatedSlugs
      .map((candidate) => {
        const match =
          nodesByLowerTitle.get(candidate.toLowerCase()) ??
          nodesBySlugTail.get(slugify(candidate));

        return match ? { slug: match.slug, title: match.title } : null;
      })
      .filter((entry): entry is { slug: string; title: string } => entry !== null);

    if (topic.parentId) {
      nodesById.get(topic.parentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return {
    roots,
    nodesBySlug,
  };
}

export async function getKnowledgeBaseBySlug(
  slug: string
): Promise<HydratedKnowledgeBase | null> {
  const knowledgeBase = await prisma.knowledgeBase.findUnique({
    where: { slug },
    select: {
      slug: true,
      title: true,
      overview: true,
      topics: {
        orderBy: [{ parentId: "asc" }, { order: "asc" }],
        select: {
          id: true,
          parentId: true,
          slug: true,
          title: true,
          summary: true,
          article: true,
          order: true,
          relatedTopicSlugs: true,
          decisions: true,
          openQuestions: true,
          uncertainties: true,
        },
      },
    },
  });

  if (!knowledgeBase) {
    return null;
  }

  const { roots, nodesBySlug } = buildTopicTree(knowledgeBase.topics);

  return {
    slug: knowledgeBase.slug,
    title: knowledgeBase.title,
    overview: knowledgeBase.overview,
    topicTree: roots,
    topicsBySlug: nodesBySlug,
  };
}

export function selectTopic(
  knowledgeBase: HydratedKnowledgeBase,
  requestedSlug?: string
): TopicTreeNode | undefined {
  if (requestedSlug) {
    const match = knowledgeBase.topicsBySlug.get(requestedSlug);

    if (match) {
      return match;
    }
  }

  return knowledgeBase.topicTree[0];
}
