import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/** Model for spec parsing, part choice and text drafting; CLAUDE.md specifies claude-sonnet-5. */
export const DRAFT_MODEL = process.env.DRAFT_MODEL ?? "claude-sonnet-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ timeout: 5 * 60 * 1000 });
  return client;
}

/** One structured-output call: system + user text -> parsed schema. */
export async function structured<T extends z.ZodType>(schema: T, system: string, user: string, maxTokens = 16000): Promise<z.infer<T>> {
  const stream = anthropic().messages.stream({
    model: DRAFT_MODEL,
    max_tokens: maxTokens,
    system,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(schema) },
    messages: [{ role: "user", content: user }],
  });
  const message = await stream.finalMessage();
  if (message.stop_reason === "refusal") throw new Error("The model declined this request.");
  if (message.stop_reason === "max_tokens") throw new Error("The model's output was cut off.");
  const text = message.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text ?? "";
  const parsed = schema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error(`Output did not match the schema: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  return parsed.data;
}
