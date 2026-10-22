# Tabula Hungariae

*Magyarország története térképen*

Interaktív történelmi atlasz: Magyarország határai 16 fordulóponton keresztül, a honfoglalás előtti Etelköztől a 2004-es uniós csatlakozásig. A térkép minden korszakban a kor saját stílusában jelenik meg, korszakhoz illő generált hangokkal és animációkkal.

| Korszak | Események | Stílus |
|---|---|---|
| Középkori krónika | ~850, 895, 1000, 1241, 1526 | pergamen, rubrikált iniciálék, tollrajzos határok |
| Rézmetszetes térkép | 1541, 1699 | merített papír, kézzel színezett határok, iránytűrózsa |
| Kőnyomatos atlasz | 1848, 1867 | 19. századi pasztell atlaszszínek, fokhálózat |
| Hadi térkép | 1914, 1920, 1938–41, 1947 | szépia, hajtásnyomok, gépírásos betűk |
| Hidegháború és jelen | 1956, 1989, 2004 | sötét hidegháborús térkép, majd letisztult modern atlasz |

A név Lázár deák 1528-as *Tabula Hungariae* térképére utal, amely a legrégebbi fennmaradt Magyarország-térkép.

## Funkciók

- **Idővonal**, előre/hátra lapozás, automatikus **lejátszás** (szóköz), billentyűzet (← →, Home, End), telefonon húzás (swipe).
- **Ki- és bekapcsolható rétegek:** szomszédos hatalmak, a mai határ halványan, városok és csatahelyek.
- **Animációk:** a határok „tintával” rajzolódnak ki, a kamera az események között repül. Trianonnál az elcsatolt részek leszakadnak, 1938–41-nél a visszacsatolások lépésenként jelennek meg, 1989-ben megnyílik a vasfüggöny, 2004-ben kirajzolódik az uniós csillagkör.
- **Hangok:** minden hang a böngészőben generált (Web Audio API), nincs külső hangfájl: szél, pentaton furulya, harangok, csembaló, zenélődoboz, tüzérség, rádiózaj, morzejelek, Örömóda.
- **Részecske-effektek:** por, parázs, füst, hamu, kokárdaszirmok, csillagok.
- **Mélylinkek:** minden eseménynek saját címe van, pl. `#1920`, `#1541`.

## Futtatás helyben

Az oldal sima statikus HTML/JS (ES modulok), build lépés nélkül. Egy helyi webszerver kell hozzá, mert a böngésző `file://` címről nem tölt be modulokat:

```bash
python3 -m http.server 8000
```

Utána: <http://localhost:8000>

## Felépítés

```
index.html            az oldal váza
assets/css/main.css   stílusok, a hat vizuális téma
assets/js/events.js   TARTALOM: korszakok, események, szövegek, kulcsadatok, helyszínek
assets/js/app.js      vezérlés: idővonal, kártya, lejátszás, rétegek
assets/js/map.js      térkép: rétegek, kamera, feliratok, animációk (d3)
assets/js/audio.js    generált hangok
assets/js/fx.js       papírtextúrák és részecskék
data/map.topo.json    előállított térképadat (TopoJSON)
tools/                a térképadat előállítása (Node + mapshaper)
```

Szöveg módosításához vagy új eseményhez elég az `assets/js/events.js`-t szerkeszteni. Új határokhoz a `tools/build-map.mjs`-ben kell felvenni az esemény területeit, majd újra előállítani az adatot.

## A térképadat

A határok **közelítőek**. Forrásaik:

- **[Natural Earth](https://www.naturalearthdata.com/)** 1:10m (közkincs): közigazgatási egységek, folyók, tavak. A történelmi Magyar Királyság határait a mai megyékből és régiókból rakja össze a script (pl. a Partium és Erdély román megyéi, Vajdaság, Kárpátalja, Burgenland, Muravidék).
- **[aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps)** (GPL-3.0): a szomszédos hatalmak 1920 előtt.
- **Kézzel rajzolt választóvonalak** a `tools/build-map.mjs`-ben: a hódoltság (16. század második fele), a Temesköz (1699), az első és a második bécsi döntés vonala, Bácska és a Baranyai-háromszög (1941).

Újragenerálás (az első futás letölti a forrásfájlokat a `tools/.cache` mappába):

```bash
cd tools
npm install
npm run build
```

Az adat ellenőrzéséhez: `tools/preview.html` (a helyi szerveren: <http://localhost:8000/tools/preview.html>, egy eseményre szűrve: `?only=e1541`).

## Közzététel GitHub Pagesen

1. Hozz létre egy új, nyilvános repót a GitHubon (pl. `tabula-hungariae`), és töltsd fel ide a mappa tartalmát.
2. A repó **Settings → Pages** oldalán: *Source:* „Deploy from a branch”, *Branch:* `main`, mappa: `/ (root)` → **Save**.
3. Pár perc múlva az oldal elérhető: `https://<felhasználónév>.github.io/tabula-hungariae/`

Ha a repó neve pontosan `<felhasználónév>.github.io`, akkor az oldal a gyökércímen lesz: `https://<felhasználónév>.github.io/`. Saját domain később is beállítható ugyanott (*Custom domain*).

Minden útvonal relatív, ezért az oldal alkönyvtárból és saját domainről is működik. A `.nojekyll` fájl kikapcsolja a GitHub Jekyll-feldolgozását.

## Licenc

A `data/map.topo.json` a GPL-3.0 licencű historical-basemaps adatkészletből is származik, ezért erre a fájlra a GPL-3.0 feltételei vonatkoznak.
