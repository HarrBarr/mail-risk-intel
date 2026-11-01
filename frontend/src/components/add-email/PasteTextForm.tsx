import { useId, useState, type FormEvent } from "react";

import { useCreateEmail } from "@/api/hooks";
import type { Accepted } from "@/api/schemas";
import { errorMessage } from "@/lib/errors";
import { validateText } from "@/lib/upload";

import { FieldError, FormFooter } from "./FormFooter";

const PLACEHOLDER = `From: alice@example.com
To: bob@example.com
Subject: Updated bank details
Date: 2026-06-01 09:30

Hi Bob, please use our new account for the next invoice…`;

interface Props {
  onCreated: (accepted: Accepted) => void;
  onCancel: () => void;
}

export function PasteTextForm({ onCreated, onCancel }: Props) {
  const [text, setText] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const create = useCreateEmail();
  const fieldId = useId();
  const hintId = useId();
  const errorId = useId();

  const error = clientError ?? (create.error ? errorMessage(create.error) : null);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const problem = validateText(text);
    setClientError(problem);
    if (problem) return;
    create.mutate({ kind: "text", text }, { onSuccess: onCreated });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="px-5 py-4">
        <label htmlFor={fieldId} className="block text-sm font-medium text-slate-900">
          Email text
        </label>
        <p id={hintId} className="mt-0.5 text-sm text-slate-600">
          Header lines (<code className="font-mono text-xs">From:</code>,{" "}
          <code className="font-mono text-xs">To:</code>, <code className="font-mono text-xs">Subject:</code>,{" "}
          <code className="font-mono text-xs">Date:</code>) are optional. Without them, the whole text is
          treated as the body.
        </p>
        <textarea
          id={fieldId}
          data-autofocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (clientError) setClientError(null);
            if (create.error) create.reset();
          }}
          rows={10}
          placeholder={PLACEHOLDER}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
          className="input mt-2 min-h-[12rem] resize-y font-mono text-xs leading-relaxed"
          spellCheck={false}
        />
        <FieldError id={errorId} message={error} />
      </div>
      <FormFooter pending={create.isPending} submitLabel="Add email" onCancel={onCancel} />
    </form>
  );
}
