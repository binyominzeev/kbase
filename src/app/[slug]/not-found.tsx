import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">
        KBase
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950">
        Knowledge base not found
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-8 text-slate-600">
        The knowledge base you requested does not exist or has not been built
        yet.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Return home
      </Link>
    </main>
  );
}
