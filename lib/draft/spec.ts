import { Spec } from "@/lib/schemas/spec";
import type { KJob } from "@/lib/knowledge/types";
import { equipmentLeaves } from "@/lib/knowledge/derive";
import { categorise } from "@/lib/knowledge/categories";
import { structured } from "./llm";
import { COMPONENT_CATEGORIES } from "@/lib/schemas/spec";

const SYSTEM = `You turn a short job brief from an AV estimator at Primo Group Services (Sydney school halls and auditoriums) into a component specification.

Rules:
- Decide WHAT the job contains, never prices or hours. Code prices everything afterwards.
- Use Primo's section names: "<Project> - Video", "<Project> - Audio", "<Project> - Control" when the brief asks for a Video/Audio/Control split; "Stage 1/2/3" when staged; otherwise one section named after the project.
- One component per distinct item type with a quantity. Mark existing equipment that is kept as status "retained" (it becomes an OFE line at $0), equipment to be removed as "remove", everything to supply and install as "new".
- Include the supporting items an estimator would add: mounting bracket or pole for a new projector, IP/relay interface for a retained motorised screen, wall plates for HDMI inputs, HDBaseT transmitter for a stage input, antenna mounts for remote antennas, charging station for handheld mics, a rack panel when inputs live in the rack, a PDU with a new rack.
- Use categories from the allowed list only. Prefer part numbers from the reference jobs in part_hint when the brief clearly implies the same product; otherwise leave part_hint ''.
- Fill params from the brief (counts of new/retained items, wireless_mic_channels, touch_panels, video_inputs, rack new|reuse, ewp_required, staged, dsp_new, wireless_presentation, hearing_augmentation...). Only include what the brief supports.`;

function referenceBlock(jobs: KJob[]): string {
  return jobs
    .map((j) => {
      const secs = j.sections
        .map((s) => {
          const items = equipmentLeaves(s)
            .slice(0, 40)
            .map((l) => `    - ${l.part_number ?? "-"} | ${categorise(l.description, l.part_number)} | ${l.description.slice(0, 90)} x${l.qty}`)
            .join("\n");
          return `  Section "${s.name}" (${s.kind}):\n${items}`;
        })
        .join("\n");
      return `Job ${j.job_number} "${j.title}" (${j.room_type ?? "?"}, ${j.install_type ?? "?"})\n${secs}`;
    })
    .join("\n\n");
}

export async function briefToSpec(brief: string, referenceJobs: KJob[]): Promise<Spec> {
  const user = `Allowed categories: ${COMPONENT_CATEGORIES.join(", ")}.

Reference jobs (Primo's vocabulary, section structure and part numbers):
${referenceBlock(referenceJobs)}

Brief:
"""
${brief.trim()}
"""

Produce the specification.`;
  return structured(Spec, SYSTEM, user, 12000);
}
