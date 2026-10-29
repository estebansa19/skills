#!/usr/bin/env node
/**
 * Repo-wide skill validation. Run by .github/workflows/validate.yml and by hand:
 *
 *   node .github/scripts/validate-skills.mjs
 *
 * WHY THIS EXISTS RATHER THAN A BARE `skills-ref validate`
 * -------------------------------------------------------
 * `skills-ref validate` accepts ONLY the six spec fields and rejects everything else.
 * But this library deliberately uses Claude Code's frontmatter extensions — chiefly
 * `disable-model-invocation`, without which Claude can auto-run /work-implement or a
 * --post triage mid-task, which is a safety property we are not willing to trade away.
 *
 * So we do both, which is strictly stronger than either alone:
 *   1. run `skills-ref validate` against a copy of the skill whose frontmatter is
 *      reduced to the spec fields  -> the spec fields are genuinely spec-valid;
 *   2. assert every remaining key is on the documented extension allowlist
 *      -> a typo'd or invented key still fails, which neither check catches alone.
 */
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const MAX_BODY_LINES = 500;

/** Agent Skills spec frontmatter fields (agentskills.io/specification). */
const SPEC_FIELDS = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);

/** Claude Code extensions this repo allows. Documented in docs/authoring.md §Frontmatter. */
const ALLOWED_EXTENSIONS = new Set([
  "argument-hint", "arguments", "when_to_use", "model", "effort", "context",
  "agent", "background", "hooks", "paths", "shell",
  "disable-model-invocation", "user-invocable", "disallowed-tools",
]);

/**
 * Skills the model must not auto-invoke.
 *
 * NOT simply "everything with side effects" any more. `commit` and `create-pr` were
 * deliberately exempted so Claude can drive them when asked to ship something, instead of
 * the user having to type the slash command by hand. The trade is real and was made with
 * it in view: nothing but the session's own instructions now stops a commit landing
 * mid-task. `create-pr` still gates its push behind Step 4's approval; `commit` has no
 * such gate, which is the sharp edge of this decision.
 *
 * The five below keep the guard: `work-implement` writes code and runs migrations, `build`
 * scaffolds projects and installs dependencies, `work-debug-escalation` edits code,
 * `deep-review` posts to GitHub, and `work-triage-escalations` writes to Jira and Slack.
 */
const SIDE_EFFECT_SKILLS = new Set(["work-implement", "build", "work-debug-escalation", "work-triage-escalations", "deep-review", "god-mode", "babysit", "land"]);

/**
 * Project facts that must never appear in a skill without the `work-` prefix. Those run in
 * ANY repo; anything true of one setup only belongs in a `work-*` skill.
 *
 * `staging` is matched only in BRANCH-REFERENCE forms. The bare word is ordinary English
 * ("prompts before staging anything"), and a check that cannot tell the verb from the
 * branch name just teaches you to write worse prose to appease it.
 */
const COUPLING = [
  [/\borigin\/staging\b|`staging`|\bstaging\.\.\.|--base\s+staging|\bvs\.?\s+staging\b/i, "the staging branch"],
  [/script\/test/i,                "script/test"],
  [/\batlassian\b/i,              "atlassian"],
];

/**
 * Values private to one workplace, which this public repo must not carry in any file, a work-
 * skill included: a skill asks for them, or finds them, when it runs.
 */
const PRIVATE = [
  [/\b[CDGUW](?=[A-Z0-9]*\d)[A-Z0-9]{8,10}\b/,                            "a Slack id"],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i, "a UUID, such as a Jira cloud id"],
  [/\b(?!example\.)[a-z0-9-]+\.atlassian\.net\b/i,                      "an Atlassian site"],
];

const errors = [];
const warnings = [];
const fail = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    if (e === ".git" || e === "node_modules" || e === ".generated" || e === "dist") continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const allFiles = walk(ROOT);
const skillFiles = allFiles.filter((f) => basename(f) === "SKILL.md");
const agentFiles = allFiles.filter((f) => f.includes("/agents/") && f.endsWith(".md") && basename(f) !== "README.md");

/** The repo root is the one plugin: its manifest, and the files that are its components. */
const manifest = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"));
const componentFiles = allFiles.filter((f) => /^(skills|agents)\//.test(relative(ROOT, f)));
const agentExists = (ref) => {
  const [plugin, agent] = ref.includes(":") ? ref.split(":") : [manifest.name, ref];
  return plugin === manifest.name && agentFiles.some((a) => basename(a, ".md") === agent);
};

/** Minimal frontmatter reader: top-level `key:` lines between the leading `---` fences. */
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return null;
  const keys = [];
  const values = {};
  for (const line of m[1].split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z0-9_-]+):(.*)$/);
    if (km) { keys.push(km[1]); values[km[1]] = km[2].trim(); }
  }
  return { raw: m[1], block: m[0], keys, values, body: text.slice(m[0].length) };
}

console.log(`Validating ${skillFiles.length} skills, ${agentFiles.length} agents\n`);

for (const file of skillFiles) {
  const rel = relative(ROOT, file);
  const dir = dirname(file);
  const dirName = basename(dir);
  const text = readFileSync(file, "utf8");
  const fm = frontmatter(text);

  if (!fm) { fail(`${rel}: no YAML frontmatter`); continue; }

  // --- name matches directory ------------------------------------------------
  const name = fm.values.name?.replace(/^["']|["']$/g, "");
  if (name !== dirName) fail(`${rel}: name "${name}" != directory "${dirName}"`);
  if (name && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) fail(`${rel}: name "${name}" is not lowercase-hyphen`);

  // --- size ------------------------------------------------------------------
  const lines = text.split("\n").length;
  if (lines > MAX_BODY_LINES) fail(`${rel}: ${lines} lines exceeds ${MAX_BODY_LINES}`);

  // --- frontmatter keys: spec vs documented extension ------------------------
  const unknown = fm.keys.filter((k) => !SPEC_FIELDS.has(k) && !ALLOWED_EXTENSIONS.has(k));
  if (unknown.length) fail(`${rel}: frontmatter keys neither spec nor documented extension: ${unknown.join(", ")}`);

  // --- side-effect skills declare their invocation mode ----------------------
  // A work- version of a guarded skill keeps the guard.
  const guarded = SIDE_EFFECT_SKILLS.has(dirName) || SIDE_EFFECT_SKILLS.has(dirName.replace(/^work-/, ""));
  if (guarded && fm.values["disable-model-invocation"] !== "true") {
    fail(`${rel}: side-effect skill must set disable-model-invocation: true`);
  }

  // --- spec fields are spec-valid (skills-ref on a spec-only copy) -----------
  const tmp = mkdtempSync(join(tmpdir(), "skillval-"));
  const specOnly = fm.keys.filter((k) => SPEC_FIELDS.has(k));
  // Keep the spec fields and the nested lines under them; a continuation whose parent was
  // dropped has to go too, or the reduced copy is not valid YAML.
  const pruned = [];
  let keeping = true;
  for (const line of fm.raw.split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z0-9_-]+):/);
    if (km) keeping = specOnly.includes(km[1]);
    if (keeping) pruned.push(line);
  }
  const skillDir = join(tmp, dirName);
  execFileSync("mkdir", ["-p", skillDir]);
  writeFileSync(join(skillDir, "SKILL.md"), `---\n${pruned.join("\n")}\n---\n${fm.body}`);
  try {
    execFileSync("npx", ["--yes", "skills-ref@0.1.5", "validate", skillDir], { stdio: "pipe" });
  } catch (e) {
    fail(`${rel}: spec fields rejected by skills-ref:\n      ${String(e.stdout || e.message).trim().split("\n").join("\n      ")}`);
  }

  // --- relative links resolve ------------------------------------------------
  for (const [, link] of text.matchAll(/\]\((\.\/[^)\s]+|\.\.\/[^)\s]+)\)/g)) {
    const target = resolve(dir, link.split("#")[0]);
    if (!existsSync(target)) fail(`${rel}: broken relative link ${link}`);
  }

  // --- every dispatched subagent has an agent file (or a declared fallback) --
  // A plugin agent is dispatched as <plugin>:<agent>; a bare name matches any agent file.
  const dispatched = new Set([...text.matchAll(/subagent_type[":\s=]+["'`]?([a-z0-9:-]+)/gi)].map((m) => m[1]));
  dispatched.delete("general-purpose");
  const declaresFallback = /general-purpose/.test(text);
  for (const agent of dispatched) {
    if (agentExists(agent)) continue;
    const msg = `${rel}: dispatches subagent_type "${agent}" with no agent file in the repo`;
    declaresFallback ? warn(`${msg} (declares a general-purpose fallback)`) : fail(msg);
  }
  // Every `core:<name>` this skill names (an agent or a /command) must resolve;
  // `work:` is the retired plugin.
  for (const [, plugin, ref] of text.matchAll(new RegExp(`(?<![\\w-])(${manifest.name}|work):([a-z0-9-]+)`, "g"))) {
    if (plugin === "work") fail(`${rel}: names work:${ref} — the work plugin is gone; it is ${manifest.name}:work-${ref}`);
    else if (!agentExists(ref) && !existsSync(join(ROOT, "skills", ref, "SKILL.md"))) {
      fail(`${rel}: names ${plugin}:${ref}, but there is no agents/${ref}.md or skills/${ref}/`);
    }
  }

  // --- Claude Code fills ${CLAUDE_PLUGIN_ROOT} in; nothing does for OpenCode --
  if (text.includes("${CLAUDE_PLUGIN_ROOT}")) {
    fail(`${rel}: \${CLAUDE_PLUGIN_ROOT} in a skill has no OpenCode equivalent — use \${CLAUDE_SKILL_DIR} with a fallback`);
  }

  // --- only work-* skills carry project facts -------------------------------
  if (!dirName.startsWith("work-")) {
    text.split("\n").forEach((line, i) => {
      for (const [re, label] of COUPLING) {
        if (re.test(line)) fail(`${rel}:${i + 1}: project fact "${label}" in a skill without the work- prefix: ${line.trim().slice(0, 70)}`);
      }
    });
  }
}

// --- nothing private, in any file ---------------------------------------------------
for (const file of allFiles) {
  const rel = relative(ROOT, file);
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    for (const [re, label] of PRIVATE) {
      if (re.test(line)) fail(`${rel}:${i + 1}: ${label} — the repo is public; ask for it or find it at run time: ${line.trim().slice(0, 70)}`);
    }
  });
}

// --- agent identity + repo-relative-path regression guard --------------------
for (const file of agentFiles) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");

  // Claude Code resolves an agent by its FRONTMATTER name, not its filename; keep them the
  // same string so `<plugin>:<file name>` is what a skill dispatches. And it loads agents
  // only from the plugin's root agents/ directory — not from a path the manifest lists, and
  // not through a symlink — so that is the only place an agent file can live.
  if (!/^agents\/[^/]+\.md$/.test(rel)) {
    fail(`${rel}: an agent must live in the root agents/ directory — Claude Code loads agents from nowhere else`);
  }
  const declared = text.match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const fileName = basename(file, ".md");
  if (declared !== fileName) fail(`${rel}: declares name "${declared}" but the file is "${fileName}.md" — they must match`);
  for (const [, path] of text.matchAll(/`(\.?\/?\.?(?:claude|agents)\/skills\/[^`]*)`/g)) {
    fail(`${rel}: repo-relative reference path "${path}" — the orchestrator must pass an absolute path`);
  }
  if (/from repo root/i.test(text)) fail(`${rel}: "from repo root" path instruction — resolves in only one install layout`);
}

// --- no plugin options: a setting is a line in the skill's Configuration section ------
// The plugin declares no userConfig, so nothing fills in a ${user_config.*}: it would reach the
// model as a raw placeholder. A value that differs at work belongs in the skill's work- version.
if (manifest.userConfig) fail(".claude-plugin/plugin.json: declares userConfig — a setting goes in the skill's Configuration section, its work value in a work- version");
for (const file of componentFiles.filter((f) => f.endsWith(".md"))) {
  if (readFileSync(file, "utf8").includes("${user_config.")) {
    fail(`${relative(ROOT, file)}: \${user_config.…} — there are no plugin options; write the value in the skill's Configuration section`);
  }
}

// --- a work- version runs its base skill with its own values -------------------------
// work-<name> follows <dir>/../<name>/SKILL.md with its Configuration in place of the base's:
// a key the base does not read is an override that does nothing, and a tool the base gained
// would prompt only in the work version.
const configKeys = (text) =>
  new Set([...(text.split(/^## Configuration$/m)[1]?.split(/^## /m)[0] ?? "").matchAll(/^- ([a-z_]+): /gm)].map((m) => m[1]));
for (const file of skillFiles.filter((f) => basename(dirname(f)).startsWith("work-"))) {
  const base = basename(dirname(file)).slice("work-".length);
  const baseFile = join(ROOT, "skills", base, "SKILL.md");
  if (!existsSync(baseFile)) continue;   // a work-only skill, not a version of one
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  const baseText = readFileSync(baseFile, "utf8");
  if (!text.includes(`<dir>/../${base}/SKILL.md`)) fail(`${rel}: a work version reads \`<dir>/../${base}/SKILL.md\` and follows it`);
  const baseKeys = configKeys(baseText);
  for (const key of configKeys(text)) {
    if (!baseKeys.has(key)) fail(`${rel}: sets "${key}", which the Configuration of skills/${base}/SKILL.md does not have`);
  }
  if (frontmatter(text)?.values["allowed-tools"] !== frontmatter(baseText)?.values["allowed-tools"]) {
    fail(`${rel}: allowed-tools differs from skills/${base}/SKILL.md — copy the base's line`);
  }
}

// --- retired installer remnants --------------------------------------------------
for (const file of skillFiles) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, "utf8");
  for (const pat of [
    "Read `.agents/profile.yml`",
    "profile.yml` →",
    "when present; works without one",
    "integrations.",
    "CONFIG-BEGIN",
    "bake_hash",
    "skills setup",
    "skills configure",
  ]) {
    if (text.includes(pat)) fail(`${rel}: retired installer remnant "${pat}" — settings live in the skill's Configuration section now`);
  }
}

for (const w of warnings) console.log(`  WARN  ${w}`);
for (const e of errors) console.log(`  FAIL  ${e}`);
console.log(`\n${errors.length ? "FAILED" : "OK"} — ${errors.length} error(s), ${warnings.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
