"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { renameTopicAction } from "@/app/actions";
import { RenameForm, useRenameState } from "@/components/editable-title";
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

function TopicLabel({
  knowledgeBaseSlug,
  topic,
  isCurrent,
}: {
  knowledgeBaseSlug: string;
  topic: TopicTreeNode;
  isCurrent: boolean;
}) {
  const router = useRouter();
  const { isEditing, error, isPending, submit, startEditing, cancel } = useRenameState(
    renameTopicAction,
    (result) => {
      if (isCurrent && result.slug) {
        router.replace(`/${knowledgeBaseSlug}?topic=${encodeURIComponent(result.slug)}`);
      }
    }
  );

  if (isEditing) {
    return (
      <div className="px-1 py-1">
        <RenameForm
          value={topic.title}
          hiddenFields={{ knowledgeBaseSlug, topicSlug: topic.slug }}
          label="topic title"
          isPending={isPending}
          error={error}
          onSubmit={submit}
          onCancel={cancel}
        />
      </div>
    );
  }

  return (
    <div className="group/topic flex items-start gap-1">
      <Link
        href={`/${knowledgeBaseSlug}?topic=${encodeURIComponent(topic.slug)}`}
        className={`block min-w-0 flex-1 rounded-xl px-3 py-2 text-sm transition ${
          isCurrent
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-white hover:text-slate-950"
        }`}
      >
        {topic.title}
      </Link>
      <button
        type="button"
        onClick={startEditing}
        aria-label="Rename topic"
        className="shrink-0 rounded-lg px-2 py-2 text-sm text-slate-400 opacity-0 transition group-hover/topic:opacity-100 hover:bg-white hover:text-slate-700"
      >
        ✎
      </button>
    </div>
  );
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
  const router = useRouter();
  const { isEditing, error, isPending, submit, startEditing, cancel } = useRenameState(
    renameTopicAction,
    (result) => {
      if (isCurrent && result.slug) {
        router.replace(`/${knowledgeBaseSlug}?topic=${encodeURIComponent(result.slug)}`);
      }
    }
  );

  if (!hasChildren) {
    return (
      <li>
        <TopicLabel knowledgeBaseSlug={knowledgeBaseSlug} topic={topic} isCurrent={isCurrent} />
      </li>
    );
  }

  if (isEditing) {
    return (
      <li className="px-1 py-1">
        <RenameForm
          value={topic.title}
          hiddenFields={{ knowledgeBaseSlug, topicSlug: topic.slug }}
          label="topic title"
          isPending={isPending}
          error={error}
          onSubmit={submit}
          onCancel={cancel}
        />
      </li>
    );
  }

  return (
    <li>
      <details open={isExpanded} className="group">
        <summary
          className={`flex cursor-pointer list-none items-start gap-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
            isCurrent ? "bg-slate-900 text-white" : "text-slate-800 hover:bg-white"
          }`}
        >
          <span className="flex min-w-0 flex-1 items-start">
            <span className="mr-2 inline-block shrink-0 transition group-open:rotate-90">›</span>
            <span>{topic.title}</span>
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              startEditing();
            }}
            aria-label="Rename topic"
            className="shrink-0 rounded-lg px-2 py-2 text-sm text-slate-400 opacity-0 transition group-hover:opacity-100 hover:bg-white hover:text-slate-700"
          >
            ✎
          </button>
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
