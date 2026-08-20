"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { buildKnowledgeBaseAction, type BuildFormState } from "@/app/actions";

const initialState: BuildFormState = {};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400 sm:w-auto"
    >
      {pending ? "Building..." : "Build Knowledge Base"}
    </button>
  );
}

export function BuildForm() {
  const [state, formAction] = useActionState(buildKnowledgeBaseAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <label className="block">
        <span className="sr-only">Public ChatGPT share URL</span>
        <input
          type="url"
          name="sourceUrl"
          required
          placeholder="https://chatgpt.com/share/..."
          className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-5 py-4 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-950 focus:bg-white"
        />
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SubmitButton />
        {state.error ? (
          <p className="text-sm text-rose-700">{state.error}</p>
        ) : (
          <p className="text-sm text-slate-500">
            Public pages only — no login automation or private scraping.
          </p>
        )}
      </div>
    </form>
  );
}
