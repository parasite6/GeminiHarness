# Security Policy

## Scope

This app is a desktop wrapper around your own logged-in gemini.google.com
session — an Electron shell, a tray icon, and window plumbing. It does not
proxy, intercept, or modify network traffic to Google, does not spoof the
user agent, does not inject scripts, and does not execute anything on
Gemini's behalf. It does inject a small layout CSS inset so Gemini’s
fixed header sits below the custom title-bar overlay (zoom-scaled; not
theming or scraping). It stores no credentials of its own; auth is
Google's normal sign-in flow inside the embedded Chromium session
(`persist:gemini`).

Top-level navigations and `window.open` / `target=_blank` are filtered:

- Stay in-app: `gemini.google.com`, `accounts.google.com`, and
  `accounts.youtube.com` (literal hostnames only — not a `*.google.com`
  wildcard).
- Everything else (including Gemini “Sources” links such as
  `www.google.com/search?...`) is opened with the system browser via
  `shell.openExternal`, and only for `http:` / `https:` URLs.

Given that scope, the realistic attack surface is local: the Electron shell,
on-disk session and window state under the app userData directory, the
optional XDG autostart `.desktop` entry, tray / single-instance behavior,
and (when implemented) how dropped files are handled.

## Data on disk

Under the app userData path (typically `~/.config/GeminiHarness` on Linux):

- Chromium partition data for `persist:gemini` (cookies, local storage, etc.
  for the embedded Google session)
- `window-state.json` (geometry, maximize, zoom — not credentials)

Outside userData, if **Start on Login** is enabled:

- `~/.config/autostart/GeminiHarness.desktop` (Exec points at this app
  with `--hidden`; not credentials). Disabling via the tray deletes the
  file; GNOME Startup Applications may instead set `Hidden=true`.

## Supported Versions

This is a solo hobby project in early development. Only the latest released
version is supported. There are no LTS branches and no backport commitment.

| Version | Supported |
| ------- | --------- |
| latest  | ✅ |
| older   | ❌ |

## Reporting a Vulnerability

If you find a security issue, please **do not open a public GitHub issue**.

Instead, use GitHub's [private vulnerability reporting](../../security/advisories/new)
for this repository, or open a draft security advisory. I'll do my best to
respond within a few days — this is a one-person project, not a company with
an SLA, so please be patient.

Please include:
- A description of the issue and its potential impact
- Steps to reproduce, if possible
- Any relevant logs or environment details (Fedora version, GNOME/desktop
  environment, app version)

## What's Explicitly Out of Scope

- Vulnerabilities in Google's Gemini web app itself — report those to
  Google, not here.
- Issues that require an already-compromised machine or user account.
- Social engineering, phishing, or anything not specific to this app's code.
- Upstream Electron / Chromium bugs except as they affect this wrapper's
  behavior (e.g. tray or packaging workarounds we document).

## Disclosure

I'll credit reporters (unless you'd prefer to stay anonymous) once a fix is
released. No bug bounty — this is unpaid and unaffiliated with Google.
