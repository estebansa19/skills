# Installing and updating

## A new machine

```bash
curl -fsSL https://raw.githubusercontent.com/estebansa19/skills/HEAD/install.sh | bash
```

That is the whole setup for Claude Code. The repo is public, so there is no login: it needs
`curl` and Claude Code itself, and Claude Code clones the marketplace and fetches every later
update without credentials. `HEAD` is the default branch, so the URL survives a rename.
`install.sh` asks nothing:

1. Registers this repo as the `estebansa19` plugin marketplace
   (`claude plugin marketplace add estebansa19/skills`).
2. Turns on its auto-update, by setting `autoUpdate: true` on that marketplace's entry in
   `~/.claude/settings.json` — Claude Code reads that ahead of the `/plugin` toggle, and
   auto-update is off by default for any marketplace that is not Anthropic's. It needs
   `jq`, `python3` or `node` to edit the file; with none of them it says to use
   `/plugin` → **Marketplaces** → `estebansa19` → **Enable auto-update** instead.
3. Installs the `core` plugin, which holds every skill: the everyday ones and the `work-*`
   ones. There is nothing to configure: a skill's settings are written in the skill, and a
   value that differs at work lives in its `work-` version (`commit` and `work-commit`).

The command line does not print the auto-update state; `/plugin` → **Marketplaces** shows
it (the item reads **Disable auto-update** when it is on).

### Without the script

Inside a Claude Code session (v2.1.275 or later):

```text
/plugin install core --marketplace estebansa19/skills
```

From a shell it is `claude plugin install core --marketplace estebansa19/skills` (v2.1.292 or
later). Either one adds the marketplace and installs `core`, but leaves auto-update off, as it
is for every marketplace that is not Anthropic's. Turn it on once under `/plugin` →
**Marketplaces** → `estebansa19` → **Enable auto-update**. No command-line flag does it, which
is why the installer edits the settings file.

### A machine that had the `work` plugin

Re-run the installer once. Auto-update brings in the new skills, but only the installer
removes the old `work` plugin, which the marketplace no longer ships; until then its skills
are listed twice (`/work:implement` beside `/core:work-implement`). Option values saved under
the old presets stay in the settings file and are ignored.

## OpenCode

```bash
curl -fsSL https://raw.githubusercontent.com/estebansa19/skills/HEAD/install.sh | bash -s -- --opencode
```

OpenCode reads plain skill folders and does not load Claude Code plugins, so it gets a
prebuilt bundle instead: `.github/workflows/release.yml` runs
`.github/scripts/build-opencode.mjs` on each push to `master` and attaches
`opencode-skills.tar.gz` to the rolling `opencode` release. `--opencode` downloads that one
file from the public release URL and unpacks it into `~/.config/opencode/skills/` — skill
folders only, no checkout, no git history. It needs `curl` and `tar`, nothing else.

- **Updating** is re-running the same command.
- **It never clobbers.** A folder there that it did not install is skipped and reported;
  `.estebansa19-skills` in that directory lists what it installed, which is also how it
  prunes a skill the bundle dropped or renamed.
- **What changes in OpenCode:** skills are `/commit`, not `/core:commit` (no plugin prefix).
  OpenCode has subagents, but the bundle installs none of this repo's agents, so
  `deep-review` and `work-triage-escalations` take their fallback: a general subagent where
  one is offered, otherwise inline, reading the briefs copied into the skill's `agents/`.

## This machine: a live checkout

Run the installer from the checkout instead of through the pipe:

```bash
./install.sh
```

From a checkout, `install.sh` registers the **directory** as the marketplace, and Claude
Code reads the plugin from it in place: an edit to a skill is live at the next session, or
right away with `/reload-plugins`, with no update step. `./install.sh --opencode` builds the
bundle from the checkout too (it needs `node`), instead of downloading the release.

A marketplace keeps the source it was first added from. To move a machine between the
GitHub source and a checkout, remove it first: `claude plugin marketplace remove estebansa19`.

## Changing a setting

A skill's settings are the `- key: value` lines of its `## Configuration` section: the
personal value in `<name>/SKILL.md`, the work value in `work-<name>/SKILL.md`. Edit the line
and push; every machine gets it with the next update. There are no plugin options, so a
plugin installed some other way, such as from the `/plugin` screen, behaves exactly the same.

## Leaving the old symlink installer

The previous installer (`bin/skills`) symlinked skills into `~/.claude/skills/`,
`~/.agents/skills/` and `~/.config/opencode/skills/`, and agents into `~/.claude/agents/`.
On a machine that ran it, remove those links before installing the plugins, or Claude Code
lists every skill twice (`/commit` and `/core:commit`):

```bash
old=~/.skills                   # wherever that checkout lives
for d in ~/.claude/skills ~/.agents/skills ~/.config/opencode/skills ~/.claude/agents; do
  find "$d" -maxdepth 1 -type l -lname "$old/*" -print 2>/dev/null
done                            # review the list, then delete those links
```

## When something is wrong

| Symptom | Cause and fix |
|---|---|
| `could not add the marketplace` | Claude Code's reason is printed above it. `its source doesn't match` means it was added from a checkout: `claude plugin marketplace remove estebansa19`, then re-run |
| `could not download …opencode-skills.tar.gz` | no network to github.com, or the `release` workflow has not published the bundle: check its last run |
| A skill is listed twice, `/work:…` beside `/core:work-…` | the old `work` plugin is still installed — re-run the installer |
| Every skill appears twice | old symlinks are still in `~/.claude/skills` — see above |
| Updates never arrive | auto-update is off for the marketplace — re-run the installer, or `/plugin` → Marketplaces → Enable auto-update |
| A new skill or agent is not listed | restart the session, or `/reload-plugins` |
| `--opencode` says `skipped <name>` | a folder of that name exists that this script did not install — move it aside, re-run |
| Errors loading a plugin | `/plugin` → **Errors** tab, or `claude plugin details core@estebansa19` |
