import { useId, useState, type FormEvent } from "react";

import { useCreateEmail } from "@/api/hooks";
import type { Accepted } from "@/api/schemas";
import { errorMessage } from "@/lib/errors";
import { validateText } from "@/lib/upload";

import styles from "./AddEmail.module.css";
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
      <div className={styles.body}>
        <label htmlFor={fieldId} className={styles.label}>
          Email text
        </label>
        <p id={hintId} className={styles.hint}>
          Header lines (<code>From:</code>, <code>To:</code>, <code>Subject:</code>, <code>Date:</code>) are
          optional. Without them, the whole text is treated as the body.
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
          className={`input ${styles.textarea}`}
          spellCheck={false}
        />
        <FieldError id={errorId} message={error} />
      </div>
      <FormFooter pending={create.isPending} submitLabel="Add email" onCancel={onCancel} />
    </form>
  );
}
