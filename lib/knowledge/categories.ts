/** Coarse equipment categories used for labour fallbacks and matching. Order matters: first match wins. */
export const CATEGORY_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: "projector_lens", pattern: /\blens\b/i },
  { category: "projector_mount", pattern: /(projector|ceiling).*(bracket|mount|cradle|pole|cage)|fleximount|cradle plate/i },
  { category: "projector", pattern: /projector/i },
  { category: "lighting_interface", pattern: /dmx|lighting (interface|controller|node)/i },
  { category: "touch_panel", pattern: /touch ?panel|touchlink|60-1993|60-1998/i },
  { category: "control_processor", pattern: /control processor|IPCP|linklicense|link license|79-2577|79-2546/i },
  { category: "control_relay", pattern: /contact closure|relay|iTach|GC-IP2CC/i },
  { category: "network_switch", pattern: /network switch|control management interface|TL-SG|managed switch/i },
  { category: "video_switcher", pattern: /matrix switch|switching matrix|switcher|AC-CX42|60-1678|presentation switch|4x2/i },
  { category: "video_extender", pattern: /hdbaset|DTP (transmitter|receiver)|extender|AC-CXWP|60-1271|60-1421|hdmi.*(transmitter|receiver)/i },
  { category: "wireless_presentation", pattern: /airserver|wireless present|vivi|clickshare/i },
  { category: "media_player", pattern: /multimedia player|bluetooth|MMP-1|media player|audio input plate/i },
  { category: "mic_plate", pattern: /xlr.*(wall ?plate|plate)|CB0446/i },
  { category: "wallplate", pattern: /wall ?plate|input plate|P5970A|flylead/i },
  { category: "charger", pattern: /charging station|charger|MP820|\bMP80\b/i },
  { category: "wireless_mic_receiver", pattern: /diversity receiver|wireless.*receiver|ACT747|ACT312/i },
  { category: "wireless_mic_transmitter", pattern: /handheld transmitter|ACT700H|ACT32HC|wireless base|gooseneck.*wireless|wireless.*gooseneck|BC100|bodypack/i },
  { category: "screen", pattern: /projection screen|smart screen|grandview|GRIP|\bscreen\b(?!.*status)/i },
  { category: "speaker", pattern: /loudspeaker|speaker|subwoofer/i },
  { category: "amplifier", pattern: /amplifier|\bamp\b|\bPX[35]\b/i },
  { category: "dsp", pattern: /\bdsp\b|signal processor|matrix mixer|audio processor|MTX3|DMP 128/i },
  { category: "stage_io", pattern: /stage box|stage i\/o|TIO1608|dante.*(interface|decoder|io\b)/i },
  { category: "mixer", pattern: /mixing console|\bmixer\b/i },
  { category: "antenna_mount", pattern: /bracket.*antenna|antenna.*bracket|MS90/i },
  { category: "antenna", pattern: /antenna|AT90W/i },
  { category: "mic_stand", pattern: /mic(rophone)? (floor |boom )?stand/i },
  { category: "wired_mic", pattern: /microphone|PGA58|SM58|gooseneck/i },
  { category: "hearing_augmentation", pattern: /hearing|roger|loop amplifier/i },
  { category: "lectern", pattern: /lectern/i },
  { category: "rack_panel", pattern: /rack panel|anodised|RB3FH/i },
  { category: "rack", pattern: /(server|equipment|\d+\s?RU\b.*)\s?rack|\brack\b(?!\s*(mount|panel))|cabinet/i },
  { category: "pdu", pattern: /\bpdu\b|power distribution/i },
  { category: "enclosure", pattern: /enclosure|back box|EWB/i },
  { category: "road_case", pattern: /road ?case|roadcase/i },
  { category: "remote_control", pattern: /remote control/i },
];

export function categorise(description: string, partNumber?: string | null): string {
  const hay = `${description} ${partNumber ?? ""}`;
  for (const rule of CATEGORY_RULES) if (rule.pattern.test(hay)) return rule.category;
  return "other";
}

const BRANDS = [
  "Panasonic", "Epson", "Extron", "Yamaha", "MIPRO", "Shure", "AVPro Edge", "AirServer", "Grandview", "Jackson", "CERTECH",
  "inDESIGN", "Global Cache", "Chauvet", "Phonak", "NEC", "Sharp", "Bose", "Behringer", "Redback", "Neutrik", "Roadworx",
  "Bluegum", "TP-Link", "Kramer", "Crestron", "QSC", "Biamp", "Sennheiser", "Audio-Technica", "Sony", "Samsung", "LG",
];

export function brandOf(description: string): string | null {
  for (const b of BRANDS) if (new RegExp(`\\b${b.replace(/[-\s]/g, "[-\\s]?")}\\b`, "i").test(description)) return b;
  return null;
}
