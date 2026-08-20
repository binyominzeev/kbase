import Link from "next/link";

import type { TopicTreeNode } from "@/lib/knowledge-base/service";

type TopicTreeProps = {
  knowledgeBaseSlug: string;
  topics: TopicTreeNode[];
  currentTopicSlug: string;
};

function containsTopic(topic: TopicTreeNode, currentTopicSlug: string): boolean {
  if (topic.slug === currentTopicSlug) {
    return true;
  }

  return topic.children.some((child) => containsTopic(child, currentTopicSlug));
}

function TopicBranch({
  knowledgeBaseSlug,
  topic,
  currentTopicSlug,
}: {
  knowledgeBaseSlug: string;
  topic: TopicTreeNode;
  currentTopicSlug: string;
}) {
  const isCurrent = topic.slug === currentTopicSlug;
  const hasChildren = topic.children.length > 0;
  const isExpanded = isCurrent || topic.children.some((child) => containsTopic(child, currentTopicSlug));

  if (!hasChildren) {
    return (
      <li>
        <Link
          href={`/${knowledgeBaseSlug}?topic=${encodeURIComponent(topic.slug)}`}
          className={`block rounded-xl px-3 py-2 text-sm transition ${
            isCurrent
              ? "bg-slate-900 text-white"
              : "text-slate-700 hover:bg-white hover:text-slate-950"
          }`}
        >
          {topic.title}
        </Link>
      </li>
    );
  }

  return (
    <li>
      <details open={isExpanded} className="group">
        <summary
          className={`cursor-pointer list-none rounded-xl px-3 py-2 text-sm font-medium transition ${
            isCurrent
              ? "bg-slate-900 text-white"
              : "text-slate-800 hover:bg-white"
          }`}
        >
          <span className="mr-2 inline-block transition group-open:rotate-90">›</span>
          {topic.title}
        </summary>
        <ul className="mt-2 space-y-1 border-l border-slate-200 pl-3">
          <li>
            <Link
              href={`/${knowledgeBaseSlug}?topic=${encodeURIComponent(topic.slug)}`}
              className={`block rounded-xl px-3 py-2 text-sm transition ${
                isCurrent
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-white hover:text-slate-950"
              }`}
            >
              Overview
            </Link>
          </li>
          {topic.children.map((child) => (
            <TopicBranch
              key={child.slug}
              knowledgeBaseSlug={knowledgeBaseSlug}
              topic={child}
              currentTopicSlug={currentTopicSlug}
            />
          ))}
        </ul>
      </details>
    </li>
  );
}

export function TopicTree({
  knowledgeBaseSlug,
  topics,
  currentTopicSlug,
}: TopicTreeProps) {
  return (
    <ul className="space-y-1">
      {topics.map((topic) => (
        <TopicBranch
          key={topic.slug}
          knowledgeBaseSlug={knowledgeBaseSlug}
          topic={topic}
          currentTopicSlug={currentTopicSlug}
        />
      ))}
    </ul>
  );
}
