#!/usr/bin/env node
/**
 * Build the OpenCode bundle:
 *
 *   node .github/scripts/build-opencode.mjs <out-dir>
 *
 * OpenCode reads plain skill folders from ~/.config/opencode/skills/ — it does not load
 * Claude Code plugins. This copies every skill into one flat directory. The release workflow
 * publishes the result as `opencode-skills.tar.gz`; `install.sh --opencode` unpacks it.
 *
 * A skill that dispatches one of the plugin's agents (`<plugin>:<agent>` in its text) gets a
 * copy of that agent in its own `agents/`, since Claude Code loads agents only from the
 * plugin root and OpenCode has no plugin root — the skill reads the brief and runs it inline.
 *
 * Two frontmatter flags are translated, because OpenCode spells them differently:
 *   user-invocable: true            -> metadata "opencode/slash": "true"  (a /command)
 *   disable-model-invocation: true  -> metadata "opencode/autoinvoke": "false"
 *
 * The out dir also gets `.estebansa19-skills`, the list of skill folders in the bundle, so
 * install.sh can prune what it installed before and never touch a folder it did not.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve, relative } from "node:path";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const MANIFEST = ".estebansa19-skills";

const [outArg] = process.argv.slice(2);
if (!outArg) {
  console.error("usage: build-opencode.mjs <out-dir>");
  process.exit(2);
}
const out = resolve(outArg);
const fail = (m) => { console.error(`build-opencode: ${m}`); process.exit(1); };

const manifest = JSON.parse(readFileSync(join(ROOT, ".claude-plugin", "plugin.json"), "utf8"));
const agents = readdirSync(join(ROOT, "agents")).filter((f) => f.endsWith(".md")).map((f) => f.slice(0, -3));

const walk = (dir) => readdirSync(dir).flatMap((e) => {
  const p = join(dir, e);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

/** Add OpenCode's spelling of the two invocation flags to a SKILL.md frontmatter. */
function translateFrontmatter(text, file) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) fail(`${file}: no frontmatter`);
  const lines = m[1].split("\n");
  const flag = (k) => lines.some((l) => l.replace(/\s/g, "") === `${k}:true`);
  const extra = [];
  if (flag("user-invocable")) extra.push('  "opencode/slash": "true"');
  if (flag("disable-model-invocation")) extra.push('  "opencode/autoinvoke": "false"');
  if (!extra.length) return text;
  const at = lines.findIndex((l) => /^metadata:\s*$/.test(l));
  if (at === -1) lines.push("metadata:", ...extra);
  else lines.splice(at + 1, 0, ...extra);
  return `---\n${lines.join("\n")}\n---\n${text.slice(m[0].length)}`;
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const names = [];

for (const skill of readdirSync(join(ROOT, "skills"))) {
  const src = join(ROOT, "skills", skill);
  if (!existsSync(join(src, "SKILL.md"))) continue;
  names.push(skill);
  const dst = join(out, skill);
  cpSync(src, dst, { recursive: true });
  const skillText = readFileSync(join(src, "SKILL.md"), "utf8");
  for (const agent of agents) {
    if (!skillText.includes(`${manifest.name}:${agent}`)) continue;
    mkdirSync(join(dst, "agents"), { recursive: true });
    cpSync(join(ROOT, "agents", `${agent}.md`), join(dst, "agents", `${agent}.md`));
  }

  for (const file of walk(dst).filter((f) => f.endsWith(".md"))) {
    const rel = relative(out, file);
    let text = readFileSync(file, "utf8");
    if (text.includes("${CLAUDE_PLUGIN_ROOT}")) fail(`${rel}: \${CLAUDE_PLUGIN_ROOT} has no OpenCode equivalent — pass an absolute path instead`);
    if (file.endsWith("/SKILL.md") && relative(dst, file) === "SKILL.md") text = translateFrontmatter(text, rel);
    writeFileSync(file, text);
  }
}

writeFileSync(join(out, MANIFEST), names.sort().join("\n") + "\n");
console.log(`Built the OpenCode bundle (${names.length} skills) in ${out}`);
