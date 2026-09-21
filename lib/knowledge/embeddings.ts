/**
 * Voyage AI embeddings (voyage-3.5, 1024 dims). Returns null when no key is
 * configured so callers can fall back to full-text search.
 *
 * Free-tier keys are limited to 3 requests and 10K tokens per minute, so
 * documents are embedded one at a time, truncated, with retry on 429.
 */
export const EMBEDDING_MODEL = process.env.VOYAGE_MODEL ?? "voyage-3.5";
export const EMBEDDING_DIMS = 1024;
const MAX_CHARS = 6000; // ~1.5K tokens per document

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY as string;
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts.map((t) => t.slice(0, MAX_CHARS)), input_type: inputType, output_dimension: EMBEDDING_DIMS }),
  });
  if (!res.ok) {
    const err = new Error(`Voyage embeddings failed: ${res.status} ${await res.text()}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { data: Array<{ embedding: number[]; index: number }> };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Embed texts one request at a time, waiting out 429s (up to 3 attempts each). */
export async function embed(texts: string[], inputType: "document" | "query", onProgress?: (done: number, total: number) => void): Promise<number[][] | null> {
  if (!embeddingsEnabled() || texts.length === 0) return null;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    let attempt = 0;
    for (;;) {
      try {
        out.push((await request([texts[i]], inputType))[0]);
        break;
      } catch (e) {
        const status = (e as { status?: number }).status;
        attempt += 1;
        if (status === 429 && attempt < 4) {
          await sleep(21000);
          continue;
        }
        throw e;
      }
    }
    onProgress?.(i + 1, texts.length);
    if (i < texts.length - 1) await sleep(inputType === "document" ? 21000 : 0);
  }
  return out;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
