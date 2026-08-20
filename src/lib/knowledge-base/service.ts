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
      relatedTopicSlugs: topic.relatedTopics,
      decisions: topic.decisions,
      openQuestions: topic.openQuestions,
      uncertainties: topic.uncertainties,
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

async function buildKnowledgeBaseSlug(extracted: ExtractedKnowledgeBase) {
  const baseSlug = slugify(extracted.slug ?? extracted.title) || "knowledge-base";
  let slug = baseSlug;
  let suffix = 2;

  while (await prisma.knowledgeBase.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function buildKnowledgeBase(sourceUrl: string) {
  const conversation = await importPublicConversation(sourceUrl);
  const extracted = await extractKnowledgeBase(conversation);
  const slug = await buildKnowledgeBaseSlug(extracted);
  const usedSlugs = new Set<string>();

  return prisma.$transaction(async (tx) => {
    const knowledgeBase = await tx.knowledgeBase.create({
      data: {
        slug,
        title: extracted.title,
        sourceUrl: conversation.sourceUrl,
        sourceProvider: conversation.provider,
        sourceConversation: conversation as Prisma.InputJsonValue,
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
    relatedTopicSlugs: Prisma.JsonValue;
    decisions: Prisma.JsonValue;
    openQuestions: Prisma.JsonValue;
    uncertainties: Prisma.JsonValue;
  }>
) {
  const nodesById = new Map<string, TopicTreeNode>();
  const nodesBySlug = new Map<string, TopicTreeNode>();
  const topicIdsBySlug = new Map<string, string>();

  for (const topic of topics) {
    const node: TopicTreeNode = {
      slug: topic.slug,
      title: topic.title,
      summary: topic.summary,
      article: topic.article,
      decisions: ensureArrayOfStrings(topic.decisions),
      openQuestions: ensureArrayOfStrings(topic.openQuestions),
      uncertainties: ensureArrayOfStrings(topic.uncertainties),
      relatedTopics: [],
      children: [],
    };

    nodesById.set(topic.id, node);
    nodesBySlug.set(topic.slug, node);
    topicIdsBySlug.set(topic.slug, topic.id);
  }

  const roots: TopicTreeNode[] = [];

  for (const topic of topics) {
    const node = nodesById.get(topic.id);

    if (!node) {
      continue;
    }

    const relatedSlugs = ensureArrayOfStrings(topic.relatedTopicSlugs);
    node.relatedTopics = relatedSlugs
      .map((candidate) => {
        const normalizedCandidate = slugify(candidate);
        const match = Array.from(nodesBySlug.values()).find((entry) => {
          const tail = entry.slug.split("/").at(-1);
          return (
            entry.title.toLowerCase() === candidate.toLowerCase() ||
            tail === normalizedCandidate
          );
        });

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
) {
  if (requestedSlug) {
    const match = knowledgeBase.topicsBySlug.get(requestedSlug);

    if (match) {
      return match;
    }
  }

  return knowledgeBase.topicTree[0];
}
