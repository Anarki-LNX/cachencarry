# YouTube: Installations-Tutorial

**Datei:** `final/de/cachencarry_installation_tutorial_de.mp4`
**Untertitel:** `subtitles/de/cachencarry_installation_tutorial_de.srt`, `subtitles/en/cachencarry_installation_tutorial_en.srt`
**Thumbnail:** `thumbnails/cachencarry_tutorial_thumbnail.png`

## Titel

Cache & Carry installieren: vom leeren Server zum eigenen LAN-Cache (Proxmox, Debian, Tutorial)

## Beschreibung

Schritt für Schritt vom leeren Server zum eigenen Paketcache im Netzwerk: Wir legen einen unprivilegierten Debian 13 Container auf Proxmox an, installieren Cache & Carry aus dem offiziellen Release v0.2.1, richten das Administratorkonto ein und verbinden zwei Debian-Clients. Danach sehen wir im Dashboard, wie aus MISS ein HIT wird.

Alles im Video ist eine echte Aufnahme einer frischen Installation. Gemessen im Video: `apt install curl` (10,2 MB) dauerte auf dem ersten Client 3 Sekunden (MISS, vom Debian-Mirror), auf dem zweiten 0 Sekunden mit 252 MB/s (HIT, aus dem Cache). Das ist ein Beispiel aus diesem Testaufbau, kein Garantiewert.

Alle Befehle zum Kopieren: https://github.com/Anarki-LNX/cachencarry/blob/main/marketing/cachencarry-video-campaign/tutorial/befehle.md

Neu seit dem Video: Auf Proxmox geht das Ganze jetzt auch mit einem einzigen Befehl auf dem Host. Er legt den Container an, installiert das neueste Release und zeigt Adresse und Setup-Token:
bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anarki-LNX/cachencarry/main/scripts/proxmox-lxc.sh)"
Außerdem gibt es ein fertiges Docker-Image: ghcr.io/anarki-lnx/cachencarry. Alle drei Wege: https://cachencarry.loopout.tech/de/#install

Kapitel
0:00 Was bauen wir?
0:46 Server vorbereiten
1:46 Herunterladen und installieren
2:29 Ersteinrichtung
3:06 Ersten Client einrichten
4:04 Cache testen
4:51 Ergebnis

Was du brauchst
• Debian oder Ubuntu mit systemd, z. B. ein Proxmox-LXC (unprivilegiert, ohne Nesting getestet)
• Minimum 1 Kern und 256 MB RAM, komfortabel 2 Kerne und 1 GB
• Speicherplatz für alles, was im Cache landen soll
• amd64 oder arm64

Unterstützte Clients: APT (Debian, Ubuntu, Proxmox VE) und Pacman (Arch Linux, CachyOS). Einfache HTTP-Dateiserver sind experimentell.

🌐 Website: https://cachencarry.loopout.tech
🔗 Quellcode: https://github.com/Anarki-LNX/cachencarry
📖 Installation und Upgrades: https://github.com/Anarki-LNX/cachencarry/blob/main/DEPLOYMENT.md
💻 Alle Clients: https://github.com/Anarki-LNX/cachencarry/blob/main/docs/CLIENTS.md
🩺 Probleme: https://github.com/Anarki-LNX/cachencarry/blob/main/docs/TROUBLESHOOTING.md

Lizenz: Apache 2.0. Die Software ist kostenlos, Hardware und Strom bringst du selbst mit.
❤️ Projekt unterstützen (freiwillig): https://www.paypal.me/HenryMeinekat

Die Sprecherstimme ist synthetisch (lokal erzeugt mit Piper TTS, Stimme Thorsten). Untertitel gibt es auf Deutsch und Englisch.
Wenn dir Cache & Carry gefällt, lass gerne einen Stern auf GitHub da.

#CacheAndCarry #Proxmox #Debian #Homelab #SelfHosted #LinuxServer

## Schlagwörter (Tags)

Cache & Carry installieren, Proxmox LXC, Proxmox Helper Script, Docker, Debian 13, apt cache, LAN Cache, Paketcache, Homelab Tutorial, systemd, Self Hosted, Open Source
