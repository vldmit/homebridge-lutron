# AGENTS.md — homebridge-lutron

Coding-agent instructions for developing this Homebridge plugin against the live install on this machine.

## What this is

- **Package:** `@mkellsy/homebridge-lutron` (platform name: `Lutron`)
- **Source of truth:** TypeScript under `src/`; never hand-edit `lib/` or built `ui/server.js`
- **Build:** `build` script runs esbuild → `lib/index.js`, `lib/cli.js`, `ui/server.js` (+ sourcemaps unless `release`)
- **Live install:** global npm package is **linked** to this clone:

  ```text
  /opt/homebrew/lib/node_modules/@mkellsy/homebridge-lutron
    → /Users/vvd/Developer/homebridge-lutron
  ```

  Verify: `ls -la /opt/homebrew/lib/node_modules/@mkellsy/homebridge-lutron` should be a symlink into this repo.

## Runtime paths (do not invent alternatives)

| Path | Purpose |
|------|---------|
| `~/.homebridge/config.json` | Homebridge config; Lutron platform runs as a **child bridge** (`_bridge`) |
| `~/.homebridge/homebridge.log` | Logs (also available in Homebridge UI) |
| `~/.leap/` | Plugin pairing, discovery, processor cache — **reuse as-is**; do not wipe for normal bugfixes |

Node/npm are Homebrew installs (`/opt/homebrew/bin`). Homebridge is supervised by `hb-service` (UI on port 8581).

## Dev loop (default for code changes)

After editing `src/**/*.ts` (or `config.schema.json` / `ui/public` if relevant):

1. **Fast rebuild** (prefer this during iteration):

   ```bash
   node ./build
   ```

   Do **not** use `npm run build` on every edit — that runs format + lint + full tests and is slow.

2. **Reload only the Lutron child bridge** (parent Homebridge + UI stay up):

   ```bash
   kill $(ps -ax -o pid=,command= | awk '/homebridge: @mkellsy\/homebridge-lutron/ && !/awk/ {print $1; exit}')
   ```

   The parent respawns the child and reloads `lib/index.js` from this tree. Prefer this over full Homebridge restart.

3. **Check logs:**

   ```bash
   tail -n 80 ~/.homebridge/homebridge.log
   ```

4. Iterate: edit → `node ./build` → kill child → logs.

### Optional watch loop

```bash
npx nodemon --watch src --ext ts --exec \
  "node ./build && kill \$(ps -ax -o pid=,command= | awk '/homebridge: @mkellsy\\/homebridge-lutron/ && !/awk/ {print \$1; exit}')"
```

### When to full-restart Homebridge

- Config changes in `~/.homebridge/config.json`
- UI plugin-server changes that the child restart does not pick up
- Stuck child / supervisor issues

Options: Homebridge UI “Restart”, `sudo hb-service restart`, or SIGTERM the main `homebridge` process (hb-service respawns it). Avoid stopping `hb-service` unless necessary.

## leap-client dependency

Default (published fork):

```text
package.json → "@vldmit/leap-client": "^1.7.9"
```

For local LEAP debugging against a sibling clone:

```bash
npm install ../leap-client
# or set "file:../leap-client" temporarily in package.json
```

- Plugin `build` aliases `@vldmit/leap-client` to `node_modules/@vldmit/leap-client/src/index.ts` when that path exists (linked/file clone), so **one** `node ./build` here rebundles leap-client source.
- Package must include an `authority` file (shipped on npm): used by plugin build for pairing CA.
- leap-client uses **js-logger**; Platform configures it at DEBUG under Homebridge so `[LEAP]` lines show in `~/.homebridge/homebridge.log`.
- After changing leap-client source: reinstall/link if needed → `node ./build` here → kill Lutron child bridge → logs.

## First-time / broken link recovery

```bash
# leap-client (if needed)
cd ~/Developer/leap-client && npm install
# ensure authority exists (from published package if clone lacks it)
# cp node_modules/@vldmit/leap-client/authority ~/Developer/leap-client/authority  # from a prior install

cd ~/Developer/homebridge-lutron
npm install
node ./build
npm link
# then restart Homebridge (full) once
```

If the global package is a real directory again (not a symlink), re-run `npm link` from this repo. **Never** install/update `@mkellsy/homebridge-lutron` via Homebridge UI or `npm install -g` while developing — that replaces the link with the published package.

## Do not use for this live setup

| Action | Why |
|--------|-----|
| `npm run watch` | Starts a **separate** Homebridge with local `./storage`; ignores real `~/.homebridge` / `~/.leap` |
| Wipe `~/.leap/` | Drops pairing/certs; only if user explicitly wants re-pair |
| Edit `lib/**` or built `ui/server.js` | Overwritten by `node ./build` |
| Change package name / platform id casually | Breaks config, child bridge identity, and HomeKit pairing |

## Quality gates (before handoff / commit)

Prefer after meaningful changes, not every keystroke:

```bash
npm test          # mocha + nyc
npm run lint      # eslint on src
node ./build      # ensure build still succeeds
```

Full release-style: `npm run build` (format + lint + test + esbuild).

## Architecture map (for agents)

| Area | Files |
|------|--------|
| Entrypoint / platform registration | `src/index.ts`, `src/Platform.ts` (`plugin` = `@mkellsy/homebridge-lutron`, `platform` = `Lutron`) |
| Config defaults | `src/Config.ts`; schema for UI: `config.schema.json` |
| Device adapters | `src/Dimmer.ts`, `Switch.ts`, `Fan.ts`, `Shade.ts`, `Keypad.ts`, `Occupancy.ts`, `Contact.ts`, `Strip.ts`, `Timeclock.ts`, … |
| Accessory wiring | `src/Accessories.ts`, `src/Device.ts` |
| CLI (`lutron`) | `src/CLI.ts` → `lib/cli.js` via `bin/lutron` |
| Custom UI server | `src/Server.ts` → `ui/server.js`; static UI under `ui/public/` |
| LEAP / HAP libs | Bundled at build from `@vldmit/leap-client`, `@mkellsy/hap-device` (devDependencies); runtime externals: `homebridge`, `bson` |

Tests live in `test/` and mirror device modules. Prefer targeted tests when changing one accessory type.

## Safety / ops

- Live HomeKit bridge — avoid destructive config or pairing resets unless the user asks.
- Prefer child-bridge restart over full service restarts.
- Do not commit secrets; pairing material lives under `~/.leap/` (outside the repo).
- Generated/build artifacts (`lib/`, `authority`, `ui/server.js*`) are gitignored — rebuild instead of committing them.

## Verification checklist after a fix

1. `node ./build` exits successfully.
2. Child bridge restarts and log shows: `Loaded plugin: @mkellsy/homebridge-lutron` and `Child bridge started successfully`.
3. No new error spam in `~/.homebridge/homebridge.log`.
4. Relevant accessories still present / behave as expected (user or logs).
)
