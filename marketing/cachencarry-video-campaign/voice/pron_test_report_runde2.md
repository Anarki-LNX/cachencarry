# Aussprachetest

Stimme `tools/voices/de_DE-thorsten-high.onnx`, whisper small. Je Kandidat drei Trägersätze.

| Begriff | Kandidat | erkannt | gehört (falsche) |
|---|---|---|---|
| Client | `Kleient` | 1/3 | Das ist Klient. / Mit Klient geht es schneller. |
| Client | `Klaient` | 1/3 | Wir nutzen Klient jeden Tag. / Mit Klient geht es schneller. |
| Client | `[[klˈaɪɛnt]]` | 1/3 | Das ist Kleint. / Wir nutzen Kleint jeden Tag. |
| Client | `[[klˈaɪənt]]` | 0/3 | Das ist Kleint. / Wir nutzen Kleint jeden Tag. / Mit Kleint geht es schneller. |
| HIT | `Hit` | 0/3 | Das ist heat. / Wir nutzen hier jeden Tag. / Mit Heat geht es schneller. |
| HIT | `[[hˈɪtː]]` | 1/3 | Das ist tit. / Wir nutzen hier jeden Tag. |
| HIT | `Hitt` | 2/3 | Das ist tit. |
| MISS | `Mis` | 0/3 | Das ist mies. / benutzen wir es jeden Tag. / Mit mies geht es schneller. |
| MISS | `[[mˈɪsː]]` | 2/3 | Wir nutzen es jeden Tag. |
| MISS | `Miss` | 2/3 | Wir nutzen bis jeden Tag. |
| Apache | `Ä-Pätschi` | 0/3 | Das ist Epechi. / Wir nutzen eCatchy jeden Tag. / Mit ePatchy geht es schneller. |
| Apache | `Apätschi` | 2/3 | Das ist der Patchy. |
| Apache | `[[əpˈætʃi]]` | 1/3 | Das ist der Perchi. / Mit der Patsche geht es schneller. |
| Apache | `[[ʔɛpˈɛtʃi]]` | 0/3 | Das ist der Patchy. / Wir nutzen der Patchy jeden Tag. / Mit der Patchie geht es schneller. |
| Setup-Token | `Settap-Token` | 0/3 | Das ist ZTAP-Token. / Wir nutzen die Tap-Token jeden Tag. / Mit Zapptoken geht es schneller. |
| Setup-Token | `Sett-App Token` | 1/3 | Das ist Z-Tab-Token. / Mit ZHAP Token geht es schneller. |
| Setup-Token | `[[sˈɛtʔap tˈoːkən]]` | 1/3 | Wir nutzen Z-Gap-Token jeden Tag. / Mit Zapptoken geht es schneller. |
| Healthcheck | `Hälts-Tschek` | 0/3 | Das ist hellst schick. / Wir nutzen Hell's Shake jeden Tag. / Mit Helz-Shake geht es schneller. |
| Healthcheck | `Helfs Tscheck` | 1/3 | Das ist Hilfscheck. / Mit Helfs Check geht es schneller. |
| Healthcheck | `[[hˈɛls tʃˈɛk]]` | 2/3 | Das ist Hilfscheck. |
| Healthcheck | `[[hˈɛlθtʃɛk]]` | 3/3 |  |
| Header | `Hädder` | 0/3 | Das ist Tegel. / wir nutzen hätte jeden tag / Die Mitte hat ja geht es schneller. |
| Header | `Hedda` | 1/3 | Das ist teuer. / Mit Heda geht es schneller. |
| Header | `[[hˈɛːdɐ]]` | 0/3 | Das ist Tater. / Wir nutzen Hede jeden Tag. / Mit Held geht es schneller. |
| root | `Ruut` | 0/3 | Das ist gut. / Wir nutzen Ruth jeden Tag. / Mit Ruhr geht es schneller. |
| root | `Ruht-Benutzer` | 0/3 | Das ist gut benutzt. / Wir nutzen Rotbenutzer jeden Tag. / Mit Rot-Nutzer geht es schneller. |
| root | `[[ʁˈuːt]]` | 0/3 | Das ist tut. / Wir nutzen Mut jeden Tag. / Mit Ud geht es schneller. |
| Signed-By | `Seind Bai` | 0/3 | Das ist sein Bye. / Wir nutzen sein bei jeden Tag. / Mit seinen Ball geht es schneller. |
| Signed-By | `Sainnd-Bai` | 0/3 | Das ist sein Bye. / Wir nutzen sein Bei jeden Tag. / Mit Sein bei geht es schneller. |
| Signed-By | `[[zˈaɪnt bˈaɪ]]` | 0/3 | Das ist sein Bye. / Wir nutzen sein Bei jeden Tag. / Mitseiten bei geht es schneller. |
| Mirrorlist | `Mirror-List` | 0/3 | Das ist nur Ruhrlist. / Wir nutzen gerolligt jeden Tag. / Mit Mirolist geht es schneller. |
| Mirrorlist | `Mirrorlist` | 0/3 | Das ist ein Rollist. / Wir nutzen ein Rollest jeden Tag. / Mit No-Roll ist geht es schneller. |
| Mirrorlist | `[[mˈɪʁɔːɐ lˈɪst]]` | 0/3 | Das ist mir eulist. / Wir nutzen die Eurlist jeden Tag. / Mit Miol ist geht es schneller. |
| Mirrorlist | `Mirrer-List` | 0/3 | Das ist mir alles. / Wir nutzen mehr Relist jeden Tag. / Mit mehr Realist geht es schneller. |
| Nesting | `Nessting` | 0/3 | Das ist Misting. / Wir nutzen das Ding jeden Tag. / Mit Nest, den geht es schneller. |
| Nesting | `[[nˈɛstɪŋk]]` | 0/3 | Das ist Misting. / Wir nutzen das Ding jeden Tag. / Mit nearest sink geht es schneller. |
| Nesting | `Nesting` | 1/3 | Das ist nistig. / Wir nutzen das Ding jeden Tag. |
| sudo | `Suudu` | 0/3 | Das ist zu du. / Wir nutzen Zubu jeden Tag. / Mit zu, du geht es schneller. |
| sudo | `Sudu` | 1/3 | Das ist Zubu. / Mit zu, du geht es schneller. |
| sudo | `[[sˈuːduː]]` | 0/3 | Das ist Zuboop. / Wir nutzen Zuge jeden Tag. / Mit Zulu geht es schneller. |
| LAN | `Län` | 0/3 | Das ist Lin. / benutzen lehnen jeden tag / Mit Lehen geht es schneller. |
| LAN | `Lään` | 0/3 | Das ist Dean. / wir nutzen lehen jeden tag / Mit Legen geht es schneller. |
| LAN | `L A N` | 0/3 | Das ist LA-eng. / Wir nutzen LA N jeden Tag. / Mit LA ein geht es schneller. |
| systemctl | `System C-T-L` | 1/3 | Das ist Team CTL. / Mit dem CTL geht es schneller. |
| systemctl | `Sistem C T L` | 1/3 | Das ist ein CTL. / Wir nutzen Sesten CTL jeden Tag. |
| systemctl | `System-Ce-Te-El` | 0/3 | Das ist Stimketil. / Wir nutzen das System KTII jeden Tag. / Mit Stinketeil geht es schneller. |
| Download | `Daunlohd` | 3/3 |  |
| Download | `[[dˈaʊnloːt]]` | 3/3 |  |
| Download | `Download` | 2/3 | Das ist Dominoad. |
