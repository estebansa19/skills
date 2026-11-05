#!/usr/bin/env node
// The escalation queue for work-triage-escalations: which tickets in the channel are still
// unclaimed. The bot posts with no reactions and the team reacts as it works (👀 claimed,
// 💬 triaged, ✅ done), so any reaction on any of a ticket's messages means it was picked up.
//
//   node queue.mjs <messages.json> --key-pattern '\bEE-\d+\b'
//   node queue.mjs --selftest
//
// Input: a JSON array [{ ts, text, reactions: [names] }], newest or oldest first, or the raw
// text that slack_read_channel returns. Output: JSON { unclaimed, claimed }, each newest first.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function buildQueue(messages, { keyPattern }) {
  const byKey = new Map();
  for (const m of messages) {
    if (!m.text) continue;
    for (const key of new Set(m.text.match(new RegExp(keyPattern, "g")) ?? [])) {
      const t = byKey.get(key) ?? { key, slackTs: m.ts, threadTs: m.thread_ts ?? null, reactions: new Set() };
      if (cmpTs(m.ts, t.slackTs) > 0) Object.assign(t, { slackTs: m.ts, threadTs: m.thread_ts ?? null });
      for (const r of m.reactions ?? []) t.reactions.add(r);
      byKey.set(key, t);
    }
  }
  const tickets = [...byKey.values()]
    .map((t) => ({ ...t, reactions: [...t.reactions] }))
    .sort((a, b) => cmpTs(b.slackTs, a.slackTs));
  return {
    unclaimed: tickets.filter((t) => t.reactions.length === 0),
    claimed: tickets.filter((t) => t.reactions.length > 0).map(({ key, reactions }) => ({ key, reactions })),
  };
}

// Slack ts strings compare as numbers; string compare breaks when the integer part grows.
function cmpTs(a, b) {
  const [ai, af = ""] = String(a).split(".");
  const [bi, bf = ""] = String(b).split(".");
  return ai.length - bi.length || ai.localeCompare(bi) || af.localeCompare(bf);
}

// slack_read_channel returns one text blob: "=== Message from … ===" blocks with a
// "Message TS:" line and, in the detailed read, "Reactions: eyes (1), bug (2)".
export function parseReadChannelText(raw) {
  return raw.split(/^=== Message from .+ ===\s*$/m).slice(1).flatMap((block) => {
    const ts = block.match(/^\s*Message TS:\s*(\S+)/m)?.[1];
    if (!ts) return [];
    const line = block.match(/^\s*Reactions:\s*(.+)$/m)?.[1] ?? "";
    const reactions = line.split(",").map((r) => r.replace(/\(\d+\)/, "").trim()).filter(Boolean);
    return [{ ts, text: block, reactions }];
  });
}

function load(path) {
  const raw = readFileSync(path, "utf8");
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : parseReadChannelText(String(data.messages ?? data));
  } catch {
    return parseReadChannelText(raw);
  }
}

function selftest() {
  const eq = (actual, expected, label) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`FAIL ${label}\n  expected ${JSON.stringify(expected)}\n  actual   ${JSON.stringify(actual)}`);
    }
  };
  const keyPattern = "\\bEE-\\d+\\b";
  const q = buildQueue(
    [
      { ts: "900.1", text: "EE-1 twice EE-1 and EE-2", reactions: [] },
      { ts: "1000.1", text: "EE-2 again", thread_ts: "990.0", reactions: ["eyes"] },
      { ts: "800.1", text: "EE-3, not FREE-3 or VULN-9", reactions: [] },
      { ts: "750.1", text: "EE-4", reactions: ["speech_balloon"] },
      { ts: "700.1", text: "no key here", reactions: ["eyes"] },
      { ts: "600.1", reactions: [] },
    ],
    { keyPattern },
  );
  eq(q.unclaimed.map((t) => t.key), ["EE-1", "EE-3"], "unclaimed keys newest first");
  eq(q.claimed.map((t) => t.key), ["EE-2", "EE-4"], "any reaction on any of a key's messages claims it");
  eq(q.unclaimed[0], { key: "EE-1", slackTs: "900.1", threadTs: null, reactions: [] }, "reply target and no duplicates");
  eq(cmpTs("10000.0", "9999.9") > 0, true, "ts compares numerically");

  const blob =
    "Channel: #x\n\n=== Message from Bot (U1) at t ===\nMessage TS: 2.2\n<https://x/browse/EE-7>: broken\n" +
    "Reactions: white_check_mark (1), eyes (2)\n\n=== Message from Bot (U1) at t ===\nMessage TS: 1.1\nEE-8 new\n";
  const fromBlob = buildQueue(parseReadChannelText(blob), { keyPattern });
  eq([fromBlob.unclaimed.map((t) => t.key), fromBlob.claimed], [["EE-8"], [{ key: "EE-7", reactions: ["white_check_mark", "eyes"] }]], "parses the read_channel text");
  console.log("queue.mjs self-test: PASS");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) {
    selftest();
  } else {
    const i = args.indexOf("--key-pattern");
    const keyPattern = args[i + 1];
    const path = args.find((_, j) => j !== i && j !== i + 1);
    if (i < 0 || !keyPattern || !path) {
      console.error("usage: queue.mjs <messages.json> --key-pattern <regex>");
      process.exit(1);
    }
    console.log(JSON.stringify(buildQueue(load(path), { keyPattern }), null, 2));
  }
}
