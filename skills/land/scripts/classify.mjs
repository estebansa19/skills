#!/usr/bin/env node
// Says how much verification a PR needs, from the paths it changes.
//
//   node classify.mjs <pr>        prints `docs` or `code` for that PR (uses gh)
//   node classify.mjs --selftest  checks the rules below
//
// `docs` means nothing in the diff can run: prose and images at the repo root or under docs/,
// and none of them an agent's instructions. Anything else, or anything unsure, is `code`.
import { execFileSync } from "node:child_process";

const PROSE = /\.(md|txt|rst|adoc|png|jpe?g|gif|svg|webp)$/i;
const INSTRUCTIONS = /(^|\/)(SKILL|CLAUDE|AGENTS|GEMINI)\.md$/i;
// Markdown elsewhere can be content a build renders or a prompt a tool reads.
const atDocsLocation = (path) => !path.includes("/") || path.startsWith("docs/");

export function tier(paths) {
  const isDoc = (p) => PROSE.test(p) && !INSTRUCTIONS.test(p) && atDocsLocation(p);
  return paths.length > 0 && paths.every(isDoc) ? "docs" : "code";
}

function selftest() {
  const cases = [
    [["README.md"], "docs"],
    [["next-sessions.md", "CHANGELOG.md"], "docs"],
    [["docs/install.md", "docs/img/flow.png"], "docs"],
    [["README.md", "src/slugify.js"], "code"],
    [["CLAUDE.md"], "code"],
    [["skills/land/SKILL.md"], "code"],
    [["skills/land/references/brief.md"], "code"],
    [["src/content/blog/post.md"], "code"],
    [[".github/pull_request_template.md"], "code"],
    [["docs/conf.py"], "code"],
    [["LICENSE"], "code"],
    [[], "code"],
  ];
  for (const [paths, expected] of cases) {
    const actual = tier(paths);
    if (actual !== expected) throw new Error(`FAIL ${JSON.stringify(paths)}: expected ${expected}, got ${actual}`);
  }
  console.log(`ok    ${cases.length} cases`);
}

const [arg] = process.argv.slice(2);
if (arg === "--selftest") {
  selftest();
} else if (arg) {
  const out = execFileSync("gh", ["pr", "diff", arg, "--name-only"], { encoding: "utf8" });
  console.log(tier(out.split("\n").filter(Boolean)));
} else {
  console.error("usage: classify.mjs <pr> | --selftest");
  process.exit(2);
}
