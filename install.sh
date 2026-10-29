#!/usr/bin/env bash
# Install the skills on this machine. No questions.
#
#   curl -fsSL https://raw.githubusercontent.com/estebansa19/skills/HEAD/install.sh | bash
#   … | bash -s -- --opencode        # OpenCode: the prebuilt skills-only bundle
#
# Claude Code (the default): registers this repo as the `estebansa19` plugin marketplace,
# turns on its auto-update and installs the `core` plugin, which holds every skill. Claude
# Code keeps it current from then on; re-running this is only needed on a machine that still
# has a plugin this marketplace no longer ships, which it removes.
#
# OpenCode (--opencode): downloads opencode-skills.tar.gz from the `opencode` release, which
# CI rebuilds on every push to master, and unpacks it into ~/.config/opencode/skills/. Only
# the skill folders land — no checkout. Re-run to update.
#
# The repo is public: nothing here logs in or needs gh.
#
# Run from a checkout (./install.sh) and both read that checkout instead of GitHub: Claude
# Code loads the plugin in place, so edits are live at the next session or /reload-plugins.
#
# Idempotent; it only removes plugins from its own marketplace and skill folders it installed
# itself.
set -euo pipefail

REPO="${SKILLS_REPO:-estebansa19/skills}"
# SKILLS_BUNDLE_URL lets check.sh serve a bundle it just built (a file:// URL).
BUNDLE_URL="${SKILLS_BUNDLE_URL:-https://github.com/$REPO/releases/download/opencode/opencode-skills.tar.gz}"
MARKETPLACE="estebansa19"
PLUGIN="core"
OPENCODE_DIR="${OPENCODE_SKILLS_DIR:-$HOME/.config/opencode/skills}"
MANIFEST=".estebansa19-skills"

die() { printf 'install: %s\n' "$1" >&2; exit 1; }

OPENCODE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --opencode) OPENCODE=1; shift;;
    -h|--help) printf 'usage: install.sh [--opencode]\n'; exit 0;;
    *) die "unknown option '$1' (try: --opencode)";;
  esac
done

# A checkout around this script is the source. Piped through bash there is no script file,
# so GitHub is. SKILLS_SOURCE points at a checkout explicitly (check.sh uses it).
SOURCE="${SKILLS_SOURCE:-}"
if [ -z "$SOURCE" ] && [ -f "${BASH_SOURCE[0]:-}" ]; then
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$here/.claude-plugin/marketplace.json" ]; then SOURCE="$here"; fi
fi

# Installed plugins from this marketplace, one name@marketplace id per line.
installed_ids() {
  claude plugin list --json 2>/dev/null | grep -o "\"[a-z0-9-]*@$MARKETPLACE\"" | tr -d '"' || true
}

# enable_auto_update — set `autoUpdate: true` on this marketplace's entry in the user
# settings, which Claude Code honors ahead of the /plugin toggle (it is off by default for
# every marketplace that is not Anthropic's). Edits only that one key, and only when
# `marketplace add` already wrote the entry. Needs jq, python3 or node; returns 1 without.
enable_auto_update() {
  local f="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/settings.json" tmp
  [ -f "$f" ] || return 1
  tmp="$(mktemp)"
  if command -v jq >/dev/null 2>&1; then
    jq --arg m "$MARKETPLACE" \
      'if .extraKnownMarketplaces[$m].source then .extraKnownMarketplaces[$m].autoUpdate = true else error("no entry") end' \
      "$f" > "$tmp" 2>/dev/null
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c '
import json, sys
d = json.load(open(sys.argv[1]))
e = d.get("extraKnownMarketplaces", {}).get(sys.argv[2])
if not isinstance(e, dict) or "source" not in e: sys.exit(1)
e["autoUpdate"] = True
print(json.dumps(d, indent=2, ensure_ascii=False))' "$f" "$MARKETPLACE" > "$tmp" 2>/dev/null
  elif command -v node >/dev/null 2>&1; then
    node -e '
const fs = require("fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const e = (d.extraKnownMarketplaces || {})[process.argv[2]];
if (!e || !e.source) process.exit(1);
e.autoUpdate = true;
console.log(JSON.stringify(d, null, 2));' "$f" "$MARKETPLACE" > "$tmp" 2>/dev/null
  else
    false
  fi || { rm -f "$tmp"; return 1; }
  # Write through the existing file, so its permissions survive.
  cat "$tmp" > "$f" && rm -f "$tmp"
}

install_claude() {
  command -v claude >/dev/null 2>&1 \
    || die "Claude Code is not on PATH. Install it first, or pass --opencode for OpenCode only."
  printf 'Claude Code\n'
  claude plugin marketplace add "${SOURCE:-$REPO}" >/dev/null \
    || die "could not add the marketplace ${SOURCE:-$REPO} (Claude Code's reason is above)"
  # A checkout loads in place, so only the GitHub marketplace has updates to fetch.
  local manual_update=0
  if [ -z "$SOURCE" ]; then
    enable_auto_update || manual_update=1
  fi

  local id
  claude plugin install "$PLUGIN@$MARKETPLACE" >/dev/null || die "could not install $PLUGIN@$MARKETPLACE"
  printf '  installed %s\n' "$PLUGIN"

  # Converge: a plugin from this marketplace other than $PLUGIN is one it no longer ships.
  for id in $(installed_ids); do
    [ "${id%@*}" = "$PLUGIN" ] && continue
    claude plugin uninstall "$id" >/dev/null && printf '  removed %s (no longer in the marketplace)\n' "${id%@*}"
  done

  printf 'Restart open Claude Code sessions to load the changes.\n'
  if [ "$manual_update" -eq 1 ]; then
    printf 'Could not turn on auto-update (no jq, python3 or node). Once: /plugin → Marketplaces → %s → Enable auto-update.\n' "$MARKETPLACE"
  fi
}

install_opencode() {
  local tmp bundle name
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064  # expand now: tmp is local and gone by the time EXIT fires
  trap "rm -rf '$tmp'" EXIT
  bundle="$tmp/bundle"
  printf 'OpenCode\n'
  if [ -n "$SOURCE" ]; then
    command -v node >/dev/null 2>&1 || die "building the bundle from a checkout needs node"
    node "$SOURCE/.github/scripts/build-opencode.mjs" "$bundle" >/dev/null
  else
    mkdir -p "$bundle"
    curl -fsSL "$BUNDLE_URL" | tar -xzf - -C "$bundle" \
      || die "could not download $BUNDLE_URL"
  fi
  [ -f "$bundle/$MANIFEST" ] || die "the bundle has no $MANIFEST — refusing to install it"

  mkdir -p "$OPENCODE_DIR"
  local ours="$OPENCODE_DIR/$MANIFEST" kept=""
  touch "$ours"
  # Prune skills this script installed before that the bundle no longer has (a renamed one).
  while IFS= read -r name; do
    case "$name" in ''|*[!a-z0-9-]*) continue;; esac
    if [ ! -d "$bundle/$name" ]; then
      rm -rf "${OPENCODE_DIR:?}/$name"
      printf '  removed %s\n' "$name"
    fi
  done < "$ours"
  while IFS= read -r name; do
    case "$name" in ''|*[!a-z0-9-]*) die "bad skill name '$name' in the bundle";; esac
    if [ -e "$OPENCODE_DIR/$name" ] && ! grep -qx "$name" "$ours"; then
      printf '  skipped %s — %s/%s exists and was not installed by this script\n' "$name" "$OPENCODE_DIR" "$name"
      continue
    fi
    rm -rf "${OPENCODE_DIR:?}/$name"
    cp -R "$bundle/$name" "$OPENCODE_DIR/$name"
    kept="$kept$name
"
    printf '  installed %s\n' "$name"
  done < "$bundle/$MANIFEST"
  printf '%s' "$kept" > "$ours"
  printf 'Restart OpenCode to load the changes. Re-run with --opencode to update.\n'
}

if [ "$OPENCODE" -eq 1 ]; then install_opencode; else install_claude; fi
