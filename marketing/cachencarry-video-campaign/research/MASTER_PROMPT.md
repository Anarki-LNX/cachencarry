# Master prompt (verbatim from the user, 2026-11-26)

This is the user's request for the campaign, copied unchanged. It is the
authoritative brief.

---

ULTIMATE MASTER PROMPT — CACHE & CARRY
Complete Video Marketing Campaign
1 Main Presentation Video + 1 Installation Tutorial + 5 Viral Shorts
Project: Cache & Carry
GitHub: https://github.com/Anarki-LNX/cachencarry
YOUR ROLE
You are an elite creative director, technology filmmaker, motion graphics artist, Linux infrastructure expert, technical educator, professional video editor, and social media content strategist.
You are responsible for creating a complete, professional video campaign for the open-source project Cache & Carry.
Your output must look like a high-end technology brand campaign, not like a typical amateur Linux tutorial.
You must inspect the real repository, understand the actual software, capture the real interface, demonstrate its real capabilities, and produce all requested videos.
Do not just create a plan.
Execute the complete production process wherever the available local environment allows it.
1. PROJECT UNDERSTANDING — REPOSITORY FIRST
Repository:
https://github.com/Anarki-LNX/cachencarry
Start by examining the complete repository and, if available, its local checkout.
Read and inspect:

* README.md
* ARCHITECTURE.md
* DEPLOYMENT.md
* ADAPTERS.md
* TODO.md
* ROADMAP.md
* SECURITY.md
* CONTRIBUTING.md
* NOTICE.md
* Dockerfile
* docker-compose.yml
* Makefile
* Go source code
* Web dashboard source code
* Configuration examples
* Existing screenshots and branding
* Existing marketing assets
* Installation scripts
* Tests and release information

Understand exactly how Cache & Carry works.
The repository is the source of truth.
Do not invent features or demonstrate functionality that does not exist.
Verified product positioning
Cache & Carry is a self-hosted LAN package cache for home labs and office networks.
Its core idea:
Download once. Carry out as often as you like.
A computer downloads a package from the internet. Cache & Carry stores it. Other computers on the same network can retrieve the same package from the local cache.
The project provides:

* A shared package cache for a local network
* Pacman support for Arch Linux and CachyOS
* APT support for Debian, Ubuntu and supported Debian-based environments
* One dashboard for monitoring requests and stored packages
* Live HIT and MISS visibility
* Shared downloads for simultaneous requests
* Content-addressed storage using SHA-256
* Cache size and bandwidth controls
* Package pinning and removal
* Integrity verification
* Persistent storage
* Download resumption
* Mirror fallback
* Statistics based on actual transferred bytes
* A lightweight server architecture
* Systemd deployment
* Docker Compose deployment
* Proxmox deployment options
* German and English dashboard language support

Verify the current status of every feature against the repository before showing it.
IMPORTANT:
Pacman and APT are the currently supported ecosystems.
Plain HTTP file-server support is experimental.
Docker/Podman image caching, npm, PyPI, RPM and Maven are planned, not current production features.
Game downloads and Windows updates are future integrations, not implemented product features.
Never present planned or experimental functionality as finished.
Core product message
Cache & Carry is your network's package warehouse.
Instead of every Linux machine downloading the same package separately, your network can reuse a local copy.
No unnecessary repetition.
No complicated enterprise infrastructure.
One small server. One cache. One dashboard.
Open source. Self-hosted. Available for free on GitHub under Apache License 2.0.
Be precise: the software is free to download and use under its license. Hardware, electricity, storage, network equipment, and any optional infrastructure can still have costs.
2. BRAND AND CREATIVE DIRECTION
Create a recognizable visual identity for the entire campaign.
Style:

* Premium Linux and homelab technology aesthetic
* Dark graphite and deep navy backgrounds
* Subtle electric cyan highlights
* White typography
* Controlled green accents for cache HIT events
* Warm amber/orange accents for cache MISS events
* Sophisticated network visualizations
* Clean dashboard close-ups
* Beautifully animated data flows
* Cinematic camera movements
* Sharp, modern typography
* Smooth, purposeful transitions

Use the authentic Cache & Carry logo and existing brand assets from:
`assets/brand/`
Inspect all available branding files before designing anything.
Preserve the real logo and product identity.
Do not replace the real dashboard with a fake futuristic interface.
The real software must always be recognizable.
Enhance real screenshots and recordings with motion graphics, camera movement, overlays, lighting, and tasteful visual effects.
3. LANGUAGE REQUIREMENTS
All videos must be primarily in German.
Voice-over: German.
On-screen headlines: German.
Explanations: German.
Tutorial instructions: German.
Calls to action: German.
Additionally:
Create subtle English subtitles for every spoken sentence.
Subtitle styling:

* Smaller than the German main text
* Elegant white or light-grey typography
* Slightly reduced opacity
* Positioned directly beneath the German subtitle or in a carefully chosen subtitle area
* No distracting boxes
* No excessive outlines
* Perfect synchronization
* Easy to read on mobile screens

The German language is the main experience.
English subtitles are a secondary accessibility and international reach feature.
Create separate German subtitle and English subtitle files.
4. COMPLETE VIDEO CAMPAIGN
Produce exactly seven finished videos:

1. Main product presentation video — approximately 90 to 120 seconds
2. Installation tutorial — approximately 4 to 7 minutes
3. Short #1 — The repeated download problem
4. Short #2 — HIT vs. MISS
5. Short #3 — The speed comparison
6. Short #4 — One download for everyone
7. Short #5 — Free and open source

The five Shorts should each have their own hook, narrative, and ending.
They must not simply be five cropped fragments of the main video.
Each Short must work independently.
VIDEO 1 — THE MAIN PRODUCT PRESENTATION
"DEIN NETZWERK LÄDT DAS NICHT MEHR DOPPELT HERUNTER."
Duration: 90–120 seconds.
Formats:

* YouTube: 1920 × 1080, 16:9
* Optional vertical adaptation: 1080 × 1920, 9:16

Goal:
Explain the problem, introduce Cache & Carry, demonstrate the product, show its benefits, and encourage people to try it.
Storyboard
SCENE 1 — THE PROBLEM (0:00–0:12)
Dark screen.
A Linux terminal appears.
A package download begins.
Cut to a second Linux machine.
The same package starts downloading again.
Cut to a third machine.
Again, the same download.
The internet connection is being used repeatedly.
Cinematic sound design.
German voice-over:
"Kennst du das? Drei Linux-Rechner im Netzwerk. Drei Updates. Und dieselben Pakete werden immer wieder aus dem Internet geladen."
On-screen headline:
"IMMER WIEDER DIESELBEN DOWNLOADS?"
SCENE 2 — THE IDEA (0:12–0:25)
The three machines appear in a clean network visualization.
A central server lights up.
The repeated download paths disappear.
One download flows into the central cache.
The other machines receive the package from the local network.
Voice-over:
"Was wäre, wenn dein Netzwerk ein eigenes Paketlager hätte? Einmal herunterladen. Lokal speichern. Immer wieder verwenden."
On-screen headline:
"DOWNLOAD ONCE. USE EVERYWHERE."
SCENE 3 — MEET CACHE & CARRY (0:25–0:40)
Reveal the authentic Cache & Carry logo.
Show the actual dashboard.
Use a cinematic camera push into the real interface.
Show:

* Live request activity
* HIT and MISS indicators
* Stored packages
* Cache statistics
* Configuration controls

Voice-over:
"Das ist Cache & Carry. Ein schlanker, selbst gehosteter Paket-Cache für dein Netzwerk."
SCENE 4 — THE MAGIC: HIT AND MISS (0:40–0:57)
Show a real request arriving at the system.
A cache MISS appears.
The package is fetched from the configured upstream mirror and stored.
A second request arrives.
Now a cache HIT.
The package is delivered from local storage.
Use an elegant animation:
MISS → INTERNET → LOCAL CACHE → HIT → CLIENT
Voice-over:
"Beim ersten Abruf kommt das Paket vom Mirror. Danach liegt es im Cache. Der nächste Rechner bekommt es direkt aus deinem Netzwerk."
On-screen text:
"MISS = UPSTREAM DOWNLOAD"
"HIT = LOCAL CACHE"
Use actual dashboard recordings and real request events.
SCENE 5 — PERFORMANCE AND SHARED DOWNLOADS (0:57–1:12)
Show two or more clients requesting the same uncached file.
Visualize one upstream download feeding multiple waiting clients.
Show the actual concurrency behavior.
Present the documented test result:
"8,6 MiB: 959 ms aus dem Internet. 9 ms aus dem Cache."
Clearly label:
"BEISPIEL AUS DEM TESTNETZWERK"
Do not present this as a universal benchmark.
Voice-over:
"Und wenn mehrere Rechner gleichzeitig dieselbe Datei brauchen, kann ein einziger Upstream-Download alle versorgen."
SCENE 6 — MADE FOR YOUR HOMELAB (1:12–1:28)
Show:

* Proxmox environment
* Debian/Ubuntu installation context
* Arch Linux or CachyOS client configuration
* Dashboard
* Systemd or Docker Compose deployment where appropriate

Voice-over:
"Ob Proxmox, Debian, Ubuntu, Arch oder CachyOS: Cache & Carry bringt deine unterstützten Paketquellen unter ein gemeinsames Dach."
Only show deployment paths and client configurations that are actually documented and supported.
SCENE 7 — OPEN SOURCE AND CALL TO ACTION (1:28–1:45)
Show the logo.
Show the GitHub repository.
Show the Apache 2.0 license reference.
Voice-over:
"Cache & Carry ist kostenlos auf GitHub verfügbar, Open Source und bereit für dein Homelab."
Final text:
"CACHE & CARRY"
"DEIN NETZWERK. DEIN PAKETLAGER."
"JETZT AUF GITHUB ENTDECKEN"
"STAR • FORK • TRY IT"
German voice-over:
"Wenn du es ausprobierst, lass einen Stern da, teile das Projekt und sag mir in den Kommentaren, wie du es einsetzt."
End with a premium logo animation.
VIDEO 2 — INSTALLATION TUTORIAL
"CACHE & CARRY INSTALLIEREN — VOM LEEREN SERVER ZUM EIGENEN LAN-CACHE"
Duration: approximately 4–7 minutes.
This must be a genuinely useful, technically correct tutorial.
The viewer should be able to follow it without guessing.
Use a clean screen recording of the actual installation.
Speak clearly and explain every important step in German.
Use subtle English subtitles.
Important tutorial rule
Do not combine multiple installation methods into one confusing sequence.
Choose one primary installation path for the tutorial:
Preferred primary path:
Debian/Ubuntu or Proxmox LXC using the official release archive and installation script.
Verify that the current repository release supports the chosen architecture and operating system.
If the latest release is unavailable or cannot be verified, use the documented Docker Compose path instead and clearly explain the prerequisites.
Optionally create a short bonus chapter showing the alternative installation method.
Tutorial structure
Chapter 1 — What are we building?
Explain:

* What Cache & Carry does
* What a LAN cache is
* Which clients are supported
* What hardware/resources are recommended
* What the tutorial will accomplish

Show a simple network diagram.
Chapter 2 — Prepare the server
Show the actual environment.
Explain:

* Debian/Ubuntu or Proxmox LXC
* Network connectivity
* Server IP address
* Architecture, for example amd64 or arm64
* Storage location
* Necessary privileges

Do not invent hardware requirements.
Use the current documentation.
Chapter 3 — Download and install
Use the verified official release.
Show the actual commands from the repository documentation.
The documented release workflow includes:

```
tar xzf cachencarry-*-linux-amd64.tar.gz
cd cachencarry-*-linux-amd64
sudo ./scripts/install.sh
```

Verify the actual archive name and architecture before recording.
Explain what the installation script does.
Show the service installation and verify its status using the actual systemd service name from the project.
Never guess a service name.
Chapter 4 — Initial setup
Open the actual dashboard:
`http://SERVER-IP:8080`
Explain the first-run account creation.
Show how the one-time setup token is generated.
The documented workflow includes:

```
su -s /bin/sh cachencarry -c '/usr/local/bin/cachencarry setup-token'
```

Verify the command and service user against the actual installed version.
Never show a real password or secret in the video.
Use a disposable test environment.
Chapter 5 — Configure the first client
Show a real Linux client.
Demonstrate one supported client configuration.
Preferred examples:

* Arch Linux / CachyOS with Pacman
* Debian / Ubuntu with APT

Use the official current configuration instructions from:
`docs/CLIENTS.md`
Do not simplify commands in a way that breaks the configuration.
Explain the meaning of the server address and repository URL.
Keep existing package signature verification intact.
Never disable signature verification for demonstration purposes.
Chapter 6 — Test the cache
Run an actual package request.
Show:

* First request
* MISS event
* Stored file
* Second request
* HIT event

Use the dashboard to demonstrate the difference.
If possible, repeat the request from a second client.
Show the actual transfer statistics.
Explain that the first request may need to reach the configured upstream mirror.
Chapter 7 — Final result
Show the working dashboard.
Explain where the user can find:

* Configuration
* Statistics
* Stored packages
* Cache limits
* Client instructions
* Documentation

Finish with:
"Und das war's. Dein eigenes Paketlager im Netzwerk."
CTA:
"Den vollständigen Quellcode findest du kostenlos auf GitHub. Wenn dir Cache & Carry gefällt, lass gerne einen Stern da."
Tutorial quality requirements

* Use zooms to make terminal commands readable.
* Highlight important command sections.
* Do not rush terminal output.
* Do not hide errors.
* If an installation step fails, investigate and correct it before recording the final tutorial.
* Do not show credentials.
* Do not use fake terminal output.
* Use real screenshots and recordings.
* Include chapters and timestamps in the YouTube description.
* Include a complete list of commands in a separate text file.

VIDEO 3 — SHORT #1
"WARUM LÄDT JEDER RECHNER DAS GLEICHE UPDATE?"
Duration: 20–30 seconds.
Format: 1080 × 1920, 9:16.
Hook in the first two seconds:
"DEIN NETZWERK LÄDT DAS ALLES MEHRFACH?"
Scene:
Three Linux machines.
All three download the same package.
A central Cache & Carry server appears.
The download happens once.
The other clients receive the package locally.
German voice-over:
"Warum soll jeder Rechner dieselben Pakete aus dem Internet laden? Cache & Carry speichert sie zentral in deinem Netzwerk. Einmal herunterladen. Danach lokal nutzen."
Final text:
"DEIN EIGENER LAN-CACHE"
"OPEN SOURCE • KOSTENLOS AUF GITHUB"
CTA:
"LINK IN DER BESCHREIBUNG"
Make the transition visually satisfying and immediately understandable.
VIDEO 4 — SHORT #2
"HIT ODER MISS? DAS IST DER UNTERSCHIED."
Duration: 20–30 seconds.
Hook:
"ZWEI WÖRTER. EIN GANZES NETZWERK SCHNELLER."
Show the actual dashboard.
First request:
MISS.
Show the upstream download.
Second request:
HIT.
Show the local delivery.
German voice-over:
"MISS bedeutet: Das Paket muss noch vom Mirror kommen. HIT bedeutet: Es liegt bereits in deinem Cache. Und genau das macht Cache & Carry so praktisch."
On-screen:
"MISS = AUS DEM INTERNET"
"HIT = AUS DEINEM CACHE"
Final:
"PROBIER ES SELBST."
CTA:
"OPEN SOURCE AUF GITHUB"
Use real dashboard indicators.
VIDEO 5 — SHORT #3
"959 MILLISEKUNDEN VS. 9 MILLISEKUNDEN"
Duration: 20–30 seconds.
Hook:
"959 MILLISEKUNDEN. 9 MILLISEKUNDEN. WAS IST PASSIERT?"
Show a clean split-screen comparison.
Left:
Internet request.
959 ms.
Right:
Local cache.
9 ms.
Show the actual package index example.
Important:
Label this result clearly as a measurement from the documented test network.
On-screen disclaimer:
"8,6 MiB • TESTNETZWERK • KEIN GARANTIEWERT"
German voice-over:
"Im dokumentierten Testnetzwerk brauchte ein 8,6-MiB-Paketindex 959 Millisekunden aus dem Internet. Aus dem Cache waren es nur 9. Genau dafür gibt es Cache & Carry."
CTA:
"MEHR IM GITHUB-REPOSITORY"
Do not claim every package or every network will achieve these values.
VIDEO 6 — SHORT #4
"EIN DOWNLOAD. MEHRERE CLIENTS."
Duration: 20–30 seconds.
Hook:
"ZEHN RECHNER. DIESELBE DATEI. NUR EIN UPSTREAM-DOWNLOAD."
Show multiple clients requesting the same uncached file.
Animate a single download entering the Cache & Carry server.
From there, multiple local streams reach the clients.
German voice-over:
"Wenn mehrere Clients gleichzeitig dieselbe uncached Datei anfordern, muss Cache & Carry nicht zehnmal dieselbe Datei aus dem Internet laden. Ein Upstream-Download kann alle wartenden Clients versorgen."
On-screen:
"ONE DOWNLOAD"
"MULTIPLE CLIENTS"
"LOCAL DELIVERY"
CTA:
"FÜR DEIN HOMELAB"
Only show this behavior after verifying it with a real test or documented implementation.
VIDEO 7 — SHORT #5
"DEIN EIGENER PAKET-CACHE. OPEN SOURCE."
Duration: 20–30 seconds.
Hook:
"UND WAS KOSTET DAS?"
Short pause.
Show the Cache & Carry logo.
German voice-over:
"Die Software? Kostenlos auf GitHub verfügbar. Open Source unter Apache 2.0. Du betreibst sie selbst in deinem Netzwerk und behältst die Kontrolle."
Show:

* GitHub repository
* Apache 2.0 license
* Real dashboard
* Proxmox or server environment
* Linux clients

On-screen:
"FREE & OPEN SOURCE"
"SELF-HOSTED"
"APACHE 2.0"
"YOUR NETWORK. YOUR CACHE."
CTA:
"STAR DAS REPOSITORY UND PROBIER ES AUS."
Do not imply that hosting has no hardware, electricity, or infrastructure costs.
5. VISUAL STORYTELLING AND MOTION DESIGN
The campaign must have one consistent visual identity.
Create a motion graphics package with:

* Animated network topology
* Package download paths
* Client/server visualizations
* Cache HIT and MISS animations
* Data transfer particles
* Speed comparison animations
* Dashboard highlights
* Logo reveal
* GitHub call-to-action sequence

Use real product screenshots as the foundation.
Avoid generic stock imagery.
Avoid random code scrolling.
Avoid fake terminal windows.
Avoid fake dashboards.
Avoid excessive visual effects that make the software difficult to understand.
The best visual moments should explain the product in less than three seconds.
6. AUDIO AND MUSIC
Main presentation:
Premium electronic technology soundtrack.
Installation tutorial:
Quiet, unobtrusive background music.
Shorts:
Fast, energetic, carefully mixed electronic beats.
Use original music or properly licensed free music.
Do not use copyrighted commercial music without permission.
Sound design:

* Subtle keyboard sounds
* Network data pulses
* Package download effects
* Cache HIT confirmation
* Elegant transition impacts
* Subtle logo reveal

German voice-over:

* Clear pronunciation
* Confident
* Natural
* Friendly
* Technically competent
* No exaggerated advertising voice

The tutorial should sound like an experienced Linux administrator explaining something useful to the community.
7. SOFTWARE AND PRODUCTION ENVIRONMENT
Inspect the existing environment before installing tools.
Prefer free/open-source software.
Possible tools:

* Remotion
* FFmpeg
* Playwright
* Blender
* OBS Studio
* Audacity
* GIMP
* Inkscape

Use the tools that actually make sense.
Check licenses and compatibility before installation.
Do not install unnecessary software.
Do not modify the Cache & Carry application source just to create marketing content.
Create a separate workspace:
`./marketing/cachencarry-video-campaign/`
Suggested structure:

```
marketing/cachencarry-video-campaign/
├── research/
├── assets/
│   ├── logos/
│   ├── screenshots/
│   ├── recordings/
│   ├── audio/
│   └── graphics/
├── project/
├── subtitles/
│   ├── de/
│   └── en/
├── scripts/
├── thumbnails/
├── social/
├── tutorial/
└── final/
```

Keep source footage and project files.
Make the entire production reproducible.
8. SUBTITLES
Every video needs:

* German subtitles
* English subtitles
* German burned-in subtitle version
* English subtitle sidecar file

Use:

* `video_name_de.srt`
* `video_name_en.srt`

The German subtitles should be visually primary.
English subtitles should be subtle and secondary.
Check all translations manually.
Do not translate technical terms incorrectly.
Keep terms such as Pacman, APT, Cache HIT, Cache MISS, Proxmox and LAN Cache understandable.
9. THUMBNAILS AND SOCIAL ASSETS
Create:
Main video thumbnail
Headline:
"DEIN NETZWERK BRAUCHT EINEN CACHE!"
Visual:

* Central Cache & Carry server
* Multiple Linux clients
* Cyan network connections
* Authentic logo

Installation thumbnail
Headline:
"CACHE & CARRY INSTALLIEREN"
Visual:

* Real dashboard
* Terminal window
* Server icon

Five Shorts covers
Create five matching vertical cover designs.
Each must have:

* Large readable German headline
* Consistent brand identity
* Strong contrast
* Realistic product imagery
* No excessive text

10. SOCIAL MEDIA COPY
Write a German YouTube description for the main video.
Include:

* Short product explanation
* GitHub repository link
* Apache 2.0 license information
* Supported ecosystems
* Installation documentation
* Clear call to action

Write a separate installation tutorial description with chapter timestamps.
Create individual descriptions for all five Shorts.
Suggested hashtag themes:
#CacheAndCarry
#Linux
#Homelab
#Proxmox
#SelfHosting
#OpenSource
#ArchLinux
#Debian
#Ubuntu
#CachyOS
#LinuxServer
#SelfHosted
Use relevant hashtags rather than stuffing every description with hashtags.
Create a pinned comment:
"Welche Linux-Systeme laufen bei dir im Netzwerk? Und würdest du einen eigenen Paket-Cache einsetzen? Schreib es in die Kommentare und probiere Cache & Carry auf GitHub aus!"
Encourage genuine discussion.
Do not use fake engagement, bots, artificial comments, or misleading claims.
11. QUALITY CONTROL
Every video must be reviewed from beginning to end.
Check:

* Correct German spelling
* Correct English subtitles
* Subtitle timing
* Correct project name
* Authentic logo
* Real dashboard
* Accurate technical information
* Correct installation commands
* No exposed passwords or tokens
* Correct benchmark context
* Correct feature status
* No invented capabilities
* Audio quality
* Video quality
* Aspect ratio
* Mobile readability
* CTA visibility

The tutorial must be tested against a clean test installation.
Do not claim that an installation works unless it has actually been tested or clearly mark any unverified step.
Render the videos, review them, fix problems, and render the final versions again.
12. FINAL DELIVERABLES
Save all finished files in:
`./marketing/cachencarry-video-campaign/final/`
Required video files:

```
cachencarry_presentation_16x9.mp4
cachencarry_installation_tutorial.mp4

cachencarry_short_01_problem.mp4
cachencarry_short_02_hit_vs_miss.mp4
cachencarry_short_03_speed.mp4
cachencarry_short_04_shared_download.mp4
cachencarry_short_05_open_source.mp4
```

Also deliver:

* Main video clean version
* All German subtitle files
* All English subtitle files
* Main thumbnail
* Tutorial thumbnail
* Five Shorts covers
* German YouTube descriptions
* German Shorts descriptions
* Pinned comment
* Installation command reference
* Production documentation
* Asset and license sources
* Reusable Remotion project
* README with instructions to reproduce and update the campaign

13. FINAL CREATIVE DIRECTION
The audience should understand the product without having to read the documentation.
The central message is:
Why download the same package again and again when your network can cache it once?
Make Cache & Carry feel like a smart, practical tool that belongs in every serious Linux homelab.
The main presentation should make people curious.
The installation tutorial should make them confident.
The five Shorts should make them stop scrolling, understand one useful idea, and discover the project.
The final campaign should communicate:
CACHE & CARRY
DOWNLOAD ONCE. CARRY OUT AS OFTEN AS YOU LIKE.
FREE. OPEN SOURCE. SELF-HOSTED.
GitHub:
https://github.com/Anarki-LNX/cachencarry
Now inspect the repository, verify the features, prepare the production environment, record the real application, create all seven videos, render them, review them, and deliver the complete campaign.
Do not stop at a storyboard or a rough prototype.
Deliver finished, publishable video assets.
