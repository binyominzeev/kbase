import Link from "next/link";

import type { TopicTreeNode } from "@/lib/knowledge-base/service";

function renderArticle(article: string) {
  return article
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      if (block.startsWith("## ")) {
        return <h2 key={index}>{block.slice(3)}</h2>;
      }

      if (block.startsWith("### ")) {
        return <h3 key={index}>{block.slice(4)}</h3>;
      }

      if (block.split("\n").every((line) => line.trim().startsWith("- "))) {
        return (
          <ul key={index}>
            {block.split("\n").map((line, itemIndex) => (
              <li key={itemIndex}>{line.trim().slice(2)}</li>
            ))}
          </ul>
        );
      }

      return <p key={index}>{block}</p>;
    });
}

type ArticleViewProps = {
  knowledgeBaseSlug: string;
  knowledgeBaseTitle: string;
  topic: TopicTreeNode;
};

export function ArticleView({
  knowledgeBaseSlug,
  knowledgeBaseTitle,
  topic,
}: ArticleViewProps) {
  return (
    <article className="mx-auto max-w-4xl">
      <div className="border-b border-slate-200 pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
          {knowledgeBaseTitle}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          {topic.title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-slate-600">{topic.summary}</p>
      </div>

      <div className="article-copy pt-8">{renderArticle(topic.article)}</div>

      {topic.decisions.length > 0 ? (
        <section className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <h2 className="text-xl font-semibold text-slate-950">Decisions</h2>
          <ul className="mt-4 space-y-3 text-slate-600">
            {topic.decisions.map((decision) => (
              <li key={decision}>
                <span className="font-medium text-slate-900">{decision}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {topic.openQuestions.length > 0 ? (
        <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="text-xl font-semibold text-amber-950">Open questions</h2>
          <ul className="mt-4 space-y-3 text-amber-900">
            {topic.openQuestions.map((question) => (
              <li key={question}>{question}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {topic.uncertainties.length > 0 ? (
        <section className="mt-8 rounded-3xl border border-sky-200 bg-sky-50 p-6">
          <h2 className="text-xl font-semibold text-sky-950">Important uncertainty</h2>
          <ul className="mt-4 space-y-3 text-sky-900">
            {topic.uncertainties.map((uncertainty) => (
              <li key={uncertainty}>{uncertainty}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {topic.relatedTopics.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-semibold text-slate-950">Related topics</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {topic.relatedTopics.map((relatedTopic) => (
              <Link
                key={relatedTopic.slug}
                href={`/${knowledgeBaseSlug}?topic=${encodeURIComponent(relatedTopic.slug)}`}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-900 hover:text-slate-950"
              >
                {relatedTopic.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
