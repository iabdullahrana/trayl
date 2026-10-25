"use client";
import { useFormState, useFormStatus } from "react-dom";
import { moderateReport } from "@/app/admin/report-actions";
import { Button } from "@/components/ui/Button";
import { useErrorToast } from "@/components/error-toast";
function Submit({ action }: { action: "review" | "deactivate" }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant={action === "review" ? "secondary" : "danger"}
      loading={pending}
      loadingText="Updating..."
      className="whitespace-nowrap"
    >
      {action === "review" ? "Mark reviewed" : "Deactivate user"}
    </Button>
  );
}
export function AdminReportAction({
  reportId,
  action,
}: {
  reportId: string;
  action: "review" | "deactivate";
}) {
  const [state, submit] = useFormState(moderateReport, {});
  useErrorToast(state);
  return (
    <form action={submit}>
      <input type="hidden" name="reportId" value={reportId} />
      <input type="hidden" name="action" value={action} />
      {state.success ? (
        <p role="status">{state.success}</p>
      ) : (
        <Submit action={action} />
      )}
      {state.error && (
        <p role="alert" className="mt-2 max-w-xs text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
