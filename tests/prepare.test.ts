import { describe, expect, it } from "vitest";
import { htmlToCompactText, truncateAtAcceptance } from "@/lib/ingest/prepare";

describe("docx preparation", () => {
  it("turns table rows into pipe-delimited lines and leading spaces into depth markers", () => {
    const html =
      "<table><tr><td><p>Hall Upgrade - Video</p></td><td><p>-</p></td><td><p>1</p></td><td><p>$15,352.69</p></td><td><p>$15,352.43</p></td></tr>" +
      "<tr><td><p>   Equipment</p></td><td><p>-</p></td><td><p>1</p></td><td><p>$9,263.36</p></td><td><p>$9,263.36</p></td></tr>" +
      "<tr><td><p>      Projection Screen 180&quot; 4:3 (Existing)</p></td><td><p>OFE</p></td><td><p>1</p></td><td><p>$0.00</p></td><td><p>$0.00</p></td></tr></table>";
    expect(htmlToCompactText(html).split("\n")).toEqual([
      "Hall Upgrade - Video | - | 1 | $15,352.69 | $15,352.43",
      "› Equipment | - | 1 | $9,263.36 | $9,263.36",
      '›› Projection Screen 180" 4:3 (Existing) | OFE | 1 | $0.00 | $0.00',
    ]);
  });

  it("cuts everything from Acceptance & Payment onward", () => {
    const { text, truncated } = truncateAtAcceptance("Exclusions\n· A\nAcceptance &amp; Payment\nBank BSB 000");
    expect(truncated).toBe(true);
    expect(text).toBe("Exclusions\n· A");
  });
});
