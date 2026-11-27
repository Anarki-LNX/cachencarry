# Proxmox-LXC: was fertig ist und wie es veröffentlicht wird

Stand: 27.11.2026.

## Was fertig ist

| Datei | Zweck | Getestet |
|---|---|---|
| `scripts/proxmox-lxc.sh` | Ein Befehl auf dem Proxmox-Host: legt einen unprivilegierten Debian-13-LXC ohne Nesting an, installiert das Release, gibt Adresse und Setup-Token aus. Modus `update <CTID>` aktualisiert. | ja, auf dem echten Proxmox (PVE 9.2) und vorher simuliert (siehe unten) |
| `deployments/community-scripts/ct/cachencarry.sh` | Container-Skript im Format von community-scripts | nur Syntax und shellcheck |
| `deployments/community-scripts/install/cachencarry-install.sh` | Installation im Container im Format von community-scripts | nur Syntax und shellcheck |
| `deployments/community-scripts/json/cachencarry.json` | Metadaten für die Website, Kategorie 4 (Network & Firewall) | JSON gültig |
| `README.md`, `DEPLOYMENT.md` | neuer Abschnitt „One command“ mit allen Variablen | |

### Wie getestet wurde

**Auf dem echten Proxmox** (PVE 9.2.32, 27.11.2026, nach deiner Freigabe):
Test-LXC 130 mit `CC_CTID=130 CC_CACHE_GB=2 CC_YES=1` angelegt, danach wieder
gelöscht.

- Installation: Release 0.2.2 geladen, Prüfsumme geprüft, Container auf
  `local-lvm` mit `mp0` (2 GB, ohne vzdump-Backup) angelegt, per DHCP im Netz,
  Dienst `active`, Weboberfläche HTTP 200, `healthcheck` erfolgreich,
  APT-Abruf über den Cache HTTP 200, Setup-Token ausgegeben.
- Gefunden und behoben: Ohne Nesting kann systemd 257 in Debian 13 die
  Einheiten `tmp.mount`, `run-lock.mount` und `dev-mqueue.mount` nicht
  einhängen, der Container stand auf `degraded` (bei Container 120 genauso).
  Das Skript maskiert die drei jetzt. Neu angelegt: Zustand `running`, keine
  fehlgeschlagenen Einheiten. Die Proxmox-Warnung „Systemd 257 detected. You
  may need to enable nesting.“ erscheint weiterhin und ist damit harmlos.
- Update: gleiche Version wird übersprungen, mit `CC_FORCE=1` Datenbank
  gesichert (`metadata-before-0.2.2-….db`), neu installiert, Dienst `active`.

Vorher lokal mit simulierten Proxmox-Befehlen und einem Container aus dem
offiziellen Template `debian-13-standard_13.6-1_amd64.tar.zst` (Release 0.2.1),
gleiches Ergebnis.

Nicht getestet: arm64, statische IP und VLAN, der Abbruch-Dialog.

## Weg 1: eigenes Skript im Repo (sofort möglich)

1. Die lokalen Commits auf `main` pushen. Danach funktioniert der Befehl aus
   dem README sofort:

   ```sh
   bash -c "$(curl -fsSL https://raw.githubusercontent.com/Anarki-LNX/cachencarry/main/scripts/proxmox-lxc.sh)"
   ```

2. Optional beim nächsten Release (`v0.2.2` oder `v0.3.0`) das Skript in den
   Release-Text aufnehmen. Die URL kann dann auf den Tag statt auf `main`
   zeigen, damit sich das Skript nicht unbemerkt ändert.

Das Skript lädt immer das neueste Release. Ein neues Release braucht keine
Änderung am Skript.

## Weg 2: community-scripts.org (noch nicht möglich)

Ein Hochladen bei community-scripts.org ist **heute nicht möglich**. Deren
Regeln für neue Skripte verlangen:

| Bedingung | Cache & Carry am 27.11.2026 |
|---|---|
| mindestens 1.000 Sterne auf GitHub | 0 |
| Projekt mindestens 6 Monate alt | angelegt am 21.11.2026, frühestens am 21.05.2027 |
| aktiv gepflegt, offizielle Release-Tarballs | erfüllt |
| keine Installation über Docker | erfüllt |

Ein Antrag oder Pull Request, der das nicht erfüllt, wird automatisch
geschlossen. Die Dateien liegen deshalb fertig vorbereitet in
`deployments/community-scripts/`, damit sie dann ohne neue Arbeit eingereicht
werden können.

### Schritte, sobald die Bedingungen erfüllt sind

1. Im Repo `community-scripts/ProxmoxVE` unter Discussions einen Script
   Request stellen (Vorlage „request-script“).
2. Das Repo `community-scripts/DevScripts` forken.
3. Die drei Dateien an dieselben Pfade kopieren:
   `ct/cachencarry.sh`, `install/cachencarry-install.sh`, `json/cachencarry.json`.
4. Im Fork ein Issue für Rückmeldungen von Testern anlegen und dessen URL in
   `ct/cachencarry.sh` bei `var_testurl` eintragen (Zeile ist vorbereitet).
5. `date_created` in der JSON-Datei auf das Datum des Pull Requests setzen.
6. Pull Request gegen `DevScripts` öffnen. Vorlage ausfüllen, Beschreibung
   zwei bis fünf Sätze. Vorschlag:

   > Cache & Carry is a LAN cache for APT and Pacman packages, shipped as static
   > release tarballs for amd64 and arm64. The install script deploys the
   > release with fetch_and_deploy_gh_release (prebuild) and runs the
   > project's own scripts/install.sh, which creates the service user and a
   > sandboxed systemd unit. That is the one deviation from the standard
   > service pattern. Tested with the project's standalone Proxmox script on
   > the Debian 13 template. Written with Claude Opus 5.5.

7. Der automatische Testbau läuft auf Proxmox VE und Incus. Danach Review,
   Rückmeldungen von Testern, Übernahme nach ProxmoxVE durch die Maintainer.

Die Inhalte der drei Dateien müssen vor dem Einreichen noch einmal gegen die
dann aktuelle `AGENTS.md` von DevScripts geprüft werden. Das Framework
ändert sich laufend.
