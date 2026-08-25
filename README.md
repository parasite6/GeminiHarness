# GeminiHarness
A lightweight tray app for Fedora that keeps your Gemini session ready without a browser tab. Click the tray icon or hit a hotkey to open a resizable window with your logged-in gemini.google.com — chat, Canvas, sources, memory, all intact. No API key, no billing. Session persists across restarts.

## GNOME tray

The indicator uses StatusNotifierItem (AppIndicator). On GNOME, install and enable `gnome-shell-extension-appindicator` (`sudo dnf install gnome-shell-extension-appindicator`). Without that extension the tray icon may not appear. Closing the window hides it to the tray; **Quit Gemini** in the tray menu fully exits.

Electron is pinned to **43.2.0**. 43.3 through 44 ship a Chromium StatusNotifierItem multiplexer that GNOME's AppIndicator extension cannot talk to, so the icon never appears (see [electron#52674](https://github.com/electron/electron/issues/52674)). We will move back to current Electron once that is fixed upstream.

## XWayland (window position)

The app always runs under XWayland (`--ozone-platform=x11`). Native Wayland does not let clients set window position; XWayland is required for geometry restore to put the window where you left it. Size, maximize, and zoom already persisted either way.
