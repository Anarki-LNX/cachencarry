# Proxmox-LXC: was fertig ist und wie es veröffentlicht wird

Stand: 27.11.2026.

## Was fertig ist

| Datei | Zweck | Getestet |
|---|---|---|
| `scripts/proxmox-lxc.sh` | Ein Befehl auf dem Proxmox-Host: legt einen unprivilegierten Debian-13-LXC ohne Nesting an, installiert das Release, gibt Adresse und Setup-Token aus. Modus `update <CTID>` aktualisiert. | ja, mit simulierten Proxmox-Befehlen (siehe unten) |
| `deployments/community-scripts/ct/cachencarry.sh` | Container-Skript im Format von community-scripts | nur Syntax und shellcheck |
| `deployments/community-scripts/install/cachencarry-install.sh` | Installation im Container im Format von community-scripts | nur Syntax und shellcheck |
| `deployments/community-scripts/json/cachencarry.json` | Metadaten für die Website, Kategorie 4 (Network & Firewall) | JSON gültig |
| `README.md`, `DEPLOYMENT.md` | neuer Abschnitt „One command“ mit allen Variablen | |

### Wie getestet wurde

Kein echter Proxmox-Host, weil ein Test-LXC auf dem Proxmox nur nach deiner
Freigabe angelegt wird. Stattdessen:

- `pct`, `pveam`, `pvesm`, `pvesh` und `pveversion` wurden durch kleine
  Ersatzskripte simuliert. `pct create` startete dabei einen lokalen Container
  aus dem **offiziellen Proxmox-Template** `debian-13-standard_13.6-1_amd64.tar.zst`
  mit systemd. `pct exec` und `pct push` liefen echt in diesem Container.
- Ergebnis Installation: Release 0.2.1 geladen, Prüfsumme geprüft, Debian
  aktualisiert, Dienst `active`, Weboberfläche antwortet mit HTTP 200,
  `cachencarry healthcheck` erfolgreich, Setup-Token ausgegeben.
- Ergebnis Update: gleiche Version wird erkannt und übersprungen, mit
  `CC_FORCE=1` Datenbank gesichert, neu installiert, Dienst wieder `active`.
- Nicht getestet: echtes `pct create` mit Storage und `mp0`, arm64, statische
  IP, der Abbruch-Dialog. Der manuelle Weg mit denselben Einstellungen ist laut
  `DEPLOYMENT.md` auf PVE 9.2 getestet.

Empfehlung vor dem Veröffentlichen: einmal auf dem Proxmox einen Test-LXC mit
einer freien ID (zum Beispiel 130) anlegen lassen und danach wieder löschen:

```sh
CC_CTID=130 bash scripts/proxmox-lxc.sh
pct stop 130 && pct destroy 130 --purge 1
```

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
