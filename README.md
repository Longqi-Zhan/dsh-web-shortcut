# dsh-web-shortcut

A DSH profile plugin that installs a desktop shortcut and a standalone window
for the DeepSeek Harness Web UI. It is Linux-only (GNOME/GTK + WebKitGTK).

English | [简体中文](README.zh-CN.md)

## What it installs

| Path | Purpose |
|---|---|
| `~/.local/bin/dsh-web` | Launcher: reuses a running server or starts `dsh web`, then opens the app window |
| `~/.local/bin/dsh-web-view` | Standalone WebKitGTK window (`app_id=dsh-web`, no browser chrome) |
| `~/.local/share/applications/dsh-web.desktop` | Application-menu entry + “Stop DSH Web” action |
| `~/桌面/dsh-web.desktop` | Desktop icon (locale-aware: `~/Desktop` is used when present) |
| `~/.local/share/icons/hicolor/scalable/apps/dsh-web.svg` | Application icon |

The desktop entry uses `dsh-web.desktop`, `StartupWMClass=dsh-web`, and the
window sets the same Wayland `app_id`, so GNOME groups it under its own icon
rather than Firefox’s.

The plugin is **install-only**: every Web boot reconciles the files with the
plugin version, but disabling or removing the plugin does not delete them. This
is deliberate — Cordis also disposes plugins on normal process shutdown, so a
dispose hook would remove the shortcut every time DSH stops. To uninstall, remove
the plugin and delete the paths above.

## Authentication

DSH Web authenticates browsers with a per-process launch token and a signed
cookie. The standalone viewer:

1. loads the token URL when this shortcut started the server;
2. otherwise reads only the matching `dsh-auth-*` cookie for the loopback
   authority from the local Firefox profile, when one exists;
3. otherwise mints that cookie from the browser-session signing secret in the
   owner-only `~/.dsh/.credentials.yaml` — the secret the server itself signs
   cookies with, shared by every session in the same Harness home;
4. falls back to the default browser if neither is available.

No cookie value or signing secret is logged or sent anywhere except to the
local DSH server. If WebKitGTK/PyGObject is missing, the launcher falls back to
the default browser.

## Install

From a DSH checkout/profile with `pnpm` available:

```bash
dsh plugin --profile web add /absolute/path/to/dsh-web-shortcut
```

Then enable the **DSH Web Shortcut** bundle in the Web **Settings → Plugins**
page (or append `"dsh-web-shortcut"` to `dsh.profile.bundles` in the profile’s
`package.json`). The integration is installed on the next `dsh web` boot.

For a local development link, a profile can also use:

```json
{
  "dependencies": {
    "dsh-web-shortcut": "link:../../../work/dsh-web-shortcut"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-web-shortcut"]
    }
  }
}
```

with `node_modules/dsh-web-shortcut` linked to this directory.

## Development

The local project workspace is `~/work/dsh-web-shortcut`; the `web` profile
links to it as `link:../../../work/dsh-web-shortcut`.

```bash
npm run pack    # build dist/dsh-web-shortcut-<version>.tgz
```

After editing `lib/index.js` or `assets/*`, restart `dsh web` so the plugin
reconciles the installed shortcut files.

## Usage

```bash
dsh-web            # open the app window (start the server if needed)
dsh-web --status   # show the running state
dsh-web --stop     # stop the server this launcher started
DSH_WEB_BROWSER=firefox dsh-web   # force the old Firefox window behavior
DSH_WEB_GPU=1 dsh-web             # keep WebKit's GPU compositing
```

## Requirements

- Linux with a desktop session (Wayland or X11)
- GTK 3 and WebKit2GTK 4.1 via PyGObject (`python3-gi`, `gir1.2-webkit2-4.1`)
- Firefox is optional; it is only used for the cookie handoff/fallback

## Rendering

WebKitGTK composites pages through EGL/DMABUF. Virtual machines, remote desktops
and software-only Mesa stacks often expose no DRM render node
(`/dev/dri/renderD*`), and that path then paints nothing: the window opens, the
page loads (even the title updates), and the client area stays blank.

The viewer checks for `/dev/dri/renderD*` at startup and, when it is missing,
sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` to fall back to shared-memory rendering;
such a session has nothing to gain from GPU compositing anyway. To force the
accelerated path, or to decide yourself:

```bash
DSH_WEB_GPU=1 dsh-web                     # force GPU compositing
WEBKIT_DISABLE_DMABUF_RENDERER=0 dsh-web  # explicitly keep DMABUF
```

## License

[MIT](LICENSE)
