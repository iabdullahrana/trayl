"use client";
import { Button } from "@/components/ui/Button";
import { useErrorToast } from "@/components/error-toast";

import { useFormState, useFormStatus } from "react-dom";
import { cancelJourney } from "@/app/dashboard/journey-actions";

function CancelButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="secondary"
      loading={pending}
      loadingText="Cancelling..."
      className="dashboard-cancel"
    >
      Cancel
    </Button>
  );
}

export function CancelJourney({ journeyId }: { journeyId: string }) {
  const [state, action] = useFormState(cancelJourney, {});
  useErrorToast(state);
  return (
    <form action={action} className="mt-space-4">
      <input type="hidden" name="journey_id" value={journeyId} />
      {state.success ? (
        <p role="status" className="text-small text-deep">
          {state.success}
        </p>
      ) : (
        <CancelButton />
      )}
      {state.error && (
        <p className="mt-space-2 text-small text-danger">{state.error}</p>
      )}
    </form>
  );
}
