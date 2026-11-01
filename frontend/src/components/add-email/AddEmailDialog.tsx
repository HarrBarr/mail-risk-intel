import { useState } from "react";
import { useNavigate } from "react-router-dom";

import type { Accepted } from "@/api/schemas";

import { Dialog } from "../Dialog";
import { Tabs } from "../Tabs";
import { PasteTextForm } from "./PasteTextForm";
import { UploadFileForm } from "./UploadFileForm";

type Mode = "text" | "file";

const TABS = [
  { id: "text", label: "Paste text" },
  { id: "file", label: "Upload file" },
] as const;

export function AddEmailDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>("text");
  const navigate = useNavigate();

  const onCreated = (accepted: Accepted) => {
    onClose();
    navigate(`/emails/${encodeURIComponent(accepted.id)}`);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add email"
      description="It's queued for extraction and risk assessment right away."
    >
      <Tabs tabs={TABS} value={mode} onChange={setMode} idPrefix="add-email" label="How to add the email">
        {mode === "text" ? (
          <PasteTextForm onCreated={onCreated} onCancel={onClose} />
        ) : (
          <UploadFileForm onCreated={onCreated} onCancel={onClose} />
        )}
      </Tabs>
    </Dialog>
  );
}
