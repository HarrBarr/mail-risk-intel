import { useId, useRef, useState, type DragEvent, type FormEvent } from "react";

import { useCreateEmail } from "@/api/hooks";
import type { Accepted } from "@/api/schemas";
import { errorMessage } from "@/lib/errors";
import { formatBytes } from "@/lib/format";
import { cx } from "@/lib/cx";
import { ACCEPT_ATTR, validateUpload } from "@/lib/upload";

import { Icon } from "../Icon";
import styles from "./AddEmail.module.css";
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
      <div className={styles.body}>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx(styles.drop, dragging && styles.dragging, !dragging && error && styles.dropInvalid)}
        >
          <Icon name="upload" size={24} />
          <span className={styles.dropTitle}>
            Drop a file here or <span className={styles.browse}>browse</span>
          </span>
          <span id={hintId} className={styles.dropHint}>
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
          <div className={styles.file}>
            <Icon name="file" size={20} />
            <div className={styles.fileText}>
              <p className={styles.fileName}>{file.name}</p>
              <p className={styles.fileSize}>{formatBytes(file.size)}</p>
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
