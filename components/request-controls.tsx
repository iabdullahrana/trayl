"use client";
import { Button } from "@/components/ui/Button";
import { useErrorToast } from "@/components/error-toast";
import { useFormState, useFormStatus } from "react-dom";
import { respondToRequest } from "@/app/dashboard/request-actions";

function Buttons() {
  const { pending, data } = useFormStatus();
  return (
    <div className="flex flex-wrap gap-space-2">
      <Button
        type="submit"
        name="status"
        value="accepted"
        size="sm"
        disabled={pending}
        loading={pending && data?.get("status") === "accepted"}
        loadingText="Accepting..."
      >
        Accept
      </Button>
      <Button
        type="submit"
        name="status"
        value="declined"
        size="sm"
        variant="secondary"
        disabled={pending}
        loading={pending && data?.get("status") === "declined"}
        loadingText="Declining..."
      >
        Decline
      </Button>
    </div>
  );
}

export function RequestControls({
  requestId,
  compact = false,
}: {
  requestId: string;
  compact?: boolean;
}) {
  const [state, action] = useFormState(respondToRequest, {});
  useErrorToast(state);
  return (
    <form action={action} className={compact ? "mt-space-2" : "mt-space-4"}>
      <input type="hidden" name="request_id" value={requestId} />
      {state.success ? (
        <p role="status" className="text-small text-deep">
          {state.success}
        </p>
      ) : (
        <Buttons />
      )}
      {state.error && (
        <p role="alert" className="mt-space-2 text-small text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
