import mammoth from "mammoth";

export type PreparedDocument =
  | { kind: "docx"; html: string; truncated: boolean }
  | { kind: "pdf"; base64: string };

export const CUTOFF_HEADING = "Acceptance & Payment";

/** Cut a text/HTML string at the Acceptance & Payment heading (case-insensitive, tolerant of "and"). */
export function truncateAtAcceptance(text: string): { text: string; truncated: boolean } {
  const re = /acceptance\s*(?:&amp;|&|and)\s*payment/i;
  const m = re.exec(text);
  if (!m) return { text, truncated: false };
  // Back up to the start of the enclosing tag/line so we don't leave a dangling heading.
  const cut = Math.max(0, text.lastIndexOf("<", m.index));
  return { text: text.slice(0, cut), truncated: true };
}

export function detectKind(fileName: string, mime?: string | null): "pdf" | "docx" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (lower.endsWith(".docx") || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return null;
}

/**
 * .docx -> HTML via mammoth (keeps table structure), cut at Acceptance & Payment.
 * PDFs are passed to Claude as a document block; the cut is done by instruction.
 */
export async function prepareDocument(buffer: Buffer, kind: "pdf" | "docx"): Promise<PreparedDocument> {
  if (kind === "pdf") return { kind: "pdf", base64: buffer.toString("base64") };
  const result = await mammoth.convertToHtml({ buffer });
  const { text, truncated } = truncateAtAcceptance(result.value);
  return { kind: "docx", html: collapseWhitespace(text), truncated };
}

function collapseWhitespace(html: string): string {
  return html.replace(/>\s+</g, "><").replace(/\s{2,}/g, " ");
}
