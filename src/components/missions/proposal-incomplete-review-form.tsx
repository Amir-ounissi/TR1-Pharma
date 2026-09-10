"use client";

import { useActionState } from "react";
import { reviewProviderProposalAction } from "@/app/(protected)/dashboard/missions/actions";
import { ActionFeedback } from "@/components/reference/action-feedback";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ProposalIncompleteReviewForm({ missionId }: { missionId: string }) {
  const [state, action, pending] = useActionState(reviewProviderProposalAction, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="missionId" value={missionId} />
      <ActionFeedback {...state} />
      <Textarea
        name="reviewNote"
        required
        placeholder="Indiquez ce qui doit être complété avant validation"
      />
      <div className="flex flex-wrap gap-2">
        <Button name="decision" value="needs_correction" variant="outline" disabled={pending}>
          Demander correction
        </Button>
        <Button name="decision" value="rejected" variant="destructive" disabled={pending}>
          Refuser
        </Button>
      </div>
    </form>
  );
}
