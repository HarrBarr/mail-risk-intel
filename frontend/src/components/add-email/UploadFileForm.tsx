import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";

import { useCreateEmail } from "@/api/hooks";
import type { Accepted } from "@/api/schemas";
import { errorMessage } from "@/lib/errors";
import { formatBytes } from "@/lib/format";
import { ACCEPT_ATTR, validateUpload } from "@/lib/upload";

import { Icon } from "../Icon";
import { FieldError, FormFooter } from "./FormFooter";

interface Props {
  onCreated: (accepted: Accepted) => void;
  onCancel: () => void;
}

export function UploadFileForm({ onCreated, onCancel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const create = useCreateEmail();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  const error = clientError ?? (create.error ? errorMessage(create.error) : null);

  const choose = (next: File | undefined | null) => {
    create.reset();
    if (!next) return;
    const problem = validateUpload(next);
    setClientError(problem);
    setFile(problem ? null : next);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    choose(event.dataTransfer.files[0]);
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!file) {
      setClientError(clientError ?? "Choose a .txt, .pdf or .eml file first.");
      return;
    }
    create.mutate({ kind: "file", file }, { onSuccess: onCreated });
  };

  return (
    <form onSubmit={onSubmit} noValidate>
      <div className="px-5 py-4">
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-indigo-600 focus-within:ring-offset-2 ${
            dragging
              ? "border-indigo-500 bg-indigo-50"
              : error
                ? "border-red-300 bg-red-50/40"
                : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
          }`}
        >
          <Icon name="upload" className="h-6 w-6 text-slate-500" />
          <span className="mt-2 text-sm font-medium text-slate-900">
            Drop a file here or <span className="text-indigo-700 underline underline-offset-2">browse</span>
          </span>
          <span id={hintId} className="mt-1 text-xs text-slate-600">
            .txt, .pdf or .eml, up to 5 MB
          </span>
          <input
            ref={inputRef}
            id={inputId}
            data-autofocus
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            aria-invalid={error ? true : undefined}
            aria-describedby={`${hintId}${error ? ` ${errorId}` : ""}`}
            onChange={(e) => choose(e.target.files?.[0])}
          />
        </label>

        {file ? (
          <div className="mt-3 flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
            <Icon name="file" className="h-5 w-5 text-slate-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-600">{formatBytes(file.size)}</p>
            </div>
            <button
              type="button"
              className="icon-btn"
              aria-label={`Remove ${file.name}`}
              onClick={() => {
                setFile(null);
                create.reset();
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <Icon name="x" />
            </button>
          </div>
        ) : null}

        <FieldError id={errorId} message={error} />
      </div>
      <FormFooter pending={create.isPending} submitLabel="Upload" onCancel={onCancel} />
    </form>
  );
}
