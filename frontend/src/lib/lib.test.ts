import { formatShortDate, parseApiDate } from "./format";
import { splitRationale } from "./risk";
import { validateText, validateUpload } from "./upload";

describe("splitRationale", () => {
  it("separates the safety-floor note from the model rationale", () => {
    const { text, raisedNote } = splitRationale(
      "Looks routine. [Raised from 'low' to 'medium' by deterministic checks: wire-request.]",
    );
    expect(text).toBe("Looks routine.");
    expect(raisedNote).toBe("Raised from 'low' to 'medium' by deterministic checks: wire-request.");
  });

  it("leaves ordinary rationales alone", () => {
    expect(splitRationale("No risk indicators matched.")).toEqual({
      text: "No risk indicators matched.",
      raisedNote: null,
    });
  });
});

describe("dates", () => {
  it("treats naive API timestamps as UTC", () => {
    expect(parseApiDate("2026-06-09T02:15:00")?.toISOString()).toBe("2026-06-09T02:15:00.000Z");
    expect(parseApiDate("2026-06-09T02:15:00+02:00")?.toISOString()).toBe("2026-06-09T00:15:00.000Z");
    expect(parseApiDate(null)).toBeNull();
    expect(formatShortDate("not a date")).toBe("—");
  });
});

describe("client-side validation", () => {
  it("accepts .txt/.pdf/.eml up to 5 MB, case-insensitively", () => {
    expect(validateUpload(new File(["a"], "MAIL.EML"))).toBeNull();
    expect(validateUpload(new File(["a"], "x.docx"))).toMatch(/isn't supported/);
    expect(validateUpload(new File([], "empty.txt"))).toMatch(/empty/);
    expect(validateText("  \n ")).toMatch(/Paste/);
  });
});
