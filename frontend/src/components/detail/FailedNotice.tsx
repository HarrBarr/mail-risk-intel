import { useReprocess } from "@/api/hooks";
import { errorMessage } from "@/lib/errors";

import { Icon } from "../Icon";
import { Spinner } from "../Spinner";

export function FailedNotice({ id, error }: { id: string; error: string | null }) {
  const reprocess = useReprocess(id);
  return (
    <section role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-4">
      <div className="flex gap-3">
        <Icon name="alert" className="mt-0.5 h-5 w-5 text-red-700" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-red-900">Processing failed</h3>
          <p className="mt-1 break-words text-sm text-red-900/90">
            {error ?? "The pipeline stopped with an unknown error."}
          </p>
          {reprocess.isError ? (
            <p className="mt-2 text-sm font-medium text-red-900">{errorMessage(reprocess.error)}</p>
          ) : null}
          <button
            type="button"
            className="btn mt-3 bg-white text-red-800 ring-1 ring-inset ring-red-300 hover:bg-red-100"
            onClick={() => reprocess.mutate()}
            disabled={reprocess.isPending}
          >
            {reprocess.isPending ? <Spinner className="h-4 w-4" /> : <Icon name="refresh" />}
            {reprocess.isPending ? "Retrying…" : "Retry"}
          </button>
        </div>
      </div>
    </section>
  );
}
