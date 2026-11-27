# Sprechtext (nur für die Sprachsynthese)

Erzeugt von `pipeline/voice_qa.py`. Je Satz: **Sprechfassung** (Feld `tts`, normale Schreibweise, sonst `de`)
und darunter, was Piper nach der Ausspracheliste bekommt. `[[ ]]` ist Lautschrift (IPA), `{p300}` eine Pause von 300 ms.
Dieser Text darf nie in Untertitel, Bildtexte oder Beschreibungen gelangen.

## presentation

- **problem** (intro) Kennst du das?  
  `Kennst du das?`
- **problem** (intro) Drei Linux-Rechner im Netzwerk. Drei Updates.  
  `Drei Linux-Rechner im Netzwerk. Drei Updates.`
- **problem** (intro) Und dieselben Pakete werden immer wieder aus dem Internet geladen.  
  `Und dieselben Pakete werden immer wieder aus dem Internet geladen.`
- **idea** (intro) Was wäre, wenn dein Netzwerk ein eigenes Paketlager hätte?  
  `Was wäre, wenn dein Netzwerk ein eigenes Paketlager hätte?`
- **idea** (intro) Einmal herunterladen. Lokal speichern. Immer wieder verwenden.  
  `Einmal herunterladen. Lokal speichern. Immer wieder verwenden.`
- **meet** (product) Das ist Cache & Carry.  
  `Das ist Käsch and Kärri.`
- **meet** (product) Ein schlanker, selbst gehosteter Paketcache für dein Netzwerk.  
  `Ein schlanker, selbst gehosteter Paketkäsch für dein Netzwerk.`
- **meet** (product) Im Dashboard siehst du jede Anfrage. Jedes gespeicherte Paket. Und wie viel Bandbreite du sparst.  
  `Im Dashboard siehst du jede Anfrage. Jedes gespeicherte Paket. Und wie viel Bandbreite du sparst.`
- **hitmiss** (tech) Beim ersten Abruf kommt das Paket aus dem Internet.  
  `Beim ersten Abruf kommt das Paket aus dem Internet.`
- **hitmiss** (tech) Danach liegt es im Cache.  
  `Danach liegt es im Käsch.`
- **hitmiss** (tech) Der nächste Rechner bekommt es direkt aus deinem Netzwerk.  
  `Der nächste Rechner bekommt es direkt aus deinem Netzwerk.`
- **shared** (tech) Und wenn mehrere Rechner gleichzeitig dieselbe Datei brauchen? Dann reicht ein einziger Download aus dem Internet. Für alle.  
  `Und wenn mehrere Rechner gleichzeitig dieselbe Datei brauchen? Dann reicht ein einziger Daunlohd aus dem Internet. Für alle.`
- **shared** (tech) In unserem Testnetzwerk kam ein Paketindex mit acht Komma sechs Mebibyte in neunhundertneunundfünfzig Millisekunden aus dem Internet. Aus dem Cache in neun.  
  `In unserem Testnetzwerk kam ein Paketindex mit acht Komma sechs [[mˈeːbibaɪt]] in neunhundertneunundfünfzig Millisekunden aus dem Internet. Aus dem Käsch in neun.`
- **homelab** (product) Ob Proxmox, Debian, Ubuntu, Arch oder CachyOS:  
  `Ob Proxmox, [[dˈeːbi̯aːn]], Ubbuntu, [[ˈaːɐtʃ]] oder Kätschi O S:`
- **homelab** (product) Cache & Carry bringt deine unterstützten Paketquellen unter ein gemeinsames Dach.  
  `Käsch and Kärri bringt deine unterstützten Paketquellen unter ein gemeinsames Dach.`
- **homelab** (product) Als schlanker systemd-Dienst, zum Beispiel in einem Proxmox-Container.  
  `Als schlanker System Dee-Dienst, zum Beispiel in einem Proxmox-Container.`
- **cta** (cta) Cache & Carry ist kostenlos auf GitHub. Open Source. Und bereit für dein Homelab.  
  `Käsch and Kärri ist kostenlos auf Gitt-Hab. [[ˈoːpən zˈɔːɐs]]. Und bereit für dein [[hˈoːmlɛp]].`
- **cta** (cta) Probier es aus. Lass einen Stern da, teile das Projekt, und sag mir in den Kommentaren, wie du es einsetzt.  
  `Probier es aus. Lass einen Stern da, teile das Projekt, und sag mir in den Kommentaren, wie du es einsetzt.`

## tutorial

- **title** (intro) In diesem Tutorial installieren wir Cache & Carry auf einem frischen Server, Schritt für Schritt.  
  `In diesem Tutorial installieren wir Käsch and Kärri auf einem frischen Server, Schritt für Schritt.`
- **title** (intro) Cache & Carry ist ein Paketcache für dein lokales Netzwerk.  
  `Käsch and Kärri ist ein Paketkäsch für dein lokales Netzwerk.`
- **diagram** (tutorial) Der erste Rechner lädt ein Paket aus dem Internet. Cache & Carry speichert es. Und jeder weitere Rechner bekommt es direkt aus dem LAN.  
  `Der erste Rechner lädt ein Paket aus dem Internet. Käsch and Kärri speichert es. Und jeder weitere Rechner bekommt es direkt aus dem Lan.`
- **diagram** (tutorial) Unterstützt werden heute APT für Debian, Ubuntu und Proxmox. Und Pacman für Arch Linux und CachyOS.  
  `Unterstützt werden heute A P T für [[dˈeːbi̯aːn]], Ubbuntu und Proxmox. Und [[pˈɛkmɛn]] für [[ˈaːɐtʃ]] Linux und Kätschi O S.`
- **diagram** (tutorial) Die Hardware darf klein sein. Ein Kern und 256 Megabyte RAM sind das Minimum. Mit zwei Kernen und einem Gigabyte läuft es komfortabel. Dazu kommt Speicherplatz für alles, was im Cache landen soll.  
  `Die Hardware darf klein sein. Ein Kern und 256 [[mˈeːɡabaɪt]] Ramm sind das Minimum. Mit zwei Kernen und einem Gigabyte läuft es komfortabel. Dazu kommt Speicherplatz für alles, was im Käsch landen soll.`
- **diagram** (tutorial) Am Ende hast du einen laufenden Dienst, ein Dashboard und zwei Debian-Clients, die ihre Pakete aus deinem Cache holen.  
  `Am Ende hast du einen laufenden Dienst, ein Dashboard und zwei [[dˈeːbi̯aːn]]-[[klˈaɪɛnts]], die ihre Pakete aus deinem Käsch holen.`
- **proxmox** (tutorial) Wir nehmen den empfohlenen Weg: einen unprivilegierten Debian dreizehn Container auf Proxmox. Ein normaler Server mit Debian oder Ubuntu und systemd funktioniert genauso.  
  `Wir nehmen den empfohlenen Weg: einen unprivilegierten [[dˈeːbi̯aːn]] dreizehn Container auf Proxmox. Ein normaler Server mit [[dˈeːbi̯aːn]] oder Ubbuntu und System Dee funktioniert genauso.`
- **proxmox** (tutorial) Auf dem Proxmox Host legen wir den Container an: zwei Kerne, ein Gigabyte RAM, acht Gigabyte Speicher und eine feste IP-Adresse.  
  `Auf dem Proxmox Host legen wir den Container an: zwei Kerne, ein Gigabyte Ramm, acht Gigabyte Speicher und eine feste IP-Adresse.`
- **proxmox** (tutorial) Proxmox warnt, dass systemd zweihundertsiebenundfünfzig eventuell Nesting braucht. Für Cache & Carry ist das nicht nötig. Der Dienst wurde genau so getestet, ohne Nesting.  
  `Proxmox warnt, dass System Dee zweihundertsiebenundfünfzig eventuell Nesting braucht. Für Käsch and Kärri ist das nicht nötig. Der Dienst wurde genau so getestet, ohne Nesting.`
- **server** (tutorial) In der Konsole des Containers prüfen wir das System: Debian dreizehn, Architektur amd64. Danach richtet sich das Release-Archiv.  
  `In der Konsole des Containers prüfen wir das System: [[dˈeːbi̯aːn]] dreizehn, Architektur A M D 64. Danach richtet sich das Release-Archiv.`
- **server** (tutorial) Die Adresse 192 Punkt 168 Punkt 1 Punkt 41 brauchen wir später für die Clients. Zwei Kerne, ein Gigabyte RAM. Und unter var lib ist genug Platz für den Cache.  
  `Die Adresse 192 Punkt 168 Punkt 1 Punkt 41 brauchen wir später für die [[klˈaɪɛnts]]. Zwei Kerne, ein Gigabyte Ramm. Und unter var lib ist genug Platz für den Käsch.`
- **server** (tutorial) Wir arbeiten hier mit Administratorrechten. Auf einem normalen Server stellst du den Installationsbefehlen sudo voran.  
  `Wir arbeiten hier mit Administratorrechten. Auf einem normalen Server stellst du den Installationsbefehlen Sudu voran.`
- **download** (tutorial) Jetzt laden wir das offizielle Release null Punkt zwei Punkt eins von GitHub herunter und dazu die Datei mit den Prüfsummen.  
  `Jetzt laden wir das offizielle Release null Punkt zwei Punkt eins von Gitt-Hab herunter und dazu die Datei mit den Prüfsummen.`
- **download** (tutorial) SHA-256-Summe bestätigt: Das Archiv ist unverändert.  
  `Scha 256-Summe bestätigt: Das Archiv ist unverändert.`
- **download** (tutorial) Wir entpacken es. Darin sind das Programm, die systemd-Unit, eine Beispielkonfiguration und das Installationsskript.  
  `Wir entpacken es. Darin sind das Programm, die System Dee-Unit, eine Beispielkonfiguration und das Installationsskript.`
- **install** (tutorial) Das Skript legt den Systembenutzer cachencarry an, installiert das Programm nach user local bin und erzeugt die Ordner für Konfiguration und Daten.  
  `Das Skript legt den Systembenutzer Käsch en Kärri an, installiert das Programm nach user local bin und erzeugt die Ordner für Konfiguration und Daten.`
- **install** (tutorial) Dann prüft es die Konfiguration und startet den gehärteten systemd-Dienst.  
  `Dann prüft es die Konfiguration und startet den gehärteten System Dee-Dienst.`
- **status** (tutorial) systemctl zeigt: Der Dienst cachencarry ist aktiv und läuft. Der Healthcheck antwortet mit ok.  
  `System C-T-L zeigt: Der Dienst Käsch en Kärri ist aktiv und läuft. Der [[hˈɛlθtʃɛk]] antwortet mit ok.`
- **browser** (tutorial) Öffne jetzt im Browser die Adresse des Servers mit Port achttausendachtzig.  
  `Öffne jetzt im Browser die Adresse des Servers mit Port achttausendachtzig.`
- **browser** (tutorial) Beim ersten Aufruf legst du das Administratorkonto an. Damit das nur kann, wer Zugriff auf den Server hat, fragt die Einrichtung nach einem einmaligen Token für die Einrichtung.  
  `Beim ersten Aufruf legst du das Administratorkonto an. Damit das nur kann, wer Zugriff auf den Server hat, fragt die Einrichtung nach einem einmaligen Token für die Einrichtung.`
- **token** (tutorial) Das Token liest du auf dem Server mit diesem Befehl aus. Im Video ist es unkenntlich gemacht.  
  `Das Token liest du auf dem Server mit diesem Befehl aus. Im Video ist es unkenntlich gemacht.`
- **form** (tutorial) Benutzername, ein Passwort mit mindestens zehn Zeichen, das Token einfügen, und Konto anlegen.  
  `Benutzername, ein Passwort mit mindestens zehn Zeichen, das Token einfügen, und Konto anlegen.`
- **form** (tutorial) Fertig. Das Dashboard ist noch leer, weil noch kein Client den Cache nutzt.  
  `Fertig. Das Dashboard ist noch leer, weil noch kein [[klˈaɪɛnt]] den Käsch nutzt.`
- **client** (tutorial) Jetzt der erste Client, ein Debian dreizehn Rechner. Hier siehst du seine originale Paketquelle.  
  `Jetzt der erste [[klˈaɪɛnt]], ein [[dˈeːbi̯aːn]] dreizehn Rechner. Hier siehst du seine originale Paketquelle.`
- **sources** (tutorial) Wir sichern die Datei und ersetzen sie durch die Variante aus der Dokumentation. Statt des offiziellen Debian-Servers steht dort der Cache mit Port achttausendachtzig und dem Pfad APT Debian.  
  `Wir sichern die Datei und ersetzen sie durch die Variante aus der Dokumentation. Statt des offiziellen [[dˈeːbi̯aːn]]-Servers steht dort der Käsch mit Port achttausendachtzig und dem Pfad A P T [[dˈeːbi̯aːn]].`
- **sources** (tutorial) Die Zeile Signed-By bleibt. APT prüft die Signaturen weiterhin selbst. Cache & Carry reicht die Dateien nur unverändert durch.  
  `Die Zeile [[sˈaɪnt bˈaɪ]] bleibt. A P T prüft die Signaturen weiterhin selbst. Käsch and Kärri reicht die Dateien nur unverändert durch.`
- **dialog** (tutorial) Die passende Konfiguration für jedes Repository zeigt dir auch das Dashboard unter Cache-Module.  
  `Die passende Konfiguration für jedes Repository zeigt dir auch das Dashboard unter Käsch-Module.`
- **apt1** (tutorial) Jetzt APT update. Die Paketlisten kommen schon über den Cache.  
  `Jetzt A P T update. Die Paketlisten kommen schon über den Käsch.`
- **apt1** (tutorial) Dann installieren wir curl. Der Cache ist noch leer. Also holt Cache & Carry jedes Paket einmal vom Debian-Server im Internet. Das sind die MISS-Einträge.  
  `Dann installieren wir [[kˈœɾl]]. Der Käsch ist noch leer. Also holt Käsch and Kärri jedes Paket einmal vom [[dˈeːbi̯aːn]]-Server im Internet. Das sind die Miss-Einträge.`
- **arch** (tutorial) Für Arch Linux und CachyOS geht es genauso über die Liste der Paketserver. Die Zeilen dafür stehen in der Datei CLIENTS Punkt M D im Ordner docs.  
  `Für [[ˈaːɐtʃ]] Linux und Kätschi O S geht es genauso über die Liste der Paketserver. Die Zeilen dafür stehen in der Datei [[klˈaɪɛnts]] Punkt M D im Ordner [[dˈɔks]].`
- **client2** (tutorial) Jetzt der spannende Teil: ein zweiter Client mit derselben Konfiguration. Er läuft hier auf demselben PC, deshalb zeigt das Dashboard dieselbe Adresse.  
  `Jetzt der spannende Teil: ein zweiter [[klˈaɪɛnt]] mit derselben Konfiguration. Er läuft hier auf demselben PC, deshalb zeigt das Dashboard dieselbe Adresse.`
- **apt2** (tutorial) APT update und dieselbe Installation.  
  `A P T update und dieselbe Installation.`
- **apt2** (tutorial) Diesmal kommt alles aus dem Cache. Beim ersten Client dauerte der Download drei Sekunden. Jetzt null Sekunden, mit zweihundertzweiundfünfzig Megabyte pro Sekunde.  
  `Diesmal kommt alles aus dem Käsch. Beim ersten [[klˈaɪɛnt]] dauerte der Daunlohd drei Sekunden. Jetzt null Sekunden, mit zweihundertzweiundfünfzig [[mˈeːɡabaɪt]] pro Sekunde.`
- **traffic** (tutorial) Im Live-Traffic siehst du den Unterschied: oben die HIT-Einträge des zweiten Clients, darunter die MISS-Einträge des ersten.  
  `Im Leif Träffick siehst du den Unterschied: oben die Hitt-Einträge des zweiten [[klˈaɪɛnts]], darunter die Miss-Einträge des ersten.`
- **curl** (tutorial) Auf der Kommandozeile prüfst du es mit curl und der Kopfzeile X Cache. Beim allerersten Abruf steht dort MISS, danach HIT.  
  `Auf der Kommandozeile prüfst du es mit [[kˈœɾl]] und der Kopfzeile X Käsch. Beim allerersten Abruf steht dort Miss, danach Hitt.`
- **stats** (tutorial) Die Statistik zählt die Bytes, die wirklich übertragen wurden. Was aus dem Internet kam. Und was der Cache eingespart hat.  
  `Die Statistik zählt die [[bˈaɪts]], die wirklich übertragen wurden. Was aus dem Internet kam. Und was der Käsch eingespart hat.`
- **files** (tutorial) Damit läuft dein Cache. Hier findest du alles Wichtige.  
  `Damit läuft dein Käsch. Hier findest du alles Wichtige.`
- **files** (tutorial) Die Konfiguration liegt in der Datei config Punkt yaml unter etc. Der Cache liegt unter var lib. Und die Logs zeigt journalctl.  
  `Die Konfiguration liegt in der Datei config Punkt Jammel unter E T C. Der Käsch liegt unter var lib. Und die [[lˈɔks]] zeigt Journal C T L.`
- **tour** (tutorial) Im Dashboard findest du gespeicherte Pakete unter Speicher. Unter Einstellungen begrenzt du Cachegröße und Bandbreite, ohne Neustart.  
  `Im Dashboard findest du gespeicherte Pakete unter Speicher. Unter Einstellungen begrenzt du Käschgröße und Bandbreite, ohne Neustart.`
- **tour** (tutorial) Die Anleitungen für Clients findest du unter Cache-Module und in der Dokumentation auf GitHub.  
  `Die Anleitungen für [[klˈaɪɛnts]] findest du unter Käsch-Module und in der Dokumentation auf Gitt-Hab.`
- **outro** (cta) Und das war's. Dein eigenes Paketlager im Netzwerk.  
  `Und das war's. Dein eigenes Paketlager im Netzwerk.`
- **outro** (cta) Den vollständigen Quellcode findest du kostenlos auf GitHub. Wenn dir Cache & Carry gefällt, lass gerne einen Stern da.  
  `Den vollständigen Quellcode findest du kostenlos auf Gitt-Hab. Wenn dir Käsch and Kärri gefällt, lass gerne einen Stern da.`

## short01

- **hook** (intro) Dein Netzwerk lädt das alles mehrfach?  
  `Dein Netzwerk lädt das alles mehrfach?`
- **problem** (intro) Warum soll jeder Rechner dieselben Pakete aus dem Internet laden?  
  `Warum soll jeder Rechner dieselben Pakete aus dem Internet laden?`
- **solution** (product) Cache & Carry speichert sie zentral in deinem Netzwerk.  
  `Käsch and Kärri speichert sie zentral in deinem Netzwerk.`
- **solution** (product) Einmal herunterladen. Danach lokal nutzen.  
  `Einmal herunterladen. Danach lokal nutzen.`
- **end** (cta) Dein eigener LAN-Cache. Open Source und kostenlos auf GitHub.  
  `Dein eigener Lan-Käsch. [[ˈoːpən zˈɔːɐs]] und kostenlos auf Gitt-Hab.`

## short02

- **hook** (product) Zwei Wörter. Ein ganzes Netzwerk schneller.  
  `Zwei Wörter. Ein ganzes Netzwerk schneller.`
- **miss** (tech) MISS. Das bedeutet: Das Paket muss noch aus dem Internet kommen.  
  `Miss. Das bedeutet: Das Paket muss noch aus dem Internet kommen.`
- **hit** (tech) HIT. Das bedeutet: Es liegt bereits in deinem Cache.  
  `Hitt. Das bedeutet: Es liegt bereits in deinem Käsch.`
- **hit** (tech) Und genau das macht Cache & Carry so praktisch.  
  `Und genau das macht Käsch and Kärri so praktisch.`
- **end** (cta) Probier es selbst. Open Source auf GitHub.  
  `Probier es selbst. [[ˈoːpən zˈɔːɐs]] auf Gitt-Hab.`

## short03

- **hook** (product) Neunhundertneunundfünfzig Millisekunden. Neun Millisekunden. Was ist passiert?  
  `Neunhundertneunundfünfzig Millisekunden. Neun Millisekunden. Was ist passiert?`
- **compare** (tech) Im dokumentierten Testnetzwerk brauchte ein Paketindex mit acht Komma sechs Mebibyte neunhundertneunundfünfzig Millisekunden aus dem Internet.  
  `Im dokumentierten Testnetzwerk brauchte ein Paketindex mit acht Komma sechs [[mˈeːbibaɪt]] neunhundertneunundfünfzig Millisekunden aus dem Internet.`
- **compare** (tech) Aus dem Cache waren es nur neun.  
  `Aus dem Käsch waren es nur neun.`
- **end** (cta) Genau dafür gibt es Cache & Carry. Mehr dazu auf GitHub.  
  `Genau dafür gibt es Käsch and Kärri. Mehr dazu auf Gitt-Hab.`

## short04

- **hook** (product) Zehn Rechner. Dieselbe Datei. Nur ein Download.  
  `Zehn Rechner. Dieselbe Datei. Nur ein Daunlohd.`
- **demo** (tech) Wenn mehrere Rechner gleichzeitig dieselbe Datei anfordern, die noch nicht im Cache liegt,  
  `Wenn mehrere Rechner gleichzeitig dieselbe Datei anfordern, die noch nicht im Käsch liegt,`
- **demo** (tech) muss Cache & Carry sie nicht zehnmal aus dem Internet laden.  
  `muss Käsch and Kärri sie nicht zehnmal aus dem Internet laden.`
- **demo** (tech) Ein einziger Download aus dem Internet versorgt alle wartenden Rechner.  
  `Ein einziger Daunlohd aus dem Internet versorgt alle wartenden Rechner.`
- **end** (cta) Für dein Homelab. Open Source auf GitHub.  
  `Für dein [[hˈoːmlɛp]]. [[ˈoːpən zˈɔːɐs]] auf Gitt-Hab.`

## short05

- **hook** (intro) Und was kostet das?  
  `Und was kostet das?`
- **free** (product) Die Software? Kostenlos auf GitHub.  
  `Die Software? Kostenlos auf Gitt-Hab.`
- **free** (product) Open Source unter Apache zwei Punkt null.  
  `[[ˈoːpən zˈɔːɐs]] unter Apätschi zwei Punkt null.`
- **control** (product) Du betreibst sie selbst in deinem Netzwerk und behältst die Kontrolle.  
  `Du betreibst sie selbst in deinem Netzwerk und behältst die Kontrolle.`
- **control** (product) Nur Hardware und Strom für deinen Server bringst du selbst mit.  
  `Nur Hardware und Strom für deinen Server bringst du selbst mit.`
- **end** (cta) Gib dem Repository einen Stern und probier es aus.  
  `Gib dem Repository einen Stern und probier es aus.`

