export type VisitNoteEditContext = {
  visitStatus: string | null | undefined;
  visitOwnerUserId: string | null | undefined;
  noteCreatedBy: string | null | undefined;
  userId: string;
};

export function canEditVisitNote(context: VisitNoteEditContext) {
  return (
    context.visitStatus === "in_progress" &&
    context.visitOwnerUserId === context.userId &&
    context.noteCreatedBy === context.userId
  );
}

export function buildVisitNoteSubject(tags: string[]) {
  return tags.length ? `Note terrain · ${tags.join(" · ")}` : "Note terrain";
}
