#!/usr/bin/env node
/**
 * Generate README.md from the plugin manifest and the skill frontmatter.
 * Never hand-edit README.md — CI regenerates it and fails on a diff. The stale README that
 * still advertised /proposal-analyzer months after it was deleted is why this is a script
 * and not a convention.
 *
 *   node .github/scripts/gen-readme.mjs          # write
 *   node .github/scripts/gen-readme.mjs --check  # exit 1 if the file is out of date
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const check = process.argv.includes("--check");

const fm = (t) => {
  const m = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!m) return {};
  const o = {};
  for (const line of m[1].split(/\r?\n/)) {
    const km = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (km) o[km[1]] = km[2].replace(/^["']|["']$/g, "");
  }
  return o;
};
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
/** First sentence of a description, escaped for a markdown table cell. */
const gist = (d) => {
  const s = (d || "").split(/(?<=\.)\s/)[0].trim();
  const t = s.length > 190 ? s.slice(0, 187).replace(/[\s,;:]+\S*$/, "") + "…" : s;
  return t.replace(/\|/g, "\\|");   // a bare pipe would split the row
};

const marketplace = json(join(ROOT, ".claude-plugin", "marketplace.json"));
const manifest = json(join(ROOT, ".claude-plugin", "plugin.json"));
const skills = readdirSync(join(ROOT, "skills"))
  .filter((d) => statSync(join(ROOT, "skills", d)).isDirectory() && existsSync(join(ROOT, "skills", d, "SKILL.md")))
  .sort()
  .map((d) => ({ name: d, ...fm(readFileSync(join(ROOT, "skills", d, "SKILL.md"), "utf8")) }));
const agents = readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3)).sort();

const skillRow = (s) => s["user-invocable"] === "false"
  ? `| [\`${s.name}\`](./skills/${s.name}/SKILL.md) | ${gist(s.description)} *(loaded by another skill, not typed)* |`
  : `| [\`/${manifest.name}:${s.name}\`](./skills/${s.name}/SKILL.md) | ${gist(s.description)} |`;
const table = (rows) => `| Skill | What it does |
|---|---|
${rows.map(skillRow).join("\n")}`;
const isWork = (s) => s.name.startsWith("work-");

const md = `# skills

My day-to-day [Agent Skills](https://agentskills.io/specification), in one repo: installed as
one Claude Code plugin, with a prebuilt skills-only bundle for OpenCode.

The \`god-mode\` entry point, the \`principles\`, and the \`how\`, \`why\`, \`teach\`, \`babysit\` and
\`land\` skills are based on [pstack](https://github.com/cursor/plugins/tree/main/pstack),
modified to fit my requirements; its MIT notice is kept in the [LICENSE](./LICENSE).

> **This file is generated** by \`.github/scripts/gen-readme.mjs\` from the plugin manifest and
> the skill frontmatter. Edit those, not this file; CI fails on a diff.

## Install

One command, no questions:

\`\`\`bash
gh api repos/estebansa19/skills/contents/install.sh -H "Accept: application/vnd.github.raw" | bash
\`\`\`

For OpenCode, append \`-s -- --opencode\`.

The installer registers this repo as the \`${marketplace.name}\` plugin marketplace with auto-update on
and installs the \`${manifest.name}\` plugin; Claude Code keeps it current from there. OpenCode gets only
the skill folders, from the \`opencode\` release CI rebuilds on every push to \`master\`.
Details: [docs/install.md](./docs/install.md).

## Skills

${manifest.description}

${table(skills.filter((s) => !isWork(s)))}

### Work

A \`work-<name>\` skill is the work version of \`<name>\`: it runs that skill with the work
settings in place of its own. The rest exist only at work.

${table(skills.filter(isWork))}

Agents: ${agents.map((a) => `\`${manifest.name}:${a}\``).join(", ")}.

## Layout

\`\`\`
.claude-plugin/     marketplace.json and plugin.json: the repo root is the one plugin
skills/<name>/      every skill; work-* ones are work versions or work-only
agents/             every subagent the skills dispatch
install.sh          Claude Code by default, --opencode for OpenCode
.github/scripts/    check.sh, the validator, the OpenCode bundle builder, this README's generator
\`\`\`

## Docs

- [Installing and updating](./docs/install.md) — both harnesses, this machine's live checkout
- [Writing a skill](./docs/authoring.md) — frontmatter policy, settings, agents, degradation rules
`;

const out = join(ROOT, "README.md");
if (check) {
  const cur = existsSync(out) ? readFileSync(out, "utf8") : "";
  if (cur !== md) {
    console.error("README.md is out of date — run: node .github/scripts/gen-readme.mjs");
    process.exit(1);
  }
  console.log("README.md is up to date.");
} else {
  writeFileSync(out, md);
  console.log(`Wrote README.md (${md.split("\n").length} lines)`);
}
