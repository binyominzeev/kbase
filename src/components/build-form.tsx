"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Progress = {
  percent: number;
  message: string;
};

function SubmitButton({ pending }: { pending: boolean }) {
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
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setProgress({ percent: 5, message: "Starting import..." });

    try {
      const sourceUrl = new FormData(event.currentTarget).get("sourceUrl");
      const response = await fetch("/api/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl }),
      });

      if (!response.body) {
        throw new Error("KBase could not start the build.");
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const rawEvent of events) {
          const eventName = rawEvent.match(/^event: (.+)$/m)?.[1];
          const data = rawEvent.match(/^data: (.+)$/m)?.[1];
          if (!eventName || !data) continue;
          const payload = JSON.parse(data) as Progress | { message: string } | { slug: string };

          if (eventName === "progress") setProgress(payload as Progress);
          if (eventName === "error") throw new Error((payload as { message: string }).message);
          if (eventName === "complete") {
            router.push(`/${(payload as { slug: string }).slug}`);
          }
        }
      }
    } catch (streamError) {
      setError(
        streamError instanceof Error
          ? streamError.message
          : "KBase could not build that knowledge base."
      );
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <SubmitButton pending={pending} />
        {error ? (
          <p className="text-sm text-rose-700">{error}</p>
        ) : progress ? (
          <div className="min-w-0 flex-1 space-y-2 sm:max-w-sm">
            <div className="flex justify-between gap-3 text-sm text-slate-600">
              <span>{progress.message}</span>
              <span>{progress.percent}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-valuenow={progress.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-slate-950 transition-[width] duration-500"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Public pages only — no login automation or private scraping.
          </p>
        )}
      </div>
    </form>
  );
}
