/**
 * DSH Web desktop integration.
 *
 * Installs the standalone-window launcher, its WebKit viewer, the app icon and
 * the desktop/menu entries. The files are ordinary user-level files: they keep
 * working when DSH is not running. Installation is idempotent, so every Web
 * boot reconciles the installed copies with this package version.
 *
 * Deliberately install-only: Cordis disposes plugins during a normal process
 * shutdown as well as when the user disables them, so removing the shortcut in
 * a dispose hook would delete it every time the server stops. Removal is a
 * user action (see README.md).
 *
 * @module dsh-web-shortcut
 */

import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Stable Cordis plugin name. */
export const name = "web-shortcut";

const here = dirname(fileURLToPath(import.meta.url));
const asset = (file) => join(here, "..", "assets", file);

const APP_ID = "dsh-web";
const DESKTOP_FILE = "dsh-web.desktop";
const ICON_FILE = "dsh-web.svg";

/**
 * Escape one executable path for a Desktop Entry Exec value.
 * @param path - absolute path to the launcher.
 * @returns the path, quoted when it contains characters that need it.
 */
function quoteExec(path) {
	const escaped = path
		.replace(/\\/gu, "\\\\")
		.replace(/"/gu, '\\"')
		.replace(/%/gu, "%%");
	return /^[A-Za-z0-9_@+=:,./-]+$/u.test(path) ? path : `"${escaped}"`;
}

/**
 * Render the desktop entry for the launcher at `launcher`.
 * @param launcher - absolute path to the installed dsh-web launcher.
 * @returns the complete Desktop Entry text.
 */
function desktopEntry(launcher) {
	const exec = quoteExec(launcher);
	return `[Desktop Entry]
Type=Application
Version=1.0
Name=DSH Web
Name[zh_CN]=DSH Web
GenericName=DeepSeek Harness
GenericName[zh_CN]=DeepSeek Harness 网页界面
Comment=Open the DeepSeek Harness Web GUI in its own application window
Comment[zh_CN]=在独立应用窗口中打开 DeepSeek Harness 网页界面
Exec=${exec}
Icon=${APP_ID}
Terminal=false
Categories=Development;IDE;
Keywords=deepseek;harness;dsh;ai;agent;web;coding;
StartupNotify=true
StartupWMClass=${APP_ID}
Actions=stop;

[Desktop Action stop]
Name=Stop DSH Web
Name[zh_CN]=停止 DSH Web
Exec=${exec} --stop
`;
}

/**
 * Find the user's desktop directory without assuming a locale.
 * @param home - the user's home directory.
 * @returns the directory when it exists, otherwise `undefined`.
 */
function desktopDirectory(home) {
	for (const candidate of [join(home, "桌面"), join(home, "Desktop")]) {
		if (existsSync(candidate)) return candidate;
	}
	try {
		const output = execFileSync("xdg-user-dir", ["DESKTOP"], {
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
			env: process.env,
		}).trim();
		if (output.startsWith(home) && existsSync(output)) return output;
	} catch {
		/* xdg-user-dir is optional */
	}
	return undefined;
}

/**
 * Write a file only when its content changed, then enforce its mode.
 * @param target - absolute destination path.
 * @param content - exact bytes to install.
 * @param mode - POSIX mode for the installed file.
 * @returns whether the bytes changed.
 */
function writeContent(target, content, mode) {
	mkdirSync(dirname(target), { recursive: true });
	let changed = true;
	try {
		changed = !readFileSync(target).equals(content);
	} catch {
		/* a missing file is a change */
	}
	if (changed) writeFileSync(target, content);
	chmodSync(target, mode);
	return changed;
}

/**
 * Install or refresh the desktop integration.
 * @returns the paths that were created or updated.
 */
function install() {
	const home = process.env.HOME || homedir();
	const binDir = process.env.XDG_BIN_HOME || join(home, ".local", "bin");
	const dataHome = process.env.XDG_DATA_HOME || join(home, ".local", "share");
	const appsDir = join(dataHome, "applications");
	const iconDir = join(dataHome, "icons", "hicolor", "scalable", "apps");

	const launcher = join(binDir, "dsh-web");
	const viewer = join(binDir, "dsh-web-view");
	const icon = join(iconDir, ICON_FILE);
	const menuEntry = join(appsDir, DESKTOP_FILE);

	const changed = [];
	const installAsset = (source, target, mode) => {
		if (writeContent(target, readFileSync(source), mode)) changed.push(target);
	};

	installAsset(asset("dsh-web"), launcher, 0o755);
	installAsset(asset("dsh-web-view"), viewer, 0o755);
	installAsset(asset(ICON_FILE), icon, 0o644);

	const entry = Buffer.from(desktopEntry(launcher), "utf8");
	if (writeContent(menuEntry, entry, 0o755)) changed.push(menuEntry);

	const desktopDir = desktopDirectory(home);
	if (desktopDir !== undefined) {
		const desktopEntryPath = join(desktopDir, DESKTOP_FILE);
		if (writeContent(desktopEntryPath, entry, 0o755)) changed.push(desktopEntryPath);
		try {
			execFileSync("gio", ["set", desktopEntryPath, "metadata::trusted", "true"], { stdio: "ignore" });
		} catch {
			/* metadata is a GNOME nicety; the entry remains launchable */
		}
	}

	try {
		execFileSync("update-desktop-database", [appsDir], { stdio: "ignore" });
	} catch {
		/* optional helper */
	}
	try {
		execFileSync("gtk-update-icon-cache", ["-f", "-t", join(dataHome, "icons", "hicolor")], { stdio: "ignore" });
	} catch {
		/* optional helper */
	}

	return changed;
}

/**
 * Mount the installer: reconcile the desktop integration on every Web boot.
 * @param ctx - host context used only for logging.
 */
export function apply(ctx) {
	if (process.platform !== "linux") {
		ctx.logger?.info?.("web-shortcut: desktop shortcuts are Linux-only; nothing to install");
		return;
	}
	try {
		const changed = install();
		if (changed.length > 0) {
			ctx.logger?.info?.(`web-shortcut: installed ${changed.length} file(s): ${changed.join(", ")}`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		ctx.logger?.warn?.(`web-shortcut: could not install the desktop shortcut: ${message}`);
	}
}
