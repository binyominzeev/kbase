"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { RenameFormState } from "@/app/actions";

export type RenameAction = (
  previousState: RenameFormState,
  formData: FormData
) => Promise<RenameFormState>;

export function useRenameState(
  action: RenameAction,
  onSuccess?: (state: RenameFormState) => void
) {
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);

      if (result.error) {
        setError(result.error);
        return;
      }

      setError(undefined);
      setIsEditing(false);
      onSuccess?.(result);
    });
  }

  function startEditing() {
    setError(undefined);
    setIsEditing(true);
  }

  function cancel() {
    setError(undefined);
    setIsEditing(false);
  }

  return { isEditing, error, isPending, submit, startEditing, cancel };
}

type RenameFormProps = {
  value: string;
  hiddenFields: Record<string, string>;
  label: string;
  isPending: boolean;
  error?: string;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
};

export function RenameForm({
  value,
  hiddenFields,
  label,
  isPending,
  error,
  onSubmit,
  onCancel,
}: RenameFormProps) {
  return (
    <form action={onSubmit} className="flex w-full flex-col gap-2">
      {Object.entries(hiddenFields).map(([name, fieldValue]) => (
        <input key={name} type="hidden" name={name} value={fieldValue} />
      ))}
      <input
        name="title"
        defaultValue={value}
        autoFocus
        aria-label={label}
        disabled={isPending}
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            onCancel();
          }
        }}
        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onCancel}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-500 transition hover:text-slate-800"
        >
          Cancel
        </button>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    </form>
  );
}

type EditableTitleProps = {
  value: string;
  hiddenFields: Record<string, string>;
  action: RenameAction;
  displayClassName?: string;
  label: string;
  redirectBasePath?: string;
};

export function EditableTitle({
  value,
  hiddenFields,
  action,
  displayClassName = "",
  label,
  redirectBasePath,
}: EditableTitleProps) {
  const router = useRouter();
  const { isEditing, error, isPending, submit, startEditing, cancel } = useRenameState(
    action,
    (result) => {
      if (redirectBasePath && result.slug) {
        router.replace(`${redirectBasePath}${result.slug}` as Route);
      }
    }
  );

  if (isEditing) {
    return (
      <RenameForm
        value={value}
        hiddenFields={hiddenFields}
        label={label}
        isPending={isPending}
        error={error}
        onSubmit={submit}
        onCancel={cancel}
      />
    );
  }

  return (
    <span className="group/editable-title inline-flex items-center gap-2">
      <span className={displayClassName}>{value}</span>
      <button
        type="button"
        onClick={startEditing}
        aria-label={`Rename ${label}`}
        className="shrink-0 rounded px-1 text-sm text-slate-400 opacity-0 transition group-hover/editable-title:opacity-100 hover:text-slate-700"
      >
        ✎
      </button>
    </span>
  );
}
