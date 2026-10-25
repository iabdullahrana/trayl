"use client";
import { Button } from "@/components/ui/Button";
import { useErrorToast } from "@/components/error-toast";
import { useFormState, useFormStatus } from "react-dom";
import { runAdminAction } from "@/app/admin/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="danger"
      loading={pending}
      loadingText="Updating..."
      className="whitespace-nowrap"
    >
      {label}
    </Button>
  );
}
export function AdminAction({
  id,
  action,
}: {
  id: string;
  action: "deactivate" | "cancel";
}) {
  const [state, submit] = useFormState(runAdminAction, {});
  useErrorToast(state);
  return (
    <form action={submit}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
      {state.success ? (
        <p role="status">{state.success}</p>
      ) : (
        <Submit
          label={action === "deactivate" ? "Deactivate" : "Force cancel"}
        />
      )}{" "}
      {state.error && (
        <p className="mt-2 max-w-xs text-danger">{state.error}</p>
      )}
    </form>
  );
}
