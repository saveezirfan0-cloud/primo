import { describe, expect, it } from "vitest";
import { categorise } from "@/lib/knowledge/categories";
import { derivePriceBook, deriveLabourStandards, median } from "@/lib/knowledge/derive";
import { jobFromPayload } from "@/lib/knowledge/from-payload";

describe("categorise", () => {
  it.each([
    ["Panasonic 8,000 Lumen LCD WUXGA Laser Projector", "PT-VMZ82", "projector"],
    ["Custom 2200mm FlexiMount Suspended Ceiling Projector Bracket", "CUSTOM", "projector_mount"],
    ["AVPro Edge 4x2 ConferX Auto Switching Matrix w/ HDBaseT Inputs and Outputs.Microphone, Volume", "AC-CX42-AUHD", "video_switcher"],
    ["MIPRO Rechargeable Wideband Handheld Transmitter. LCD Status Screen.", "ACT700H", "wireless_mic_transmitter"],
    ["MIPRO Dual-slot Desktop Charging Station. Features two charging slots for transmitters", "MP820", "charger"],
    ["MIPRO Wall Mounting bracket for Antenna", "MS90", "antenna_mount"],
    ["MIPRO Directional Transmit/Receive Antenna.", "AT90W", "antenna"],
    ["Microphone Floor Stand With Boom", "C0515A", "mic_stand"],
    ["Chauvet Rack Mountable Ethernet-to-DMX Node", "NETXII", "lighting_interface"],
    ["Yamaha 26 x 8 Matrix Mixer / Signal Processor", "MTX3", "dsp"],
    ["Extron 5.5\" Wall Mount TouchLink Pro Touchpanel", "60-1993-02", "touch_panel"],
    ["Projection Screen 180\" 4:3 (Existing)", "OFE", "screen"],
    ["Yamaha 12\" 2-Way Passive Installation Loudspeaker", "VKE2012", "speaker"],
  ])("%s -> %s", (desc, pn, expected) => {
    expect(categorise(desc, pn)).toBe(expected);
  });
});

describe("price book + labour standards", () => {
  const sec = "s1";
  const payload = {
    job_number: "9001", title: "Test PS - Hall Upgrade", client_org: null, site_suburb: null, issued_on: "2026-05-01",
    structure: "sections", room_type: "hall", install_type: "upgrade", subtotal_ex_gst: 1000, params: {},
    scope_text: "", assumptions: [], exclusions: [], has_labour_detail: true, is_holdout: false,
    sections: [{ id: sec, name: "Video", kind: "system", sort: 0, total: 1000 }],
    lines: [
      { id: "eq", section_id: sec, parent_id: null, grp: "EQUIPMENT", code: null, part_number: null, description: "Equipment", qty: 1, unit_price: 600, total: 600, is_existing: false, activity: null, hours: null, rate: null, sort: 0 },
      { id: "p1", section_id: sec, parent_id: "eq", grp: "EQUIPMENT", code: null, part_number: "PX5", description: "Yamaha 500Wx2 Professional Power Amplifier", qty: 2, unit_price: 300, total: 600, is_existing: false, activity: null, hours: null, rate: null, sort: 1 },
      { id: "ofe", section_id: sec, parent_id: "eq", grp: "EQUIPMENT", code: null, part_number: "OFE", description: "Existing screen", qty: 1, unit_price: 0, total: 0, is_existing: true, activity: null, hours: null, rate: null, sort: 2 },
      { id: "svc", section_id: sec, parent_id: null, grp: "SERVICES", code: "SERVICES", part_number: "SERVICES", description: "Services", qty: 1, unit_price: 400, total: 400, is_existing: false, activity: null, hours: null, rate: null, sort: 3 },
      { id: "inst", section_id: sec, parent_id: "svc", grp: "SERVICES", code: "INSTALL", part_number: "INSTALL", description: "Equipment Installation", qty: 1, unit_price: 95.1, total: 95.1, is_existing: false, activity: "INSTALL", hours: null, rate: null, sort: 4 },
      { id: "i1", section_id: sec, parent_id: "inst", grp: "SERVICES", code: null, part_number: "PX5", description: "Yamaha 500Wx2 Professional Power Amplifier", qty: 2, unit_price: 47.55, total: 95.1, is_existing: false, activity: "INSTALL", hours: 1, rate: 95.1, sort: 5 },
      { id: "dec", section_id: sec, parent_id: "svc", grp: "SERVICES", code: "DE-COMM", part_number: "DE-COMM", description: "De-Commissioning", qty: 1, unit_price: 61.82, total: 61.82, is_existing: false, activity: "DE-COMM", hours: null, rate: null, sort: 6 },
      { id: "d1", section_id: sec, parent_id: "dec", grp: "SERVICES", code: null, part_number: null, description: "Old amplifier", qty: 2, unit_price: 30.91, total: 61.82, is_existing: false, activity: "DE-COMM", hours: null, rate: null, sort: 7 },
    ],
  };
  const older = { ...payload, job_number: "8999", issued_on: "2026-01-01", lines: payload.lines.map((l) => (l.id === "p1" ? { ...l, unit_price: 280, total: 560 } : l)) };
  const jobs = [jobFromPayload(older), jobFromPayload(payload)];

  it("keeps the latest price and counts usage, ignoring OFE", () => {
    const parts = derivePriceBook(jobs);
    expect(parts).toHaveLength(1);
    expect(parts[0]).toMatchObject({ part_number: "PX5", last_price: 300, times_used: 2, category: "amplifier", brand: "Yamaha" });
    expect(parts[0].jobs).toEqual(["8999", "9001"]);
  });

  it("derives hours per unit and dollars per item", () => {
    const std = deriveLabourStandards(jobs);
    const px5 = std.find((s) => s.part_number === "PX5" && s.activity === "INSTALL");
    expect(px5).toMatchObject({ hours: 0.5, sample_count: 2 });
    const amp = std.find((s) => s.category === "amplifier" && s.activity === "DE-COMM");
    expect(amp).toMatchObject({ hours: 0, amount: 30.91 });
  });

  it("median", () => {
    expect(median([1, 3, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("categorise: rule order regressions", () => {
  it.each([
    ["MIPRO Desktop Charging Station for ACT32HC and ACT32TC. Charge any two transmitters", "MP80", "charger"],
    ["inDESIGN Multimedia Player Wall Plate. USB and Bluetooth playback.", "MMP-1", "media_player"],
    ["Black 3 pin XLR Horizontal Microphone Wallplate", "CB0446", "mic_plate"],
    ["CERTECH 37RU 600 (W) x 800 (D) Premier Series Server Rack Including 4 x fans, 1 x horizontal 6 outlet PDU", "NSR376X8", "rack"],
    ["Jackson Industries 1RU 6 Outlet Horizontal PDU", "RAC0600", "pdu"],
    ["2RU Black Anodised Aluminium Rack Panel [With Logo & Text]", "RB3FH100318-1", "rack_panel"],
    ["Chauvet Rack Mountable Ethernet-to-DMX Node", "NETXII", "lighting_interface"],
  ])("%s -> %s", (desc, pn, expected) => {
    expect(categorise(desc, pn)).toBe(expected);
  });
});
