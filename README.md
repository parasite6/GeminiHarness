# GeminiHarness

A lightweight tray app for Fedora that keeps your Gemini session ready without a browser tab. Open a resizable window with your logged-in [gemini.google.com](https://gemini.google.com) — chat, Canvas, sources, memory, all intact. No API key, no billing. The session persists across restarts.

## Requirements

- Fedora (developed against Fedora 44 / GNOME)
- Node.js (for development)
- GNOME AppIndicator support: `sudo dnf install gnome-shell-extension-appindicator`, then enable the extension

## Development

```bash
npm install
npm start
npm test
```

`npm start` launches under XWayland (`--ozone-platform=x11`). Packaging targets an RPM via electron-builder (`npm run dist`).

## Behavior

- **Session** — Chromium partition `persist:gemini` under the app userData directory. Sign-in is Google’s normal flow inside the window (no API keys, no credential storage of our own).
- **In-app hosts** — Top-level navigation stays in the window for `gemini.google.com`, `accounts.google.com`, and `accounts.youtube.com` (post-2FA SID sync). Other links (including Gemini Sources and `www.google.com`) open in your default browser.
- **Window** — Size, position, maximize, and zoom are saved to `window-state.json`. The GTK title bar is hidden in favor of a dark overlay so window controls match Gemini’s theme. Closing the window hides to the tray; **Quit Gemini** in the tray menu fully exits. Only one instance runs; a second launch focuses the existing window unless that launch was `--hidden` (autostart / tray-only).
- **Offline at launch** — If Gemini isn’t reachable on first open, a dark in-app offline page is shown (with auto-retry and **Try again**) instead of Chromium’s stock error page. Mid-session disconnects are unchanged.
- **Tray** — StatusNotifierItem (AppIndicator). Menu: **Open Window**, **Start on Login**, **Quit Gemini**.
- **Start on Login** — Writes or removes `~/.config/autostart/GeminiHarness.desktop`. Enabled login launches are tray-only (`--hidden`); the window stays closed until you open it from the tray. The checkbox follows the file on disk, including GNOME Startup Applications setting `Hidden=true` without deleting the entry.

## GNOME tray note

Without `gnome-shell-extension-appindicator`, the tray icon may not appear. Electron is pinned to **43.2.0** because 43.3–44 break AppIndicator on GNOME via a Chromium StatusNotifierItem multiplexer ([electron#52674](https://github.com/electron/electron/issues/52674)). We will move back to current Electron once that is fixed upstream.

## XWayland note

The app always uses XWayland so window position can be restored. Native Wayland’s xdg-shell does not allow clients to set their own position; size, maximize, and zoom would still work either way.
