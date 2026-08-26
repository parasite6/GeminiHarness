<img width="1873" height="949" alt="gemini-logo-placeholder" src="https://github.com/user-attachments/assets/2b30e1fd-d4a4-4763-864f-ba1ded9dbd95" />

# GeminiHarness

GeminiHarness is an app for Fedora that lets you use Google Gemini: [gemini.google.com](https://gemini.google.com) from your desktop without a browser - think Gemini Desktop Unofficial. Click the tray icon or press Super+G to open a resizable window with your logged-in gemini.google.com. All of the features of that site per your account, all intact. No manual API key configuration.

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

`npm start` launches under XWayland (`--ozone-platform=x11`).

To build a local test RPM on Fedora:

```bash
sudo dnf install rpm-build
npm run dist
```

The package is written to `dist/geminiharness-*.x86_64.rpm`. Install it with
`sudo dnf install ./dist/geminiharness-*.x86_64.rpm` (or remove/replace an
older test install the same way).

## Behavior

- **Session** — Chromium partition `persist:gemini` under the app userData directory. Sign-in is Google’s normal flow inside the window (no API keys, no credential storage of our own).
- **In-app hosts** — Top-level navigation stays in the window for `gemini.google.com`, `accounts.google.com`, and `accounts.youtube.com` (post-2FA SID sync). Other links (including Gemini Sources and `www.google.com`) open in your default browser.
- **Window** — Size, position, maximize, zoom, always-on-top, and size-lock are saved to `window-state.json`. Size-lock freezes the current dimensions; the window can still be moved. The GTK title bar is hidden in favor of a dark overlay so window controls match Gemini’s theme; a reload control in that overlay reloads the current page. Closing the window hides to the tray; **Quit Gemini** in the tray menu fully exits. Only one instance runs; a second launch toggles the existing window (show/hide) unless that launch was `--hidden` (autostart / tray-only).
- **Offline at launch** — If Gemini isn’t reachable on first open, a dark in-app offline page is shown (with auto-retry and **Try again**) instead of Chromium’s stock error page. Mid-session disconnects are unchanged.
- **Tray** — StatusNotifierItem (AppIndicator). Menu: **Open Window**, **Start on Login**, **Keyboard shortcut (Super+G)**, **Always on Top**, **Lock Window Size**, **Quit Gemini**.
- **App launcher** — The RPM installs `geminiharness.desktop` under `/usr/share/applications/` and a scalable SVG into the hicolor icon theme so GeminiHarness appears in GNOME’s app grid/search.
- **Start on Login** — Writes or removes `~/.config/autostart/GeminiHarness.desktop`. Enabled login launches are tray-only (`--hidden`); the window stays closed until you open it from the tray. The checkbox follows the file on disk, including GNOME Startup Applications setting `Hidden=true` without deleting the entry.
- **Keyboard shortcut** — Opt-in from the tray (confirm before writing). Registers a named GNOME custom keybinding (`Super+G`) that relaunches the app so the single-instance handler toggles the window. Existing custom shortcuts are preserved (additive parent-array update). Uncheck removes the binding from GNOME.

## GNOME tray note

Without `gnome-shell-extension-appindicator`, the tray icon may not appear. Electron is pinned to **43.2.0** because 43.3–44 break AppIndicator on GNOME via a Chromium StatusNotifierItem multiplexer ([electron#52674](https://github.com/electron/electron/issues/52674)). We will move back to current Electron once that is fixed upstream.

## XWayland note

The app always uses XWayland so window position can be restored. Native Wayland’s xdg-shell does not allow clients to set their own position; size, maximize, and zoom would still work either way.
