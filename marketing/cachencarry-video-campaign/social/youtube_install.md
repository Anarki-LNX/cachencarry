# YouTube: Installationsvideo, drei Wege (DE und EN)

Zwei getrennte Fassungen: deutsch (Bildtext, Stimme Thorsten) und englisch
(Bildtext, Stimme Kokoro am_michael). Keine eingebrannten Untertitel.

---

## Deutsch

**Datei:** `final/de/cachencarry_install_three_ways_de.mp4`
**Untertitel:** `subtitles/de/cachencarry_install_three_ways_de.srt` (Übersetzung: `subtitles/en/cachencarry_install_three_ways_en.srt`)
**Thumbnail:** `thumbnails/cachencarry_install_thumbnail_de.png`

### Titel

Cache & Carry installieren: drei Wege zum eigenen Paketcache (Proxmox, Docker, Debian)

### Beschreibung

Drei Linux-Rechner, drei Updates, und jeder lädt dieselben Pakete wieder aus dem Internet. Cache & Carry ist ein schlanker, selbst gehosteter Paketcache für dein Netzwerk: Der erste Rechner lädt ein Paket aus dem Internet, alle weiteren bekommen es direkt aus deinem LAN. Für APT und Pacman, mit Dashboard, Statistiken und Speicherlimits. Kostenlos und Open Source (Apache 2.0).

Drei Wege zur Installation, überall dieselbe Version:
1. Proxmox VE: ein Befehl auf dem Host legt einen unprivilegierten Debian-13-Container an, prüft die Prüfsumme und installiert das neueste Release.
2. Docker: Image ghcr.io/anarki-lnx/cachencarry für amd64 und arm64, kleiner als 16 MB, ohne Shell.
3. Debian oder Ubuntu: Release-Paket laden, install.sh starten. Läuft als systemd-Dienst, auch in VMs und auf dem Raspberry Pi.

Alle Befehle zum Kopieren:
🌐 Website: https://cachencarry.loopout.tech
💻 GitHub: https://github.com/Anarki-LNX/cachencarry

Kapitel
0:00 Das Problem
0:09 Die Lösung
0:17 MISS und HIT im Live-Traffic
0:26 Was ist Cache & Carry?
0:38 Drei Wege, eine Version
0:43 Weg 1: Proxmox VE
1:00 Weg 2: Docker
1:13 Weg 3: Debian oder Ubuntu
1:31 Einrichtung im Browser
1:39 Website, GitHub und Open Source

Wenn dir das Video hilft: Abonniere den Kanal, lass ein Like da und schreib mir in die Kommentare, wie du Cache & Carry einsetzt. Ein Stern auf GitHub hilft dem Projekt ebenfalls.

Sprecherstimme synthetisch (Piper TTS).

#Proxmox #Docker #Homelab #SelfHosted #Linux #CacheAndCarry

---

## English

**File:** `final/en/cachencarry_install_three_ways_en.mp4`
**Subtitles:** `subtitles/en-video/cachencarry_install_three_ways_en.srt`
**Thumbnail:** `thumbnails/cachencarry_install_thumbnail_en.png`

### Title

Install Cache & Carry: three ways to your own package cache (Proxmox, Docker, Debian)

### Description

Three Linux machines, three updates, and each one downloads the same packages from the internet again. Cache & Carry is a lean, self-hosted package cache for your network: the first machine downloads a package from the internet, all others get it straight from your LAN. For APT and Pacman, with a dashboard, statistics and storage limits. Free and open source (Apache 2.0).

Three ways to install, the same version everywhere:
1. Proxmox VE: one command on the host creates an unprivileged Debian 13 container, verifies the checksum and installs the latest release.
2. Docker: image ghcr.io/anarki-lnx/cachencarry for amd64 and arm64, smaller than 16 MB, no shell.
3. Debian or Ubuntu: download the release package, run install.sh. Runs as a systemd service, also in VMs and on a Raspberry Pi.

All commands to copy:
🌐 Website: https://cachencarry.loopout.tech
💻 GitHub: https://github.com/Anarki-LNX/cachencarry

Chapters
0:00 The problem
0:09 The solution
0:17 MISS and HIT in live traffic
0:26 What is Cache & Carry?
0:39 Three ways, one version
0:44 Option 1: Proxmox VE
1:03 Option 2: Docker
1:17 Option 3: Debian or Ubuntu
1:35 Setup in the browser
1:43 Website, GitHub and open source

If this video helps you: subscribe to the channel, leave a like and tell me in the comments how you use Cache & Carry. A star on GitHub helps the project too.

Synthetic voice (Kokoro TTS).

#Proxmox #Docker #Homelab #SelfHosted #Linux #CacheAndCarry
