#!/usr/bin/env bash
# Every check this repo has, in one command. Run it before committing:
#
#   bash .github/scripts/check.sh
#
# .github/workflows/validate.yml runs this same script, so local and CI cannot drift —
# which is the whole point of it existing rather than a list of commands in three docs.
#
# It is safe to run locally: the installer test points CLAUDE_CONFIG_DIR and
# OPENCODE_SKILLS_DIR at throwaway directories and never touches your real ~/.claude or
# ~/.config/opencode.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failed=()
step() {
  printf '\n\033[1m== %s\033[0m\n' "$1"; shift
  if "$@"; then return 0; fi
  failed+=("$1")
  return 0        # keep going: one report at the end beats stopping at the first failure
}

step "skills — frontmatter, size, links, agents, coupling, work versions" \
  node .github/scripts/validate-skills.mjs

step "parse.mjs self-test" \
  node skills/work-triage-escalations/scripts/parse.mjs --selftest

step "README is up to date (it is generated, never hand-edited)" \
  node .github/scripts/gen-readme.mjs --check

if command -v shellcheck >/dev/null 2>&1; then
  # Print the version: local (brew) and CI (apt) ship different shellcheck builds with
  # different rulesets — 0.11 dropped SC2015, the Ubuntu build still emits it — so a clean
  # local run does not prove a clean CI run. This puts the reason in both logs.
  printf '\n\033[1m== shellcheck %s\033[0m\n' "$(shellcheck --version | awk '/^version:/{print $2}')"
  if shellcheck install.sh .github/scripts/check.sh; then
    printf '  ok    2 scripts clean\n'
  else
    failed+=("shellcheck")
  fi
else
  printf '\n\033[1m== shellcheck\033[0m\n  SKIPPED — not installed (brew install shellcheck)\n'
fi

# Claude Code's own validator is the authority on the manifests; `.` checks both. The one warning we accept
# is the missing `version`: leaving it out is what makes installs track commits instead of
# waiting for a bump (docs/install.md). Its "Plugin directory checks" section (icon, license)
# is for submitting to Anthropic's plugin directory, which this marketplace doesn't do.
plugin_validate() {
  local out rc=0
  out="$(claude plugin validate . 2>&1)" || { printf '%s\n' "$out"; return 1; }
  if printf '%s\n' "$out" | sed '/^Plugin directory checks for /,$d' | grep '❯' \
    | grep -v 'version: No version specified' | grep -q .; then
    printf '%s\n' "$out"; rc=1
  fi
  [ "$rc" -eq 0 ] && printf '  ok    marketplace and plugin validate\n'
  return "$rc"
}

# The bundle, built exactly as the release workflow builds it.
opencode_bundle() {
  local dir="$WORK/bundle" skill name
  node .github/scripts/build-opencode.mjs "$dir" >/dev/null || return 1
  if grep -rlE '\$\{(user_config\.|CLAUDE_PLUGIN_ROOT)' "$dir"; then
    printf '  FAIL  the bundle still has placeholders (files above)\n'; return 1
  fi
  for skill in skills/*/; do
    name="$(basename "$skill")"
    [ -f "$dir/$name/SKILL.md" ] || { printf '  FAIL  the bundle is missing %s\n' "$name"; return 1; }
    grep -qx "$name" "$dir/.estebansa19-skills" || { printf '  FAIL  the manifest omits %s\n' "$name"; return 1; }
    if grep -q '^user-invocable: true' "$skill/SKILL.md" && ! grep -q '"opencode/slash": "true"' "$dir/$name/SKILL.md"; then
      printf '  FAIL  %s is user-invocable but not an OpenCode slash command\n' "$name"; return 1
    fi
    if grep -q '^disable-model-invocation: true' "$skill/SKILL.md" && ! grep -q '"opencode/autoinvoke": "false"' "$dir/$name/SKILL.md"; then
      printf '  FAIL  %s keeps model invocation off in Claude Code but not in OpenCode\n' "$name"; return 1
    fi
  done
  [ -f "$dir/deep-review/agents/review-backend.md" ] \
    || { printf '  FAIL  the bundle has no reviewer briefs for deep-review'"'"'s inline run\n'; return 1; }
  printf '  ok    the bundle has every skill, no placeholders, flags translated\n'
}

# install.sh end to end, against a throwaway Claude Code config and OpenCode dir.
installer() {
  local cfg="$WORK/claude" oc="$WORK/opencode" ids
  run_install() { CLAUDE_CONFIG_DIR="$cfg" OPENCODE_SKILLS_DIR="$oc" SKILLS_SOURCE="$ROOT" bash install.sh "$@" >/dev/null; }
  plugin_ids() { CLAUDE_CONFIG_DIR="$cfg" claude plugin list --json | grep -o '"[a-z0-9-]*@estebansa19"' | tr -d '"' | sort | tr '\n' ' '; }

  run_install || { printf '  FAIL  install\n'; return 1; }
  ids="$(plugin_ids)"
  [ "$ids" = "core@estebansa19 " ] || { printf '  FAIL  installed: %s\n' "$ids"; return 1; }
  run_install || { printf '  FAIL  re-run\n'; return 1; }
  ids="$(plugin_ids)"
  [ "$ids" = "core@estebansa19 " ] || { printf '  FAIL  a re-run left: %s\n' "$ids"; return 1; }

  # OpenCode: a folder we did not install is left byte-for-byte alone; ours are pruned.
  mkdir -p "$oc/commit" && printf 'mine\n' > "$oc/commit/SKILL.md"
  run_install --opencode || { printf '  FAIL  opencode install\n'; return 1; }
  [ "$(cat "$oc/commit/SKILL.md")" = "mine" ] || { printf '  FAIL  overwrote a skill folder it did not install\n'; return 1; }
  [ -f "$oc/work-triage-escalations/SKILL.md" ] || { printf '  FAIL  opencode bundle not installed\n'; return 1; }
  # A skill an earlier bundle installed under a name this one dropped, as a rename leaves.
  mkdir -p "$oc/triage-escalations" && printf 'triage-escalations\n' >> "$oc/.estebansa19-skills"
  run_install --opencode || { printf '  FAIL  opencode re-run\n'; return 1; }
  [ ! -e "$oc/triage-escalations" ] || { printf '  FAIL  did not prune a skill the bundle dropped\n'; return 1; }
  if [ ! -f "$oc/deep-review/SKILL.md" ] || [ "$(cat "$oc/commit/SKILL.md")" != "mine" ]; then
    printf '  FAIL  opencode re-run lost a skill or touched a foreign one\n'; return 1
  fi

  # Auto-update is only for the GitHub marketplace — a checkout loads in place.
  if grep -q '"autoUpdate"' "$cfg/settings.json"; then
    printf '  FAIL  a checkout install turned on auto-update\n'; return 1
  fi

  printf '  ok    installs and re-runs cleanly; OpenCode installs, prunes, never clobbers\n'
}

# The one-liner's path: install.sh piped into bash, with no checkout around it, and a gh that
# records any call. The marketplace is this checkout and the bundle a file:// URL, so it runs
# offline and tests this branch rather than whatever GitHub serves.
piped_installer() {
  local dir="$WORK/piped"
  mkdir -p "$dir/bin"
  printf '#!/bin/sh\ntouch "%s/gh-called"; exit 1\n' "$dir" > "$dir/bin/gh" && chmod +x "$dir/bin/gh"
  node .github/scripts/build-opencode.mjs "$dir/bundle" >/dev/null || return 1
  tar -czf "$dir/bundle.tar.gz" -C "$dir/bundle" . || return 1
  run_piped() {
    # shellcheck disable=SC2002  # a pipe on purpose: bash reads a script from a pipe, as from curl
    cat install.sh | PATH="$dir/bin:$PATH" CLAUDE_CONFIG_DIR="$dir/claude" OPENCODE_SKILLS_DIR="$dir/opencode" \
      SKILLS_REPO="$ROOT" SKILLS_BUNDLE_URL="file://$dir/bundle.tar.gz" bash -s -- "$@" >/dev/null
  }

  run_piped || { printf '  FAIL  piped install\n'; return 1; }
  CLAUDE_CONFIG_DIR="$dir/claude" claude plugin list --json | grep -q '"core@estebansa19"' \
    || { printf '  FAIL  piped install did not install core\n'; return 1; }
  grep -q '"autoUpdate": true' "$dir/claude/settings.json" || { printf '  FAIL  piped install left auto-update off\n'; return 1; }
  run_piped --opencode || { printf '  FAIL  piped --opencode\n'; return 1; }
  [ -f "$dir/opencode/deep-review/SKILL.md" ] || { printf '  FAIL  piped --opencode installed nothing\n'; return 1; }
  [ ! -e "$dir/gh-called" ] || { printf '  FAIL  the piped install called gh\n'; return 1; }
  printf '  ok    installs core with auto-update on, downloads the OpenCode bundle, never calls gh\n'
}

# install.sh's settings edit, on its own: it sets autoUpdate on an existing entry and
# leaves a file without one untouched. piped_installer covers the common case end to end.
auto_update() {
  local dir="$WORK/auto-update" before
  mkdir -p "$dir"
  sed -n '/^enable_auto_update() {/,/^}/p' install.sh > "$dir/fn.sh"
  run_fn() { MARKETPLACE=estebansa19 CLAUDE_CONFIG_DIR="$dir" bash -c '. "$1" && enable_auto_update' _ "$dir/fn.sh"; }
  printf '{\n  "theme": "dark",\n  "extraKnownMarketplaces": {\n    "estebansa19": {\n      "source": { "source": "github", "repo": "estebansa19/skills" }\n    }\n  }\n}\n' > "$dir/settings.json"
  run_fn || { printf '  FAIL  enable_auto_update failed on an existing entry\n'; return 1; }
  if ! grep -q '"autoUpdate": true' "$dir/settings.json" || ! grep -q '"theme": "dark"' "$dir/settings.json"; then
    printf '  FAIL  autoUpdate not set, or another setting lost\n'; return 1
  fi
  printf '{"theme": "dark"}\n' > "$dir/settings.json"
  before="$(cat "$dir/settings.json")"
  if run_fn; then
    printf '  FAIL  enable_auto_update invented a marketplace entry\n'; return 1
  fi
  [ "$(cat "$dir/settings.json")" = "$before" ] || { printf '  FAIL  a file without the entry was changed\n'; return 1; }
  printf '  ok    sets autoUpdate on the marketplace entry, keeps other settings, invents nothing\n'
}

if command -v claude >/dev/null 2>&1; then
  # The version goes in the log: what Claude Code accepts in a manifest changes release to
  # release, so a local pass and a CI failure usually mean two different versions.
  step "Claude Code $(claude --version 2>/dev/null | awk '{print $1}') validates the marketplace and plugin" plugin_validate
fi
step "OpenCode bundle" opencode_bundle
step "install.sh turns on auto-update in the settings file" auto_update
if command -v claude >/dev/null 2>&1; then
  step "install.sh end to end (throwaway Claude config and OpenCode dir)" installer
  step "install.sh piped into bash, as the one-liner runs it" piped_installer
else
  printf '\n\033[1m== Claude Code checks\033[0m\n  SKIPPED — claude not on PATH (npm install -g @anthropic-ai/claude-code)\n'
fi

if [ "${#failed[@]}" -gt 0 ]; then
  printf '\n\033[31mFAILED\033[0m — %s\n' "${failed[*]}"
  exit 1
fi
printf '\n\033[32mAll checks passed.\033[0m\n'
