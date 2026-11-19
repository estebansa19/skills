#!/usr/bin/env node
// Says how much verification a PR needs, from the files it changes.
//
//   node classify.mjs <pr>        prints `docs` or `code` for that PR (uses gh)
//   node classify.mjs --selftest  checks the rules below
//
// `docs` means nothing in the diff can run: prose and images at the repo root or under docs/,
// none of them an agent's instructions, and no renames. Anything else, or anything unsure, is `code`.
import { execFileSync } from "node:child_process";

const PROSE = /\.(md|rst|adoc|png|jpe?g|gif|svg|webp)$/i;
const INSTRUCTIONS = /(^|\/)(SKILL|CLAUDE|CLAUDE\.local|AGENTS?|GEMINI|CONVENTIONS)\.md$/i;
// Markdown elsewhere can be content a build renders or a prompt a tool reads.
const atDocsLocation = (path) => !path.includes("/") || path.startsWith("docs/");
// gh shows only a rename's new path, so the old one may have been code.
const keepsPath = (changeType) => changeType !== "RENAMED" && changeType !== "COPIED";

export function tier(files) {
  const isDoc = ({ path, changeType }) =>
    PROSE.test(path) && !INSTRUCTIONS.test(path) && atDocsLocation(path) && keepsPath(changeType);
  return files.length > 0 && files.every(isDoc) ? "docs" : "code";
}

function selftest() {
  const modified = (...paths) => paths.map((path) => ({ path, changeType: "MODIFIED" }));
  const cases = [
    [modified("README.md"), "docs"],
    [modified("next-sessions.md", "CHANGELOG.md"), "docs"],
    [modified("docs/install.md", "docs/img/flow.png"), "docs"],
    [modified("README.md", "src/slugify.js"), "code"],
    [modified("CLAUDE.md"), "code"],
    [modified("CLAUDE.local.md"), "code"],
    [modified("AGENT.md"), "code"],
    [modified("skills/land/SKILL.md"), "code"],
    [modified("skills/land/references/brief.md"), "code"],
    [modified("src/content/blog/post.md"), "code"],
    [modified(".github/pull_request_template.md"), "code"],
    [modified("requirements.txt"), "code"],
    [modified("CMakeLists.txt"), "code"],
    [modified("docs/conf.py"), "code"],
    [modified("LICENSE"), "code"],
    [[{ path: "docs/feature.md", changeType: "RENAMED" }], "code"],
    [[], "code"],
  ];
  for (const [files, expected] of cases) {
    const actual = tier(files);
    if (actual !== expected) throw new Error(`FAIL ${JSON.stringify(files)}: expected ${expected}, got ${actual}`);
  }
  console.log(`ok    ${cases.length} cases`);
}

const [arg] = process.argv.slice(2);
if (arg === "--selftest") {
  selftest();
} else if (arg) {
  const out = execFileSync("gh", ["pr", "view", arg, "--json", "files,changedFiles"], { encoding: "utf8" });
  const { files, changedFiles } = JSON.parse(out);
  // gh lists at most 100 files; when it can't show them all, don't guess.
  console.log(files.length === changedFiles ? tier(files) : "code");
} else {
  console.error("usage: classify.mjs <pr> | --selftest");
  process.exit(2);
}
