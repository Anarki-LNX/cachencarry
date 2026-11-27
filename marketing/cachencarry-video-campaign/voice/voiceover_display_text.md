# Anzeigetext (Untertitel, Bildtext, Beschreibungen)

Erzeugt von `pipeline/voice_qa.py` aus `scripts/*.json` (Feld `de`). Richtige Schreibweise, keine Lautschrift.

## presentation

- **problem** Kennst du das?
- **problem** Drei Linux-Rechner im Netzwerk. Drei Updates.
- **problem** Und dieselben Pakete werden immer wieder aus dem Internet geladen.
- **idea** Was wäre, wenn dein Netzwerk ein eigenes Paketlager hätte?
- **idea** Einmal herunterladen. Lokal speichern. Immer wieder verwenden.
- **meet** Das ist Cache & Carry.
- **meet** Ein schlanker, selbst gehosteter Paketcache für dein Netzwerk.
- **meet** Im Dashboard siehst du jede Anfrage, jedes gespeicherte Paket und wie viel Bandbreite du sparst.
- **hitmiss** Beim ersten Abruf kommt das Paket aus dem Internet.
- **hitmiss** Danach liegt es im Cache.
- **hitmiss** Der nächste Rechner bekommt es direkt aus deinem Netzwerk.
- **shared** Und wenn mehrere Rechner gleichzeitig dieselbe Datei brauchen, reicht ein einziger Download aus dem Internet für alle.
- **shared** In unserem Testnetzwerk kam ein Paketindex mit 8,6 MiB in 959 ms aus dem Internet. Aus dem Cache in 9 ms.
- **homelab** Ob Proxmox, Debian, Ubuntu, Arch oder CachyOS:
- **homelab** Cache & Carry bringt deine unterstützten Paketquellen unter ein gemeinsames Dach.
- **homelab** Als schlanker systemd-Dienst, zum Beispiel in einem Proxmox-Container.
- **cta** Cache & Carry ist kostenlos auf GitHub verfügbar, Open Source und bereit für dein Homelab.
- **cta** Wenn du es ausprobierst, lass einen Stern da, teile das Projekt und sag mir in den Kommentaren, wie du es einsetzt.

## tutorial

- **title** In diesem Tutorial installieren wir Cache & Carry auf einem frischen Server, Schritt für Schritt.
- **title** Cache & Carry ist ein Paketcache für dein lokales Netzwerk.
- **diagram** Der erste Rechner lädt ein Paket aus dem Internet. Cache & Carry speichert es, und jeder weitere Rechner bekommt es direkt aus dem LAN.
- **diagram** Unterstützt werden heute APT für Debian, Ubuntu und Proxmox sowie Pacman für Arch Linux und CachyOS.
- **diagram** Die Hardware darf klein sein: Ein Kern und 256 MB RAM sind das Minimum, mit zwei Kernen und einem GB läuft es komfortabel. Dazu Speicherplatz für alles, was im Cache landen soll.
- **diagram** Am Ende hast du einen laufenden Dienst, ein Dashboard und zwei Debian-Clients, die ihre Pakete aus deinem Cache holen.
- **proxmox** Wir nehmen den empfohlenen Weg: einen unprivilegierten Debian 13 Container auf Proxmox. Ein normaler Server mit Debian oder Ubuntu und systemd funktioniert genauso.
- **proxmox** Auf dem Proxmox-Host legen wir den Container an: zwei Kerne, ein GB RAM, acht GB Speicher und eine feste IP-Adresse.
- **proxmox** Proxmox warnt, dass systemd 257 eventuell Nesting braucht. Für Cache & Carry ist das nicht nötig: Der Dienst wurde genau so ohne Nesting getestet.
- **server** In der Konsole des Containers prüfen wir das System: Debian 13, Architektur amd64. Danach richtet sich das Release-Archiv.
- **server** Die Adresse 192.168.1.41 brauchen wir später für die Clients. Zwei Kerne, ein GB RAM, und unter /var/lib ist genug Platz für den Cache.
- **server** Wir arbeiten hier als root. Auf einem normalen Server stellst du den Installationsbefehlen sudo voran.
- **download** Jetzt laden wir das offizielle Release 0.2.1 von GitHub herunter und dazu die Datei mit den Prüfsummen.
- **download** sha256sum bestätigt: Das Archiv ist unverändert.
- **download** Wir entpacken es. Darin sind das Programm, die systemd-Unit, eine Beispielkonfiguration und das Installationsskript.
- **install** Das Skript legt den Systembenutzer cachencarry an, installiert das Programm nach /usr/local/bin und erzeugt /etc/cachencarry und /var/lib/cachencarry.
- **install** Dann prüft es die Konfiguration und startet den gehärteten systemd-Dienst.
- **status** systemctl zeigt: Der Dienst cachencarry ist aktiv und läuft. Der Healthcheck antwortet mit ok.
- **browser** Öffne jetzt im Browser die Adresse des Servers mit Port 8080.
- **browser** Beim ersten Aufruf legst du das Administratorkonto an. Damit das nur kann, wer Zugriff auf den Server hat, fragt die Einrichtung nach einem einmaligen Setup-Token.
- **token** Das Token liest du auf dem Server mit diesem Befehl aus. Im Video ist es unkenntlich gemacht.
- **form** Benutzername, ein Passwort mit mindestens zehn Zeichen, das Token einfügen, und Konto anlegen.
- **form** Fertig. Das Dashboard ist noch leer, weil noch kein Client den Cache nutzt.
- **client** Jetzt der erste Client, ein Debian 13 Rechner. Hier siehst du seine originale Paketquelle.
- **sources** Wir sichern die Datei und ersetzen sie durch die Variante aus der Dokumentation. Statt deb.debian.org steht dort der Cache mit Port 8080 und dem Pfad apt/debian.
- **sources** Die Zeile Signed-By bleibt. apt prüft die Signaturen weiterhin selbst. Cache & Carry reicht die Dateien nur unverändert durch.
- **dialog** Die passende Konfiguration für jedes Repository zeigt dir auch das Dashboard unter Cache-Module.
- **apt1** Jetzt apt update. Die Paketlisten kommen schon über den Cache.
- **apt1** Dann installieren wir curl. Der Cache ist noch leer, also holt Cache & Carry jedes Paket einmal vom Debian-Server im Internet. Das sind die MISS-Einträge.
- **arch** Für Arch Linux und CachyOS geht es genauso über die Mirrorlist. Die Zeilen dafür stehen in docs/CLIENTS.md.
- **client2** Jetzt der spannende Teil: ein zweiter Client mit derselben Konfiguration. Er läuft hier auf demselben PC, deshalb zeigt das Dashboard dieselbe Adresse.
- **apt2** apt update und dieselbe Installation.
- **apt2** Diesmal kommt alles aus dem Cache. Beim ersten Client dauerte der Download drei Sekunden, jetzt null Sekunden, mit 252 MB pro Sekunde.
- **traffic** Im Live-Traffic siehst du den Unterschied: oben die HIT-Einträge des zweiten Clients, darunter die MISS-Einträge des ersten.
- **curl** Auf der Kommandozeile prüfst du es mit curl und dem Header X-Cache. Beim allerersten Abruf steht dort MISS, danach HIT.
- **stats** Die Statistik zählt die Bytes, die wirklich übertragen wurden: was aus dem Internet kam und was der Cache eingespart hat.
- **files** Damit läuft dein Cache. Hier findest du alles Wichtige.
- **files** Die Konfiguration liegt in /etc/cachencarry/config.yaml, der Cache in /var/lib/cachencarry, und die Logs zeigt journalctl.
- **tour** Im Dashboard findest du gespeicherte Pakete unter Speicher. Unter Einstellungen begrenzt du Cachegröße und Bandbreite, ohne Neustart.
- **tour** Die Anleitungen für Clients findest du unter Cache-Module und in der Dokumentation auf GitHub.
- **outro** Und das war's. Dein eigenes Paketlager im Netzwerk.
- **outro** Den vollständigen Quellcode findest du kostenlos auf GitHub. Wenn dir Cache & Carry gefällt, lass gerne einen Stern da.

## short01

- **hook** Dein Netzwerk lädt das alles mehrfach?
- **problem** Warum soll jeder Rechner dieselben Pakete aus dem Internet laden?
- **solution** Cache & Carry speichert sie zentral in deinem Netzwerk.
- **solution** Einmal herunterladen. Danach lokal nutzen.
- **end** Dein eigener LAN-Cache. Open Source und kostenlos auf GitHub.

## short02

- **hook** Zwei Wörter. Ein ganzes Netzwerk schneller.
- **miss** MISS bedeutet: Das Paket muss noch aus dem Internet kommen.
- **hit** HIT bedeutet: Es liegt bereits in deinem Cache.
- **hit** Und genau das macht Cache & Carry so praktisch.
- **end** Probier es selbst. Open Source auf GitHub.

## short03

- **hook** 959 Millisekunden. 9 Millisekunden. Was ist passiert?
- **compare** Im dokumentierten Testnetzwerk brauchte ein Paketindex mit 8,6 MiB 959 Millisekunden aus dem Internet.
- **compare** Aus dem Cache waren es nur 9.
- **end** Genau dafür gibt es Cache & Carry. Mehr im GitHub-Repository.

## short04

- **hook** Zehn Rechner. Dieselbe Datei. Nur ein Download.
- **demo** Wenn mehrere Rechner gleichzeitig dieselbe Datei anfordern, die noch nicht im Cache liegt,
- **demo** muss Cache & Carry sie nicht zehnmal aus dem Internet laden.
- **demo** Ein einziger Download aus dem Internet versorgt alle wartenden Rechner.
- **end** Für dein Homelab. Open Source auf GitHub.

## short05

- **hook** Und was kostet das?
- **free** Die Software? Kostenlos auf GitHub.
- **free** Open Source unter Apache 2.0.
- **control** Du betreibst sie selbst in deinem Netzwerk und behältst die Kontrolle.
- **control** Nur Hardware und Strom für deinen Server bringst du selbst mit.
- **end** Gib dem Repository einen Stern und probier es aus.

