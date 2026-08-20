import { BuildForm } from "@/components/build-form";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-1 flex-col justify-center px-6 py-16 sm:px-10">
      <div className="rounded-[2rem] border border-black/8 bg-white p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-12">
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
              KBase
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              Turn your AI conversations into structured knowledge.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Paste a public ChatGPT share URL and KBase will import the
              conversation, extract the key concepts, and publish a clean,
              navigable mini-encyclopedia.
            </p>
          </div>

          <BuildForm />

          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            KBase stores generated knowledge bases in a local SQLite database. Set
            <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs">
              DATABASE_URL
            </code>
            and
            <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs">
              OPENAI_API_KEY
            </code>
            to enable live extraction, or switch
            <code className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs">
              LLM_PROVIDER=mock
            </code>
            for local UI smoke testing.
          </div>
        </div>
      </div>
    </main>
  );
}
