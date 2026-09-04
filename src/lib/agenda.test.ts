import { describe, expect, it } from "vitest";
import { addCalendarDays, durationMinutes, isoToParisLocal, mondayOfWeek, parisLocalToIso, parseCalendarDate } from "./agenda";

describe("agenda calendar helpers", () => {
  it("adds days without browser timezone drift", () => expect(addCalendarDays("2026-03-29", 1)).toBe("2026-03-30"));
  it("returns the Monday of a week", () => expect(mondayOfWeek("2026-09-04")).toBe("2026-08-31"));
  it("rejects invalid calendar dates", () => expect(parseCalendarDate("2026-02-30")).toBeNull());
  it("computes a positive visit duration", () => expect(durationMinutes("2026-09-04T12:00:00Z", "2026-09-04T12:45:00Z")).toBe(45));
  it("round-trips Paris local time", () => expect(isoToParisLocal(parisLocalToIso("2026-09-04T14:30"))).toBe("2026-09-04T14:30"));
});
