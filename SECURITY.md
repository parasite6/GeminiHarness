# Security Policy

## Scope

This app is a desktop wrapper around your own logged-in gemini.google.com
session — an Electron shell, a tray icon, and window/hotkey plumbing. It does
not proxy, intercept, or modify network traffic to Google, does not execute
anything on Gemini's behalf, and stores no credentials of its own (auth is
handled entirely by Google's normal sign-in flow inside the embedded
session).

Given that scope, the realistic attack surface is local: the Electron shell
itself, how it handles window/session data on disk, and how it processes
things dropped into it (files, dragged content).

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

## Disclosure

I'll credit reporters (unless you'd prefer to stay anonymous) once a fix is
released. No bug bounty — this is unpaid and unaffiliated with Google.
