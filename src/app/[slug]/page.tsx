import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleView } from "@/components/article-view";
import { TopicTree } from "@/components/topic-tree";
import { getKnowledgeBaseBySlug, selectTopic } from "@/lib/knowledge-base/service";

type KnowledgeBasePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ topic?: string }>;
};

export default async function KnowledgeBasePage({
  params,
  searchParams,
}: KnowledgeBasePageProps) {
  const { slug } = await params;
  const { topic } = await searchParams;

  const knowledgeBase = await getKnowledgeBaseBySlug(slug);

  if (!knowledgeBase) {
    notFound();
  }

  const currentTopic = selectTopic(knowledgeBase, topic);

  if (!currentTopic) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="border-b border-slate-200 bg-slate-50 px-5 py-6 lg:border-r lg:border-b-0 lg:px-6">
          <Link
            href="/"
            className="mb-6 inline-flex text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            ← Build another knowledge base
          </Link>

          <div className="mb-6 border-b border-slate-200 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
              {knowledgeBase.title}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {knowledgeBase.overview}
            </p>
          </div>

          <nav aria-label="Knowledge base topics">
            <TopicTree
              knowledgeBaseSlug={knowledgeBase.slug}
              topics={knowledgeBase.topicTree}
              currentTopicSlug={currentTopic.slug}
            />
          </nav>
        </aside>

        <section className="px-6 py-8 sm:px-10 lg:px-14">
          <ArticleView
            knowledgeBaseSlug={knowledgeBase.slug}
            knowledgeBaseTitle={knowledgeBase.title}
            topic={currentTopic}
          />
        </section>
      </div>
    </main>
  );
}
