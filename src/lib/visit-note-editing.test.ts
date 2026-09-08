import { expect, it } from "vitest";
import { buildVisitNoteSubject, canEditVisitNote } from "./visit-note-editing";

const userId = "00000000-0000-4000-8000-000000000001";

it("allows the author to edit a note while the visit is in progress", () => {
  expect(canEditVisitNote({
    visitStatus: "in_progress",
    visitOwnerUserId: userId,
    noteCreatedBy: userId,
    userId,
  })).toBe(true);
});

it.each(["planned", "confirmed", "completed", "cancelled"])(
  "locks a visit note when visit status is %s",
  (visitStatus) => {
    expect(canEditVisitNote({
      visitStatus,
      visitOwnerUserId: userId,
      noteCreatedBy: userId,
      userId,
    })).toBe(false);
  },
);

it("does not allow another user to edit the note", () => {
  expect(canEditVisitNote({
    visitStatus: "in_progress",
    visitOwnerUserId: userId,
    noteCreatedBy: "00000000-0000-4000-8000-000000000002",
    userId,
  })).toBe(false);
});

it("builds the same terrain note subject from tags", () => {
  expect(buildVisitNoteSubject(["order", "callback"])).toBe("Note terrain · order · callback");
  expect(buildVisitNoteSubject([])).toBe("Note terrain");
});
