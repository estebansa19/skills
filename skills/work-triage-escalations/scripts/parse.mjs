#!/usr/bin/env node
/**
 * EE-key parser + work-list selector for the `work-triage-escalations` skill.
 *
 * `parseMessages()` was ported verbatim from `triage-worker/src/slack/parse.ts`
 * (the tested parser) into a dependency-free ES module the skill runs in-session
 * with plain `node`. The parsing logic is identical to the source; only the
 * TypeScript types were stripped and a CLI + self-test (the source's unit tests)
 * were added. `selectTickets()` (S5) layers the deterministic work-list selection
 * on top: group hits into distinct tickets, drop the already-triaged ones (marker
 * reaction present), order newest-first, and cap to `--max-tickets`.
 *
 * `parseMessages()` takes the raw messages returned by the Slack MCP read and
 * extracts every `EE-<number>` Jira key it can find in message text. It has no
 * I/O and no dependencies, so it is exhaustively unit-testable (see --selftest).
 *
 * Assumption [A3]: the Jira key appears as plain text in the message (including
 * inside Slack link markup like `<url|EE-1234>`). Keys that live only in
 * attachments/blocks are out of scope for the POC.
 *
 * A raw Slack message (the subset `slack_read_channel` returns that we read):
 *   ts        {string}   the message's own timestamp/id, e.g. "1720100000.000100"
 *   text      {string=}  message body; absent on some messages (e.g. file shares)
 *   thread_ts {string=}  the thread root's `ts` when the message is in a thread;
 *                        Slack sets `thread_ts === ts` on a thread's parent;
 *                        absent for a standalone message.
 *   reactions {string[]=} emoji short-names reacted on the message (detailed read).
 *
 * Each ParsedKey is { jiraKey, slackTs, threadTs, reactions }, where threadTs is
 * the thread root or null when the message is standalone (the report step replies
 * under `threadTs ?? slackTs` — a standalone bot message uses its own ts), and
 * reactions is the emoji short-names on that message — the S5 discard step drops a
 * key already bearing one of our markers.
 */

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/**
 * Matches Jira keys like `EE-1234`; `\b` avoids partial hits like `FREE-12`.
 * This is the DEFAULT only — the skill passes the project's own pattern via
 * `--key-pattern`, so the tracker prefix is not baked into the parser. Callers pass a pattern source string; `g` is added here.
 */
export const DEFAULT_KEY_PATTERN = "\\bEE-\\d+\\b";

/** Compile a pattern source into a fresh global regex (never share lastIndex). */
function keyRegex(source = DEFAULT_KEY_PATTERN) {
  return new RegExp(source, "g");
}

/**
 * The Slack reactions this skill adds to mark a ticket triaged (§6 of SKILL.md):
 * bug 🐛, data-cleanup 🧹 (broom), needs-info 🤔 (thinking_face), error 🚨
 * (rotating_light). A message carrying any of these is already handled by us, so
 * the poll-time discard step drops it. Kept in sync with §6 by hand.
 */
export const DEFAULT_MARKERS = ["bug", "broom", "thinking_face", "rotating_light"];

/** Skill default for the distinct-ticket cap (§2); the skill always passes it. */
const DEFAULT_MAX_TICKETS = 10;

/**
 * Extract Jira keys from a batch of Slack messages.
 *
 * - Messages with no text, or no key, are skipped.
 * - Multiple distinct keys in one message yield one entry each.
 * - A key repeated within one message (common in Slack link markup) yields a
 *   single entry.
 * - The same key in separate messages yields a separate entry each (dedup across
 *   messages is selectTickets()'s job, not the parser's).
 */
export function parseMessages(messages, { keyPattern = DEFAULT_KEY_PATTERN } = {}) {
  const parsed = [];
  for (const message of messages) {
    if (!message.text) continue;
    for (const jiraKey of extractKeys(message.text, keyPattern)) {
      parsed.push({
        jiraKey,
        slackTs: message.ts,
        threadTs: message.thread_ts ?? null,
        reactions: message.reactions ?? [],
      });
    }
  }
  return parsed;
}

/** Distinct Jira keys in a single string, in first-seen order. */
export function extractKeys(text, keyPattern = DEFAULT_KEY_PATTERN) {
  const matches = text.match(keyRegex(keyPattern));
  return matches ? [...new Set(matches)] : [];
}

/**
 * Turn the flat hit list into the run's work-list (S5).
 *
 * Group hits by jiraKey (collapsing cross-message repeats), union each key's
 * reactions, then split into:
 *   - triaged   — a key any of whose messages already bears a marker reaction;
 *                 dropped from the work-list (the "already triaged" signal).
 *   - untriaged — the rest, ordered newest-first (by each key's most-recent hit),
 *                 capped to maxTickets → `selected`; the overflow is `deferred`.
 * Each selected ticket carries the newest hit's slackTs/threadTs, which is the
 * reply + reaction target (matches SKILL.md §4: most-recent hit wins).
 *
 * Pure + testable — this is the safety-critical cap, kept out of model eyeballing.
 * maxTickets null = no cap.
 */
export function selectTickets(
  hits,
  { markers = DEFAULT_MARKERS, maxTickets = null } = {},
) {
  const markerSet = new Set(markers);

  const byKey = new Map();
  for (const hit of hits) {
    let entry = byKey.get(hit.jiraKey);
    if (!entry) {
      entry = { key: hit.jiraKey, hits: [], reactions: new Set() };
      byKey.set(hit.jiraKey, entry);
    }
    entry.hits.push(hit);
    for (const r of hit.reactions ?? []) entry.reactions.add(r);
  }

  const tickets = [];
  for (const entry of byKey.values()) {
    const newest = entry.hits.reduce((a, b) => (cmpTs(a.slackTs, b.slackTs) >= 0 ? a : b));
    const reactions = [...entry.reactions];
    tickets.push({
      key: entry.key,
      slackTs: newest.slackTs,
      threadTs: newest.threadTs,
      hits: entry.hits.length,
      reactions,
      triaged: reactions.some((r) => markerSet.has(r)),
    });
  }

  const byNewest = (a, b) => cmpTs(b.slackTs, a.slackTs);
  const triaged = tickets.filter((t) => t.triaged).sort(byNewest);
  const untriaged = tickets.filter((t) => !t.triaged).sort(byNewest);

  const cap = maxTickets == null ? untriaged.length : maxTickets;
  const selected = untriaged.slice(0, cap);
  const deferred = untriaged.slice(cap);

  return {
    distinct: tickets.length,
    markers: [...markerSet],
    selected: selected.map((t) => ({
      key: t.key,
      slackTs: t.slackTs,
      threadTs: t.threadTs,
      hits: t.hits,
      reactions: t.reactions,
    })),
    triaged: triaged.map((t) => ({ key: t.key, reactions: t.reactions })),
    deferred: deferred.map((t) => t.key),
    deferredCount: deferred.length,
  };
}

/** Compare two Slack `ts` strings chronologically (>0 when a is newer than b). */
function cmpTs(a, b) {
  const [as, af = "0"] = String(a).split(".");
  const [bs, bf = "0"] = String(b).split(".");
  if (as.length !== bs.length) return as.length - bs.length; // more digits = larger int
  if (as !== bs) return as < bs ? -1 : 1;
  return af === bf ? 0 : af < bf ? -1 : 1;
}

// ---------------------------------------------------------------------------
// CLI: `node parse.mjs <input.json> [--max-tickets N]` (or pipe on stdin) prints
// the parsed keys and the work-list selection. Input is whatever
// `slack_read_channel` returns, in any of these shapes:
//   - the tool's JSON envelope `{ "messages": "<formatted text>", ... }`  (claude.ai MCP)
//   - the formatted text blob on its own
//   - a JSON array of message objects `[{ ts, text, thread_ts?, reactions? }]`  (SDK/fixtures)
//   - `{ "messages": [ ...objects ] }`
// `--max-tickets N` caps the distinct un-triaged tickets selected (default 10 to
// mirror the skill; `--max-tickets all` or `0` = no cap). `--selftest` runs the tests.
// `--key-pattern <regex>` overrides the ticket-key regex (default `\bEE-\d+\b`).
// ---------------------------------------------------------------------------

/**
 * The claude.ai Slack MCP `slack_read_channel` returns messages as a single
 * formatted STRING (not JSON objects): a "Channel:" preamble followed by blocks
 * that each start with `=== Message from ... ===` and carry a `Message TS: <ts>`
 * line, and — in the detailed read — a `Reactions: name (n), ...` line. Split it
 * back into `{ ts, text, reactions }` objects the parser understands.
 *
 * thread_ts is not surfaced per-message; a thread parent has thread_ts === ts,
 * so leaving it undefined is safe — the reply parent (threadTs ?? slackTs) is
 * the message ts either way.
 */
function parseSlackReadChannelText(raw) {
  const blocks = raw.split(/^=== Message from .+ ===\s*$/gm).slice(1);
  const messages = [];
  for (const block of blocks) {
    const tsMatch = block.match(/^\s*Message TS:\s*(\S+)\s*$/m);
    if (!tsMatch) continue;
    const reactionsMatch = block.match(/^\s*Reactions:\s*(.+?)\s*$/m);
    const reactions = reactionsMatch ? parseReactionNames(reactionsMatch[1]) : [];
    const text = block.replace(/^\s*Message TS:\s*\S+\s*$/m, "").trim();
    messages.push({ ts: tsMatch[1], text, reactions });
  }
  return messages;
}

/**
 * A `slack_read_channel` "Reactions:" line is a comma-separated list of
 * `<emoji_name> (<count>)` (e.g. `Reactions: white_check_mark (1), eyes (2)`).
 * Return just the emoji short-names.
 */
function parseReactionNames(line) {
  return line
    .split(",")
    .map((chunk) => chunk.trim().replace(/\s*\(\d+\)\s*$/, "").trim())
    .filter(Boolean);
}

/** Normalize any `slack_read_channel` return shape into message objects. */
function normalizeToMessages(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return parseSlackReadChannelText(raw); // bare formatted-text blob
  }
  if (typeof data === "string") return parseSlackReadChannelText(data);
  if (Array.isArray(data)) return data;
  if (data && typeof data.messages === "string") {
    return parseSlackReadChannelText(data.messages);
  }
  if (data && Array.isArray(data.messages)) return data.messages;
  throw new Error(
    "unrecognized input: expected slack_read_channel text/JSON or a messages array",
  );
}

function runCli(pathArg, maxTickets, keyPattern) {
  const raw = readFileSync(pathArg ?? 0, "utf8");
  const messages = normalizeToMessages(raw);
  const hits = parseMessages(messages, { keyPattern });

  const counts = new Map();
  for (const { jiraKey } of hits) {
    counts.set(jiraKey, (counts.get(jiraKey) ?? 0) + 1);
  }
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, n]) => `  ${key} ×${n}`);

  const selection = selectTickets(hits, { maxTickets });

  console.log(
    `Scanned ${messages.length} message(s) → ${hits.length} key hit(s), ${counts.size} distinct key(s).`,
  );
  if (summary.length) console.log(summary.join("\n"));

  const capNote = maxTickets == null ? "" : ` (cap ${maxTickets})`;
  console.log(
    `\nWork-list: ${selection.selected.length} to triage${capNote} · ` +
      `${selection.triaged.length} already-triaged (skipped) · ` +
      `${selection.deferredCount} deferred.`,
  );
  if (selection.selected.length) {
    console.log("Selected (newest-first):");
    for (const t of selection.selected) console.log(`  ${t.key}  (ts ${t.slackTs}, ${t.hits} hit(s))`);
  }
  if (selection.triaged.length) {
    console.log("Already triaged (marker reaction present — skipped):");
    for (const t of selection.triaged) console.log(`  ${t.key}  [${t.reactions.join(", ")}]`);
  }
  if (selection.deferredCount) {
    console.log(`Deferred (beyond cap — re-run to continue): ${selection.deferred.join(", ")}`);
  }

  console.log("\nSelection (JSON):");
  console.log(JSON.stringify(selection, null, 2));
}

function runSelftest() {
  // Fixtures mirror triage-worker/src/slack/__fixtures__/messages.ts.
  const plainKey = {
    ts: "1720100000.000100",
    text: "Customer can't complete checkout — filed as EE-1234, please take a look.",
  };
  const noKey = {
    ts: "1720100100.000200",
    text: "Anyone free to jump on a billing question from support?",
  };
  const twoKeys = {
    ts: "1720100200.000300",
    text: "Looks like a dup of EE-5678 — also related to EE-9012.",
  };
  const duplicateKey = {
    ts: "1720100300.000400",
    text: "Escalation: <https://example.atlassian.net/browse/EE-3456|EE-3456> is P1.",
  };
  const threadReply = {
    ts: "1720100400.000500",
    thread_ts: "1720100400.000010",
    text: "Root caused in the invoicing job — see EE-7777.",
  };
  const noText = { ts: "1720100500.000600" };
  const allMessages = [plainKey, noKey, twoKeys, duplicateKey, threadReply, noText];

  const eq = (actual, expected, label) => {
    const a = JSON.stringify(actual);
    const e = JSON.stringify(expected);
    if (a !== e) throw new Error(`FAIL: ${label}\n  expected ${e}\n  actual   ${a}`);
  };

  eq(
    parseMessages([plainKey]),
    [{ jiraKey: "EE-1234", slackTs: "1720100000.000100", threadTs: null, reactions: [] }],
    "extracts a single key with its ts, a null thread, and empty reactions",
  );
  eq(parseMessages([noKey]), [], "skips a message with no key");
  eq(parseMessages([noText]), [], "skips a message with no text");
  eq(
    parseMessages([twoKeys]).map((r) => r.jiraKey),
    ["EE-5678", "EE-9012"],
    "returns one entry per distinct key in a multi-key message",
  );
  if (!parseMessages([twoKeys]).every((r) => r.slackTs === twoKeys.ts)) {
    throw new Error("FAIL: multi-key entries all carry the message ts");
  }
  eq(
    parseMessages([duplicateKey]),
    [{ jiraKey: "EE-3456", slackTs: "1720100300.000400", threadTs: null, reactions: [] }],
    "collapses a key repeated within one message to a single entry",
  );
  eq(
    parseMessages([threadReply]).map((r) => r.threadTs),
    ["1720100400.000010"],
    "carries thread_ts through as threadTs",
  );
  eq(
    parseMessages(allMessages).map((r) => r.jiraKey),
    ["EE-1234", "EE-5678", "EE-9012", "EE-3456", "EE-7777"],
    "processes a full batch: one entry per key across all messages",
  );

  // Input normalization: the claude.ai Slack MCP text blob → message objects,
  // including the detailed-read `Reactions:` line.
  const mcpText =
    "Channel: #demo (C1)\n\n" +
    "=== Message from Bot (U1) at 2026-07-14 16:13:18 -05 ===\n" +
    "Message TS: 111.1\n" +
    "<https://example.atlassian.net/browse/EE-2001>: refunds need voiding\n\n" +
    "=== Message from Bot (U1) at 2026-07-13 20:45:04 -05 ===\n" +
    "Message TS: 222.2\n" +
    "<https://example.atlassian.net/browse/EE-2002>: fraud score multiplier is off\n" +
    "Reactions: white_check_mark (1), eyes (1)\n";
  eq(
    parseMessages(parseSlackReadChannelText(mcpText)),
    [
      { jiraKey: "EE-2001", slackTs: "111.1", threadTs: null, reactions: [] },
      { jiraKey: "EE-2002", slackTs: "222.2", threadTs: null, reactions: ["white_check_mark", "eyes"] },
    ],
    "parses the slack_read_channel text blob into EE-key hits with reactions",
  );
  eq(
    normalizeToMessages(JSON.stringify({ messages: mcpText })).length,
    2,
    "normalizes the { messages: <text> } envelope",
  );

  // selectTickets: reaction-based discard + newest-first cap (S5).
  const markedText =
    "=== Message from Bot (U1) at t ===\n" +
    "Message TS: 300.3\n" +
    "<https://example.atlassian.net/browse/EE-4001>: already handled by us\n" +
    "Reactions: broom (1), eyes (2)\n\n" +
    "=== Message from Bot (U1) at t ===\n" +
    "Message TS: 200.2\n" +
    "<https://example.atlassian.net/browse/EE-4002>: fresh one\n";
  const marked = selectTickets(parseMessages(parseSlackReadChannelText(markedText)));
  eq(
    marked.selected,
    [{ key: "EE-4002", slackTs: "200.2", threadTs: null, hits: 1, reactions: [] }],
    "selectTickets drops a key whose message bears a marker reaction (broom)",
  );
  eq(
    marked.triaged,
    [{ key: "EE-4001", reactions: ["broom", "eyes"] }],
    "selectTickets reports the discarded (already-triaged) key",
  );

  const capHits = [
    { jiraKey: "EE-1", slackTs: "500.0", threadTs: null, reactions: [] },
    { jiraKey: "EE-2", slackTs: "400.0", threadTs: null, reactions: [] },
    { jiraKey: "EE-2", slackTs: "450.0", threadTs: "440.0", reactions: [] }, // newer hit
    { jiraKey: "EE-3", slackTs: "300.0", threadTs: null, reactions: [] },
    { jiraKey: "EE-4", slackTs: "200.0", threadTs: null, reactions: ["bug"] }, // triaged
  ];
  const capped = selectTickets(capHits, { maxTickets: 2 });
  eq(
    capped.selected.map((t) => t.key),
    ["EE-1", "EE-2"],
    "selectTickets orders untriaged newest-first and caps to maxTickets",
  );
  eq(
    capped.selected[1],
    { key: "EE-2", slackTs: "450.0", threadTs: "440.0", hits: 2, reactions: [] },
    "a multi-hit key carries its newest hit's ts/thread as the reply target",
  );
  eq(capped.deferred, ["EE-3"], "untriaged tickets beyond the cap are deferred");
  eq(capped.deferredCount, 1, "deferredCount counts the overflow");

  console.log("parse.mjs self-test: PASS (16 assertions)");
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) {
    runSelftest();
  } else {
    let maxTickets = DEFAULT_MAX_TICKETS;
    let keyPattern = DEFAULT_KEY_PATTERN;
    let pathArg;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "--max-tickets") {
        const v = args[++i];
        maxTickets = v === "all" || v === "0" ? null : Number(v);
        if (maxTickets !== null && !Number.isInteger(maxTickets)) {
          console.error(`invalid --max-tickets: ${v}`);
          process.exit(1);
        }
      } else if (a === "--key-pattern") {
        keyPattern = args[++i];
        try {
          keyRegex(keyPattern);
        } catch {
          console.error(`invalid --key-pattern: ${keyPattern}`);
          process.exit(1);
        }
      } else if (!a.startsWith("--")) {
        pathArg = a;
      }
    }
    runCli(pathArg, maxTickets, keyPattern);
  }
}
