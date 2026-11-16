# FC Topoľčany – návrh webu

Návrh nového webu futbalového klubu FC Topoľčany (FC Topoľčany o.z., prezývka Žochári). **Nie je to oficiálna stránka klubu.** Ukážka má v hlavičke pás s týmto upozornením a vyhľadávače ju neindexujú (`noindex`).

Ukážka: https://matuslenicky.github.io/fc-topolcany/ · administrácia (ukážka bez ukladania): https://matuslenicky.github.io/fc-topolcany/admin/

## Vzhľad

Farby z erbu: zlatý štít s bielou linkou, červené pole a biely pätkový monogram TFC. **Zlatý lem štítu** rámuje fotky aj zápasovú dosku (bordové pole so zlatou linkou). **Červeno-biele šikmé pruhy** a nápis **„My sme tu doma“** sú prevzaté z maľby na stene štadióna. **Vitrína** ukazuje mládežnícke tituly ZsFZ ako zlaté plakety na bordovom podklade. Písmo Bitter (pätkové, ako monogram v erbe) a Hanken Grotesk. Na počítači je menu v riadku vedľa erbu, na telefóne sa otvorí bordový panel cez celú obrazovku. Na úvode je fotka cez celú šírku a pod ňou široká zápasová doska so záložkami všetkých tímov.

## Obsah a zdroje

- Zápasy, výsledky, strelci, karty, počty divákov, zostavy dospelých, tabuľky a súpisky 13 tímov zo Sportnetu (Futbalnet), verejné API súťaží (`scripts/sportnet.mjs` → `data/sportnet.json`). Vek hráčov sa neukladá, zostavy len pri dospelých.
- Údaje o klube v `data/klub.json`, každá časť s uvedeným zdrojom: vznik klubu, mládež, nábor, členské príspevky, tituly mládeže, fan zóna, partneri a kontakty z doterajšieho webu klubu fcto.sk. Rok 1912 z RSSSF a Wikipédie, FC Žochári z ČeTV Topoľčany (2018), spartakiáda 1985 zo SITA (2013), III. liga 2011/12 z archívu webu mfktopolcany.sk. Štadión: kapacita, sedadlá, rozmery a poloha zo Sportnetu, plochy zo zmluvy o využívaní štadióna v Centrálnom registri zmlúv.
- Fotky z webu klubu fcto.sk (`scripts/photos.py`, výber v `data/foto.json`; originály v `media/` nie sú v repozitári).
- Erb FC Topoľčany a erby súperov zo Sportnetu (`scripts/logos.py`). Patria príslušným klubom. Instagram klub nemá, odkazuje sa na Facebook.
- Písmo Bitter a Hanken Grotesk, licencia SIL Open Font License 1.1 (`scripts/fonts.py`).

## Zostavenie

Statický generátor bez závislostí (Node 20+, Python 3 s Pillow na erby a fotky):

```
node scripts/sportnet.mjs        # zápasy, tabuľky a súpisky (FULL=1 stiahne znova aj detaily zápasov)
python -I scripts/logos.py       # erby súperov a náš erb do src/img (FORCE=1 stiahne znova)
python -I scripts/photos.py      # fotky z media/fcto podľa data/foto.json do src/img/foto
node build.js                    # data/ + src/ -> dist/ (TODAY=2026-11-16 prepíše dnešný dátum)
node scripts/serve.mjs dist 5320 # náhľad na http://127.0.0.1:5320/
node scripts/deploy.mjs          # nasadenie dist/ na vetvu gh-pages (GitHub Pages)
```

Výsledky sa po zápasoch aktualizujú samé cez GitHub Actions (`.github/workflows/sportnet.yml`).
