import { describe, expect, it } from "vitest";
import { missionTypes, reportFieldsFor, safeObjectName } from "./missions";

describe("missions", () => {
  it("exposes the eleven required types", () => expect(missionTypes).toHaveLength(11));
  it("requires animation metrics", () => expect(reportFieldsFor("animation")).toEqual(["unitsSold", "durationMinutes", "customerContacts"]));
  it("requires training attendance", () => expect(reportFieldsFor("training")).toContain("participantCount"));
  it("never trusts the uploaded filename", () => expect(safeObjectName("b", "m", "../../preuve.PNG")).toMatch(/^b\/m\/[0-9a-f-]+\.png$/));
});
