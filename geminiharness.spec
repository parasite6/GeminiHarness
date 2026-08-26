# GeminiHarness — Fedora/COPR package spec
#
# Builds the same layout as local `npm run dist` (electron-builder --linux rpm)
# by running that pipeline in %build, then extracting the produced RPM into
# the buildroot so /opt/GeminiHarness, geminiharness.desktop, and the hicolor
# SVG match the already-verified local package.
#
# COPR SCM: point the project at this repo + this spec. Network is required
# during %build (npm install downloads the pinned Electron binary).
#
# Electron MUST stay at 43.2.0 from package.json — do not add a Requires on
# a system `electron` RPM (that would override the pin and break GNOME tray
# AppIndicator; see electron#52674 / README "GNOME tray note").

%global debug_package %{nil}
# Prebuilt Electron/Chromium trees must not be stripped.
%global __strip /bin/true

Name:           geminiharness
Version:        1.1.0
Release:        1%{?dist}
Summary:        A lightweight desktop wrapper for a logged-in gemini.google.com session

# From LICENSE + package.json "license" (SPDX). Not GPLv3.
License:        MIT
URL:            https://github.com/parasite6/GeminiHarness
# GitHub tag/archive layout → top-level dir GeminiHarness-%{version}.
# COPR SCM may generate a differently named Source0; if %prep fails, adjust
# the -n argument to match the extracted directory name.
Source0:        %{url}/archive/refs/tags/v%{version}.tar.gz

# AppIndicator tray (required on GNOME; design docs / README).
Requires:       gnome-shell-extension-appindicator
# Do NOT Requires: electron — Electron comes from npm @ 43.2.0 during %build.

# Versioned Node stacks on Fedora 43/44 (plain "nodejs"/"npm" are not the
# primary names in current Fedora repos).
BuildRequires:  nodejs22
BuildRequires:  nodejs22-npm
BuildRequires:  rpm-build
BuildRequires:  cpio
BuildRequires:  libxcrypt-compat

ExclusiveArch:  x86_64

%description
A Fedora tray app that keeps a logged-in gemini.google.com session in an
Electron window, opened from an AppIndicator tray icon or an opt-in GNOME
Super+G hotkey. Session data persists across restarts; no API key and no
Google credential storage beyond Chromium's persist:gemini partition.

This package vendors Electron 43.2.0 via npm (pinned for GNOME AppIndicator;
electron#52674). It is not built against Fedora's system Electron package.


%prep
%autosetup -n GeminiHarness-%{version}


%build
# Same pipeline as package.json "dist": npm install + electron-builder --linux rpm.
# CI=true keeps electron-builder non-interactive in Mock/COPR.
export CI=true
export ELECTRON_CACHE=%{_builddir}/.cache/electron
export ELECTRON_BUILDER_CACHE=%{_builddir}/.cache/electron-builder
mkdir -p "${ELECTRON_CACHE}" "${ELECTRON_BUILDER_CACHE}"

npm ci

# Load-bearing pin — fail the build if package.json / lockfile drift.
node -e "const e=require('electron/package.json'); if (e.version !== '43.2.0') { console.error('Refusing to package: electron is ' + e.version + ', expected 43.2.0 (tray pin, electron#52674)'); process.exit(1); }"

npm run dist

BUILT_RPM=$(ls -1 dist/%{name}-%{version}*.rpm | head -n 1)
test -n "${BUILT_RPM}" && test -f "${BUILT_RPM}"
# Stash absolute path for %install (cwd is the extracted source tree).
cp -a "${BUILT_RPM}" %{_builddir}/%{name}-%{version}-built.rpm


%install
rm -rf %{buildroot}
mkdir -p %{buildroot}

# Extract electron-builder's RPM so installed paths match local `npm run dist`
# (e.g. /opt/GeminiHarness/, /usr/share/applications/geminiharness.desktop,
# /usr/share/icons/hicolor/scalable/apps/geminiharness.svg).
rpm2cpio %{_builddir}/%{name}-%{version}-built.rpm | cpio -D %{buildroot} -idmu

# Confirm the layout we already verified from local RPM installs.
test -x %{buildroot}/opt/GeminiHarness/%{name}
test -f %{buildroot}%{_datadir}/applications/%{name}.desktop
test -f %{buildroot}%{_datadir}/icons/hicolor/scalable/apps/%{name}.svg

# Record every path from the nested package for %files (keeps COPR identical
# to electron-builder's file set, including Chromium payloads under /opt).
( cd %{buildroot} && find . -mindepth 1 \( -type f -o -type l \) ) \
  | sed 's|^\./|/|' \
  | sort \
  > %{_builddir}/%{name}.files


%post
/bin/touch --no-create %{_datadir}/icons/hicolor &>/dev/null || :
if [ -x %{_bindir}/gtk-update-icon-cache ]; then
  %{_bindir}/gtk-update-icon-cache -f %{_datadir}/icons/hicolor &>/dev/null || :
fi
if [ -x %{_bindir}/update-desktop-database ]; then
  %{_bindir}/update-desktop-database -q %{_datadir}/applications &>/dev/null || :
fi


%postun
if [ -x %{_bindir}/gtk-update-icon-cache ]; then
  %{_bindir}/gtk-update-icon-cache -f %{_datadir}/icons/hicolor &>/dev/null || :
fi
if [ -x %{_bindir}/update-desktop-database ]; then
  %{_bindir}/update-desktop-database -q %{_datadir}/applications &>/dev/null || :
fi


%files -f %{_builddir}/%{name}.files
%license LICENSE
%doc README.md SECURITY.md


%changelog
* Tue Aug 25 2026 parasite6 <myworkforstore@proton.me> - 1.0.0-1
- Initial COPR/SCM package: npm ci + electron-builder RPM extract
- Pin Electron 43.2.0 for GNOME AppIndicator (electron#52674)
- Requires gnome-shell-extension-appindicator
