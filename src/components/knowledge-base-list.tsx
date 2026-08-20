"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  deleteKnowledgeBaseAction,
  type DeleteFormState,
} from "@/app/actions";
import type { KnowledgeBaseSummary } from "@/lib/knowledge-base/service";

const initialState: DeleteFormState = {};

function DeleteButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Deleting..." : "Delete"}
    </button>
  );
}

function KnowledgeBaseListItem({ knowledgeBase }: { knowledgeBase: KnowledgeBaseSummary }) {
  const [state, formAction] = useActionState(deleteKnowledgeBaseAction, initialState);

  return (
    <li className="rounded-2xl border border-black/8 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href={`/${knowledgeBase.slug}`} className="block space-y-1">
            <p className="truncate text-base font-semibold text-slate-950 hover:underline">
              {knowledgeBase.title}
            </p>
            <p className="line-clamp-2 text-sm text-slate-600">{knowledgeBase.overview}</p>
          </Link>
          <a
            href={knowledgeBase.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
            className="mt-1 block truncate text-xs text-slate-400 hover:text-slate-600 hover:underline"
          >
            {knowledgeBase.sourceUrl}
          </a>
        </div>
        <form action={formAction}>
          <input type="hidden" name="slug" value={knowledgeBase.slug} />
          <DeleteButton />
        </form>
      </div>
      {state.error ? (
        <p className="mt-2 text-sm text-rose-700">{state.error}</p>
      ) : null}
    </li>
  );
}

export function KnowledgeBaseList({
  knowledgeBases,
}: {
  knowledgeBases: KnowledgeBaseSummary[];
}) {
  if (knowledgeBases.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No knowledge bases yet. Build your first one above.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {knowledgeBases.map((knowledgeBase) => (
        <KnowledgeBaseListItem key={knowledgeBase.slug} knowledgeBase={knowledgeBase} />
      ))}
    </ul>
  );
}
