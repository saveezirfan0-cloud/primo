import mammoth from "mammoth";

export type PreparedDocument =
  | { kind: "docx"; text: string; truncated: boolean }
  | { kind: "pdf"; base64: string };

export const CUTOFF_HEADING = "Acceptance & Payment";
export const DEPTH_MARK = "›";

/** Cut text at the Acceptance & Payment heading (case-insensitive, tolerant of "and"). */
export function truncateAtAcceptance(text: string): { text: string; truncated: boolean } {
  const re = /acceptance\s*(?:&amp;|&|and)\s*payment/i;
  const m = re.exec(text);
  if (!m) return { text, truncated: false };
  const cut = Math.max(0, text.lastIndexOf("\n", m.index));
  return { text: text.slice(0, cut), truncated: true };
}

export function detectKind(fileName: string, mime?: string | null): "pdf" | "docx" | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (lower.endsWith(".docx") || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  return null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * mammoth HTML -> compact text. Table rows become "cell | cell | cell" lines.
 * Leading spaces inside a cell (AroFlo's expanded export indents nested BOM
 * rows by 3 spaces per level) become DEPTH_MARK characters so the nesting
 * survives whitespace normalisation.
 */
export function htmlToCompactText(html: string): string {
  let s = html;
  s = s.replace(/<p>( +)/g, (_m, spaces: string) => "<p>" + DEPTH_MARK.repeat(Math.round(spaces.length / 3)) + " ");
  s = s.replace(/(?:<\/p>)?\s*<\/t[dh]>\s*/g, " | ");
  s = s.replace(/<\/tr>/g, "\n");
  s = s.replace(/<\/p>|<\/h[1-6]>|<\/li>|<br\s*\/?>/g, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s*\|\s*$/, "").trim())
    .filter((line) => line.length > 0)
    .join("\n");
  return s;
}

/**
 * .docx -> compact text via mammoth, cut at Acceptance & Payment.
 * PDFs are passed to Claude as a document block; the cut is done by instruction.
 */
export async function prepareDocument(buffer: Buffer, kind: "pdf" | "docx"): Promise<PreparedDocument> {
  if (kind === "pdf") return { kind: "pdf", base64: buffer.toString("base64") };
  const result = await mammoth.convertToHtml({ buffer });
  const { text, truncated } = truncateAtAcceptance(htmlToCompactText(result.value));
  return { kind: "docx", text, truncated };
}
