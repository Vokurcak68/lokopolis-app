# Průzkum: 3D AI Konfigurátor Kolejišť — Research Document

> **Datum:** 2026-03-11
> **Účel:** Podkladový výzkum pro návrh a implementaci webového 3D konfigurátoru kolejišť s AI asistencí
> **Cílová měřítka:** Tillig TT (1:120), Roco/Piko H0 (1:87)

---

## Obsah
1. [Přehled existujících konfigurátorů](#1-přehled-existujících-konfigurátorů)
2. [Geometrie kolejí — Tillig TT](#2-geometrie-kolejí--tillig-tt-1120)
3. [Geometrie kolejí — Roco GeoLine H0](#3-geometrie-kolejí--roco-geoline-h0-187)
4. [Inspirace — reálné návrhy kolejišť](#4-inspirace--reálné-návrhy-kolejišť)
5. [Doporučení pro architekturu](#5-doporučení-pro-architekturu)
6. [JSON schema pro koleje](#6-json-schema-pro-koleje)
7. [AI workflow](#7-ai-workflow)

---

## 1. Přehled existujících konfigurátorů

### 1.1 Desktop aplikace (referenční)

#### SCARM (Simple Computer Aided Railway Modeller)
- **Web:** https://www.scarm.info
- **Platforma:** Windows (desktop), verze 2.0 vyšla ~2025/2026
- **Technologie:** Nativní Windows aplikace (C++/C#), vlastní rendering engine
- **UI:** 2D editor s drag & drop + 3D prohlížeč, snap-to-endpoint napojování kolejí
- **Knihovny kolejí:** 500+ systémů kolejí od všech hlavních výrobců (Tillig, Roco, Piko, Märklin, Fleischmann, Kato, atd.)
- **Funkce:** Automatické napojování (snap), výškové úrovně (bridges/ramps), 3D náhled, simulace jízdy, export do různých formátů
- **Řešení výhybek:** Databáze prefabrikovaných dílů s definovanými geometriemi
- **Výšky:** Lineární rampy mezi definovanými body, most/tunel jako vizuální elementy
- **Formát dat:** Vlastní .SCARM soubor (XML-based)
- **Licence:** Freemium (základní zdarma, registrace pro pokročilé funkce)
- **Relevance pro nás:** Nejlepší reference pro knihovny kolejí a UX workflow

#### AnyRail
- **Web:** https://www.anyrail.com
- **Platforma:** Windows (desktop)
- **Technologie:** Nativní Windows (Delphi/C++)
- **UI:** 2D drag & drop s real-time snap
- **Knihovny:** 300+ systémů, pravidelně aktualizované
- **Funkce:** Automatické napojování, flex track, parametrické oblouky, výškové úrovně, 3D náhled
- **Výhybky:** Prefabrikované díly z knihoven s přesnými rozměry
- **Formát:** Vlastní .any soubor
- **Licence:** Placená (free trial do 50 dílů)
- **Relevance:** Nejlepší UI/UX pro track planning, vzor pro snap systém

#### XTrackCAD
- **Web:** https://sourceforge.net/projects/xtrkcad/ / https://github.com/sharkcz/xtrkcad
- **Platforma:** Cross-platform (Windows, Linux, macOS)
- **Technologie:** C, GTK toolkit
- **UI:** 2D CAD styl, méně user-friendly ale velmi přesný
- **Licence:** **GPL — open source!** 🎯
- **Knihovny kolejí:** Rozsáhlé .xtp soubory s přesnými geometriemi (viz sekce 2 a 3)
- **Formát dat:** .xtp pro knihovny, .xtc pro layouty — textový, parsovatelný
- **Relevance:** **Klíčový zdroj geometrických dat!** Všechny parametry kolejí jsou ve volně dostupných .xtp souborech

#### WinTrack
- **Web:** https://www.wintrack.de
- **Platforma:** Windows
- **Technologie:** Nativní Windows
- **UI:** 2D + 3D (vlastní 3D engine)
- **Knihovny:** Evropské systémy (Märklin, Roco, Tillig, Piko, Fleischmann, atd.)
- **Funkce:** 3D vizualizace se stínováním, výškové úrovně, mosty, tunely
- **Licence:** Placená (~€60-120)
- **Relevance:** Dobrý vzor pro 3D vizualizaci

#### 3D Modellbahn Studio
- **Web:** https://www.3d-modellbahnstudio.de
- **Platforma:** Windows (Unity engine!)
- **Technologie:** **Unity 3D** — použití herního enginu pro kolejiště
- **UI:** Plně 3D prostředí, drag & drop v 3D, free camera
- **Funkce:** Fotorealistické 3D, krajina, budovy, stromy, animace vlaků, multiplayer
- **Community:** Sdílení modelů a layoutů přes komunitní portál
- **Licence:** Freemium (V5 aktuální)
- **Relevance:** Inspirace pro 3D quality, ale **nepoužitelné jako web app** (Unity = tloušťka klienta)

### 1.2 Webové / online konfigurátory

#### Stav webových řešení (2026)
**⚠️ V současnosti neexistuje žádný plnohodnotný webový 3D konfigurátor kolejišť!**

Existující webové pokusy:
- Většina "online" nástrojů je jen marketing pro desktop software
- Několik pokusů na GitHubu, ale většinou opuštěné nebo velmi základní

#### Nalezené open-source projekty (GitHub)

| Projekt | Technologie | Stav | Popis |
|---------|-------------|------|-------|
| XTrackCAD | C / GTK | Aktivní | Desktop, ale open-source s kompletními knihovnami |
| Různé train-simulator JS projekty | Three.js | Prototypy | Zaměřené na jízdu vlaku, ne na plánování |
| JMRI (Java Model Railroading Interface) | Java | Aktivní | Řízení kolejiště, ne design |

### 1.3 JS/TS knihovny relevantní pro 3D kolejiště

| Knihovna | Použití | Výhody | Nevýhody |
|---------|---------|--------|-----------|
| **Three.js** | 3D rendering | Zralá, obrovská komunita, WebGL/WebGPU, extenze (OrbitControls, CSG) | Nízkoúrovňový, vše se musí stavět |
| **Babylon.js** | 3D engine | Kompletní engine, physics, inspector | Větší footprint, méně flexibility |
| **react-three-fiber (R3F)** | React wrapper pro Three.js | Deklarativní 3D v Reactu, perfektní s Next.js/React | Overhead wrapperu |
| **Drei** | Helpers pro R3F | Hotové komponenty (OrbitControls, Grid, atd.) | Závislost na R3F |
| **Cannon.js / Rapier** | Physics | Detekce kolizí, simulace | Overhead pro track planning |
| **Konva.js** | 2D canvas | Interaktivní 2D shapes | Pouze 2D |
| **D3.js** | SVG vizualizace | Datové vizualizace | Není pro 3D |
| **Pixi.js** | 2D WebGL | Rychlý 2D rendering | Pouze 2D |

**Doporučení:** Three.js / react-three-fiber je jasná volba — viz sekce 5.

---

## 2. Geometrie kolejí — Tillig TT (1:120)

**Měřítko:** 1:120
**Rozchod:** 12 mm (modelový), odpovídá 1435 mm reálnému
**Systém:** Bettungsgleis (koleje s podložím) — Advanced Track System

### 2.1 Přímé koleje

*Zdroj: XTrackCAD parametrický soubor TilligAdvTT.xtp*
*Poznámka: Rozměry v XTrackCAD jsou v palcích; přepočet: 1" = 25.4 mm*

| Katalogové č. | Název | Délka (mm) | Délka (palce) | Poznámka |
|---------------|-------|------------|---------------|----------|
| 83101 | G1 Straight | 166 mm | 6.535" | Standardní přímá |
| 83102 | G2 Straight | 83 mm | 3.268" | Poloviční |
| 83105 | G3 Straight | 43 mm | 1.693" | Krátká |
| 83103 | G4 Straight | 41.5 mm | 1.634" | Vyrovnávací |
| 83104 | G5 Straight | 36.5 mm | 1.437" | Vyrovnávací |
| 83132 | Adapter Track | 57 mm | 2.244" | Přechod na jiný systém |
| 83149 | Feeder Straight | 166 mm | 6.535" | Napájecí |
| 83201 | Uncoupler | 83 mm | 3.268" | Rozpojovací |
| 83150 | Isolation Track | 41.5 mm | 1.634" | Izolační |

**Modul:** Základní raster je 166 mm (G1). G2 = 83 mm = G1/2.

### 2.2 Oblouky

| Katalogové č. | Název | Poloměr (mm) | Poloměr (palce) | Úhel (°) | Poznámka |
|---------------|-------|-------------|-----------------|-----------|----------|
| 83109 | R11 | 310 mm | 12.205" | 30° | Vnitřní oblouk |
| 83110 | R12 | 310 mm | 12.205" | 15° | Poloviční R1 |
| 83113 | R14 | 310 mm | 12.205" | 7.5° | Čtvrtinový R1 |
| 83106 | R21 | 353 mm | 13.898" | 30° | Střední oblouk |
| 83107 | R22 | 353 mm | 13.898" | 15° | Poloviční R2 |
| 83114 | R24 | 353 mm | 13.898" | 7.5° | Čtvrtinový R2 |
| 83111 | R31 | 396 mm | 15.591" | 30° | Vnější oblouk |
| 83112 | R32 | 396 mm | 15.591" | 15° | Poloviční R3 |
| 83116 | R01 | 267 mm | 10.512" | 30° | Minimální poloměr |
| 83115 | R04 | 267 mm | 10.512" | 7.5° | Čtvrtinový R0 |

**Systém oblouků:**
- R0 = 267 mm (minimální, jen pro průmyslové koleje / vlečky)
- R1 = 310 mm (vnitřní, pro krátká vozidla)
- R2 = 353 mm (standardní, univerzální)
- R3 = 396 mm (vnější, pro dlouhá vozidla)
- Rozteč souběžných kolejí: R2 - R1 = 43 mm, R3 - R2 = 43 mm
- Plný kruh: 12× segment po 30° = 360°

### 2.3 Výhybky

| Katalogové č. | Název | Typ | Délka (mm) | Úhel (°) | Poloměr odbočky (mm) |
|---------------|-------|-----|------------|-----------|---------------------|
| 83321 | EW1 Right | Jednoduchá pravá | ~129.5 | 15° | 353 mm (R2) |
| 83322 | EW1 Left | Jednoduchá levá | ~129.5 | 15° | 353 mm (R2) |
| 83321 | EW2 Right | Jednoduchá pravá (delší) | ~166 | 15° | 540 mm |
| 83322 | EW2 Left | Jednoduchá levá (delší) | ~166 | 15° | 540 mm |
| 83341 | EW3 Right | Štíhlá pravá | ~207 | 12° | 870 mm |
| 83342 | EW3 Left | Štíhlá levá | ~207 | 12° | 870 mm |
| 83361 | IBW Right | Innenbogenweiche pravá | ~163 | 30° (15°+15°) | 265 mm + 540 mm |
| 83362 | IBW Left | Innenbogenweiche levá | ~163 | 30° (15°+15°) | 265 mm + 540 mm |
| 83380 | ABW-15 | Symetrická (Y) 15° | ~166 | 2×7.5° | 1092 mm |
| 83382 | ABW-12 | Symetrická (Y) 12° | ~207 | 2×6° | 1757 mm |
| 83300 | DKW15 | Dvojitá křížová | ~166 | 15° | — |
| 83210 | DGV | Dvojitý přejezd | ~251 | ~20.7° | 266 mm |

**Detaily výhybek z XTrackCAD dat:**
- **EW1 (83321/83322):** Celková délka ~129.5 mm, přímý směr + odbočka R=353 mm pod 15°
- **EW2:** Celková délka = G1 (166 mm), odbočka R=540 mm pod 15°, přímá + krivka + přímá
- **EW3 (83341/83342):** Celková délka ~207 mm, odbočka R=870 mm pod 12° — vhodné pro hlavní tratě
- **IBW (83361/83362):** Innenbogenweiche — dvě odbočky z jednoho místa, kombinace R=265mm a R=540mm
- **ABW-15 Wye (83380):** Symetrická výhybka, obě větve se rozbíhají pod 7.5° od osy
- **DKW15 (83300):** Double-slip — křížení s možností přestavení na 4 směry
- **DGV (83210):** Double crossover — dvě souběžné koleje s křížením v obou směrech

### 2.4 Křížení

| Katalogové č. | Název | Úhel (°) | Délka (mm) |
|---------------|-------|-----------|------------|
| 83160 | K1-15 Crossing | 15° | 166 mm |
| 83170 | K2-30 Crossing | 30° | 83 mm |

---

## 3. Geometrie kolejí — Roco GeoLine H0 (1:87)

**Měřítko:** 1:87
**Rozchod:** 16.5 mm (modelový), odpovídá 1435 mm reálnému
**Systém:** Roco GeoLine — systém s integrovaným podložím

### 3.1 Přímé koleje

*Zdroj: XTrackCAD parametrický soubor RocoGeoLineHO.xtp*

| Katalogové č. | Název | Délka (mm) | Délka (palce) | Poznámka |
|---------------|-------|------------|---------------|----------|
| 61106 | Straight 785 | 785 mm | 30.906" | Dlouhá přímá |
| 61110 | Straight 200 | 200 mm | 7.874" | Standardní přímá |
| 61111 | Straight 185 | 185 mm | 7.283" | Blízká standardu |
| 61112 | Straight 76.5 | 76.5 mm | 3.012" | Krátká |
| 61113 | Straight 100 | 100 mm | 3.937" | Střední krátká |
| 61118 | Uncoupler 100 | 100 mm | 3.937" | Elektrický rozpojovač |
| 61119 | Manual Uncoupler | 100 mm | 3.937" | Manuální rozpojovač |
| 61120 | Transition 100 | 100 mm | 3.937" | Přechod na RocoLine |

**Modul:** Základní raster je 200 mm.

### 3.2 Oblouky

| Katalogové č. | Název | Poloměr (mm) | Poloměr (palce) | Úhel (°) | Poznámka |
|---------------|-------|-------------|-----------------|-----------|----------|
| 61122 | R2 Curve | 358 mm | 14.094" | 30° | Vnitřní oblouk |
| 61129 | R2 Curve | 358 mm | 14.094" | 7.5° | Vyrovnávací R2 |
| 61123 | R3 Curve | 434.5 mm | 17.106" | 30° | Střední oblouk |
| 61130 | R3 Curve | 434.5 mm | 17.106" | 7.5° | Vyrovnávací R3 |
| 61124 | R4 Curve | 511 mm | 20.118" | 30° | Vnější oblouk |
| 61128 | Counter Curve | 503 mm | 19.804" | 22.5° | Protioblouk |

**Systém oblouků:**
- R2 = 358 mm (minimální použitelný pro běžný provoz)
- R3 = 434.5 mm (standardní)
- R4 = 511 mm (vnější, pro dlouhé vozy)
- Rozteč souběžných kolejí: R3 - R2 = 76.5 mm, R4 - R3 = 76.5 mm
- Plný kruh: 12× segment po 30° = 360°

### 3.3 Výhybky

| Katalogové č. | Název | Typ | Délka (mm) | Úhel (°) | Poloměr odbočky (mm) |
|---------------|-------|-----|------------|-----------|---------------------|
| 61140 | Left Turnout | Jednoduchá levá | 200 mm | 22.5° | 420 mm |
| 61141 | Right Turnout | Jednoduchá pravá | 200 mm | 22.5° | 420 mm |
| 61160 | Three-way Turnout | Třícestná | 200 mm | 2×22.5° | 420 mm |
| 61164 | Double Slip | Dvojitá křížová | 200 mm | 22.5° | 337 mm |
| 61154 | Left Curved Turnout | Oblouková levá | ~217 | 30° | R3 (434.5 mm) |
| 61155 | Right Curved Turnout | Oblouková pravá | ~217 | 30° | R3 (434.5 mm) |

**Detaily výhybek z XTrackCAD dat:**
- **61140/61141 (L/R Turnout):** Délka = 200 mm (= G1), přímý směr + odbočka R≈420 mm pod 22.5°
  - Přímá část od 0 do bodu přestavení (~16.7 mm), pak přímá pokračuje
  - Odbočka: oblouk R=420 mm od bodu přestavení, pak krátká přímá na konec
- **61160 (Three-way):** Kombince levé a pravé výhybky — tři výstupy (levá odbočka, přímá, pravá odbočka)
- **61164 (Double Slip):** Křížení se dvěma přestavitelnými jazyky — 4 možné cesty
- **61154/61155 (Curved Turnout):** Oblouk R3 se rozděluje — vnější větev pokračuje obloukem R3, vnitřní větev jde rovně (+další oblouk)

### 3.4 Rozšíření — Piko A-Gleis H0

Piko A-Gleis je alternativní H0 systém populární v ČR/DE. Geometrie je kompatibilní s následujícími rozměry:

| Typ | Rozměry |
|-----|---------|
| Přímé koleje | 239.07 mm (G231), 119.54 mm (G115), 62 mm, 55.5 mm |
| Oblouky R1 | 360 mm, 30° |
| Oblouky R2 | 422 mm, 30° |
| Oblouky R3 | 484 mm, 30° |
| Oblouky R9 | 908 mm, 15° |
| Výhybky | Levá/pravá 15°, DKW 15°, Y-weiche, obloukové |
| Rozteč | R2-R1 = 62 mm |

---

## 4. Inspirace — reálné návrhy kolejišť

### 4.1 Typické konfigurace a vzory

#### Jednoduchý ovál (beginner)
```
┌──────────────────────────┐
│   ╭──────────────────╮   │
│   │                  │   │
│   ╰──────────────────╯   │
└──────────────────────────┘
```
- 4× oblouk R2/R3 30° (= 8× pro půlkruh) + přímky
- Minimální rozměry TT: ~700 × 400 mm
- Minimální rozměry H0: ~900 × 500 mm

#### Dog-bone (kost / osmička)
```
╭───╮         ╭───╮
│   ╰─────────╯   │
│   ╭─────────╮   │
╰───╯         ╰───╯
```
- Dvě smyčky spojené přímými tratěmi
- Umožňuje obousměrný provoz
- Typický rozměr TT: 2000 × 600 mm

#### Dvojitý ovál s nádražím
```
╭═══════════════════════╮
│ ╭─────────────────╮   │
│ │  ═══╤═══╤═══    │   │  (nádraží)
│ │     │   │       │   │
│ ╰─────────────────╯   │
╰═══════════════════════╯
```
- Vnější a vnitřní trať, spojené výhybkami
- Nádraží s 2-4 kolejemi
- Odstavné koleje
- Typický rozměr: 2500 × 1200 mm (H0), 1800 × 900 mm (TT)

#### Komplexní kolejiště s nádražím, depem a smyčkami
Prvky:
- **Hlavní trať:** Dvojkolejná s mostem/tunelem pro převýšení
- **Nádraží:** 3-5 průjezdních kolejí, 1-2 kusé koleje
- **Depo:** 3-6 kolejí s točnou
- **Odstavné nádraží (Fiddle Yard):** 4-8 kolejí pro parkování souprav
- **Průmyslová vlečka:** 1-2 koleje s výhybkami
- **Smyčky:** Pro otáčení vlaku bez couvání

### 4.2 Složité prvky

#### Most / viadukt
- Vyžaduje **lineární převýšení** (rampu) — typicky 3-4% stoupání
- TT: 43 mm výškový rozdíl pro křížení = rampa ~1100 mm při 4%
- H0: 76 mm výškový rozdíl = rampa ~1900 mm při 4%
- Vizuálně: obloukový most, příhradový most, kamenný viadukt

#### Tunel
- Vstup/výstup s portálem
- Skrytá sekce tratě "pod horou"
- Často slouží pro skrytou smyčku nebo odstavné nádraží

#### Točna (turntable)
- Tillig TT: Ø 144 mm (pro loky do ~200 mm)
- H0: Ø 254 mm (Roco) / Ø 288 mm (Fleischmann)
- 12-24 pozic pro napojení kolejí

#### Křížení v různých úrovních
- Skládá se z rampy + mostu + rampy
- Alternativa ke kolejovému křížení (které omezuje provoz)

### 4.3 Zdroje inspirace

| Web | Popis | URL |
|-----|-------|-----|
| SCARM Layouts | Databáze plánů | https://www.scarm.info/layouts/ |
| Gleisplanung.de | Německé plány | https://gleisplanung.de |
| TrackPlanning (Reddit) | Komunita | r/modelrailroads, r/modeltrains |
| 3D Modellbahn Studio Community | 3D plány | https://www.3d-modellbahnstudio.de/community |
| RailServe | Obecné zdroje | https://www.railserve.com |
| Modellbahn-Anleitungen.de | Německé tutoriály | — |
| tt-board.de | TT komunita (DE) | https://www.tt-board.de |
| ŽelPage.cz | CZ/SK modeláři | https://www.zelpage.cz |

---

## 5. Doporučení pro architekturu

### 5.1 Rendering Engine — Rozhodnutí

#### Porovnání přístupů

| Kritérium | SVG (2D) | Canvas 2D | Three.js (WebGL 3D) |
|-----------|---------|-----------|---------------------|
| 3D vizualizace | ❌ | ❌ | ✅ Plný 3D |
| Výkon (stovky dílů) | ⚠️ Pomalé s 500+ elementy | ✅ Rychlý | ✅ GPU akcelerovaný |
| Interaktivita | ✅ DOM eventy | ⚠️ Hit testing nutný | ✅ Raycasting |
| Výškové úrovně | ❌ | ❌ Fake 2.5D max | ✅ Nativní |
| Renderovací kvalita | Čistá 2D | Čistá 2D | ✅ Stíny, textury, PBR |
| Mobile support | ✅ | ✅ | ⚠️ Potřebuje optimalizaci |
| Složitost implementace | Nízká | Nízká | Střední-vysoká |
| Perspektivní (AR/VR) | ❌ | ❌ | ✅ WebXR |

#### ✅ Doporučení: **Three.js (react-three-fiber)** + **2D SVG minimap**

**Primární view: 3D (Three.js / R3F)**
- Hlavní pracovní prostor v 3D
- OrbitControls pro rotaci/zoom
- Raycasting pro výběr a manipulaci dílů
- Výškové úrovně nativně
- PBR materiály pro realistický vzhled

**Sekundární view: 2D minimap (SVG/Canvas)**
- Schématický pohled shora
- Rychlá navigace po kolejišti
- Snap-to-grid pomocný overlay

### 5.2 Tech Stack

```
Frontend:
├── Next.js 14+ (App Router)
├── React 18+
├── TypeScript
├── react-three-fiber (R3F) — 3D rendering
│   ├── @react-three/drei — helpers (OrbitControls, Grid, Text, atd.)
│   ├── @react-three/postprocessing — efekty
│   └── three.js (core)
├── Zustand — state management (lehký, ideální pro 3D scénu)
├── Tailwind CSS — UI komponenty
└── shadcn/ui — UI primitiva

Backend / AI:
├── Next.js API routes nebo tRPC
├── OpenAI / Claude API — generování layoutů
├── Zod — validace schémat
└── PostgreSQL/SQLite — ukládání layoutů

Geometrie:
├── @dimforge/rapier3d — physics / collision detection (WASM)
└── Vlastní track-geometry engine (viz sekce 5.4)
```

### 5.3 Data Model — Reprezentace kolejí

#### Track Piece (díl koleje)

Každý díl je definován:
1. **Typem** (straight, curve, turnout, crossing, ...)
2. **Geometrií** (délka, poloměr, úhel)
3. **Connection points** (body napojení) — klíčové!
4. **Pozicí ve scéně** (x, y, z + rotace)

#### Connection Point

Každý connection point má:
- Pozici (x, y, z) — relativní k dílu
- Směr (úhel v XZ rovině) — tangenta v bodě napojení
- Stav (connected / free)
- Reference na připojený díl + jeho connection point

**Pravidlo napojení:** Dva connection points se mohou spojit, pokud:
1. Mají stejnou pozici (s tolerancí ε ≈ 0.5mm)
2. Jejich směry jsou opačné (liší se o 180° ± ε)

### 5.4 Snap/Connect systém

```typescript
interface ConnectionPoint {
  id: string;
  position: Vector3;        // Relativní k dílu
  direction: number;        // Úhel v stupních (0 = sever, 90 = východ, ...)
  connected: boolean;
  connectedTo?: {
    pieceId: string;
    pointId: string;
  };
}

interface TrackPiece {
  id: string;
  type: TrackPieceType;
  catalogNumber: string;
  position: Vector3;         // Absolutní pozice ve scéně
  rotation: number;          // Rotace v Y ose (stupně)
  elevation: number;         // Výšková úroveň (mm)
  connections: ConnectionPoint[];
  geometry: TrackGeometry;
}
```

#### Snap algoritmus:

```
1. Uživatel táhne díl (drag)
2. Pro každý FREE connection point nového dílu:
   a. Hledej nejbližší FREE connection point existujícího dílu
   b. Pokud vzdálenost < SNAP_THRESHOLD (např. 20mm):
      - Vypočítej cílovou pozici a rotaci nového dílu tak,
        aby se connection points přesně shodovaly
      - Zobraz snap indikátor (zelená tečka)
3. Při uvolnění (drop):
   a. Pokud je aktivní snap → umísti na snap pozici + propoj
   b. Jinak → umísti na aktuální pozici (free placement)
```

#### Výpočet snap pozice:

```typescript
function calculateSnapTransform(
  draggingPiece: TrackPiece,
  draggingPoint: ConnectionPoint,
  targetPoint: ConnectionPoint,
  targetPiece: TrackPiece
): { position: Vector3; rotation: number } {
  // 1. Cílová rotace = rotace target pointu + 180° - rotace dragging pointu
  const targetAngle = targetPiece.rotation + targetPoint.direction;
  const newRotation = targetAngle + 180 - draggingPoint.direction;

  // 2. Cílová pozice = pozice target pointu - rotovaná pozice dragging pointu
  const rotatedOffset = rotatePoint(draggingPoint.position, newRotation);
  const targetWorldPos = getWorldPosition(targetPiece, targetPoint);
  const newPosition = targetWorldPos.sub(rotatedOffset);

  return { position: newPosition, rotation: normalizeAngle(newRotation) };
}
```

### 5.5 Výškové úrovně (mosty, tunely)

#### Přístup: Elevation Points + Interpolace

```typescript
interface ElevationPoint {
  pieceId: string;
  connectionIndex: number;  // Který connection point
  elevation: number;        // Výška v mm
}

// Rampa se počítá jako lineární interpolace mezi elevation points
// Každý díl má elevaci na každém connection pointu
// Vizuálně se díl natočí tak, aby odpovídal gradientu
```

#### Pravidla:
- **Maximální stoupání:** 3-4% (realistické), 5% (hraniční)
- **Výškový rozdíl pro podchod:**
  - TT: min. 45 mm (výška vozidla + most)
  - H0: min. 80 mm
- **Tunel:** Díly s elevation < 0 relativně k povrchu terénu
- **Most:** Díly s elevation > 0 + vizuální podpěra

#### Vizualizace:
- Rampa: díl je nakloněn dle gradientu
- Most: automaticky generovaný 3D model podpěr
- Tunel: portál na vstupu/výstupu, skrytá sekce

### 5.6 Geometrický engine pro rendering

#### Generování 3D geometrie z parametrů:

**Přímá kolej:**
```typescript
function createStraightTrackGeometry(length: number): BufferGeometry {
  // Extrude profilu koleje (2 kolejnice + pražce) podél přímky
  const profile = createRailProfile(); // Profil kolejnice ve tvaru obráceného T
  const path = new LineCurve3(new Vector3(0,0,0), new Vector3(length,0,0));
  return new ExtrudeGeometry(profile, { extrudePath: path, steps: 1 });
}
```

**Oblouk:**
```typescript
function createCurveTrackGeometry(radius: number, angle: number): BufferGeometry {
  // Extrude profilu podél kruhového oblouku
  const path = new ArcCurve(radius, angle);
  return new ExtrudeGeometry(profile, { extrudePath: path, steps: angle/2 });
}
```

**Výhybka:**
```typescript
function createTurnoutGeometry(params: TurnoutParams): BufferGeometry {
  // Kombinace přímé + obloukové geometrie
  // + jazyky + srdcovka
  // Složitější — sestaveno z více segmentů
}
```

---

## 6. JSON Schema pro koleje

### 6.1 Track Piece Type Definition (katalogová definice)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "TrackPieceDefinition",
  "type": "object",
  "properties": {
    "id": { "type": "string", "description": "Unikátní ID typu (např. 'tillig-83101')" },
    "manufacturer": { "type": "string", "enum": ["tillig", "roco", "piko", "marklin", "fleischmann"] },
    "scale": { "type": "string", "enum": ["TT", "H0", "N", "Z", "G"] },
    "catalogNumber": { "type": "string" },
    "name": { "type": "string" },
    "category": {
      "type": "string",
      "enum": ["straight", "curve", "turnout_left", "turnout_right", "turnout_wye",
               "turnout_three_way", "crossing", "double_slip", "double_crossover",
               "curved_turnout_left", "curved_turnout_right", "turntable",
               "bridge", "tunnel_portal", "buffer_stop", "uncoupler", "feeder",
               "adapter", "flex"]
    },
    "geometry": {
      "type": "object",
      "properties": {
        "length": { "type": "number", "description": "Celková délka v mm" },
        "radius": { "type": "number", "description": "Poloměr oblouku v mm (0 pro přímé)" },
        "angle": { "type": "number", "description": "Úhel oblouku ve stupních" },
        "divergingRadius": { "type": "number", "description": "Poloměr odbočky u výhybek" },
        "divergingAngle": { "type": "number", "description": "Úhel odbočky ve stupních" }
      }
    },
    "connections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "position": {
            "type": "object",
            "properties": {
              "x": { "type": "number" },
              "y": { "type": "number" },
              "z": { "type": "number" }
            }
          },
          "direction": { "type": "number", "description": "Úhel ve stupních" }
        }
      }
    },
    "paths": {
      "type": "array",
      "description": "Definice cest skrz díl (pro výhybky: multiple paths)",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string", "description": "např. 'straight', 'diverging'" },
          "from": { "type": "string", "description": "connection ID" },
          "to": { "type": "string", "description": "connection ID" },
          "segments": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "type": { "type": "string", "enum": ["line", "arc"] },
                "start": { "type": "object" },
                "end": { "type": "object" },
                "radius": { "type": "number" },
                "center": { "type": "object" }
              }
            }
          }
        }
      }
    }
  }
}
```

### 6.2 Layout (umístěný díl v layoutu)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "LayoutPiece",
  "type": "object",
  "properties": {
    "instanceId": { "type": "string", "format": "uuid" },
    "typeId": { "type": "string", "description": "Reference na TrackPieceDefinition" },
    "position": {
      "type": "object",
      "properties": {
        "x": { "type": "number", "description": "mm" },
        "y": { "type": "number", "description": "mm (elevation)" },
        "z": { "type": "number", "description": "mm" }
      }
    },
    "rotation": { "type": "number", "description": "Rotace v Y ose (stupně)" },
    "connections": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "pointId": { "type": "string" },
          "connectedTo": {
            "type": "object",
            "properties": {
              "instanceId": { "type": "string" },
              "pointId": { "type": "string" }
            }
          }
        }
      }
    },
    "state": {
      "type": "object",
      "description": "Pro výhybky: stav přestavení",
      "properties": {
        "position": { "type": "string", "enum": ["normal", "reverse", "left", "right"] }
      }
    }
  }
}
```

### 6.3 Celý Layout

```json
{
  "title": "TrackLayout",
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "name": { "type": "string" },
    "scale": { "type": "string" },
    "trackSystem": { "type": "string" },
    "dimensions": {
      "type": "object",
      "properties": {
        "width": { "type": "number", "description": "mm" },
        "depth": { "type": "number", "description": "mm" },
        "description": { "type": "string" }
      }
    },
    "pieces": {
      "type": "array",
      "items": { "$ref": "#/definitions/LayoutPiece" }
    },
    "terrain": {
      "type": "object",
      "description": "Definice terénu (heightmap, textury)"
    },
    "metadata": {
      "type": "object",
      "properties": {
        "author": { "type": "string" },
        "created": { "type": "string", "format": "date-time" },
        "tags": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

---

## 7. AI Workflow

### 7.1 Přehled workflow

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐     ┌───────────────┐
│  Uživatel    │────▶│  AI Engine   │────▶│  Konfigurátor  │────▶│  Validátor    │
│  zadá text   │     │  generuje    │     │  vykreslí      │     │  ověří        │
│  požadavky   │     │  JSON layout │     │  3D scénu      │     │  napojení     │
└─────────────┘     └──────────────┘     └────────────────┘     └───────────────┘
       ▲                                                               │
       │                                                               │
       └───────────── feedback (chyby, návrhy úprav) ◀─────────────────┘
```

### 7.2 Uživatelský vstup → AI prompt

**Příklad vstupu uživatele:**
> "Chci kolejiště TT na stůl 2×1 metr. Hlavní trať dvojkolejná s nádražím (3 koleje + 1 kusá), malé depo se 3 kolejemi a most přes údolí. Stylové – venkovské nádraží."

**Strukturovaný požadavek (parsovaný):**

```json
{
  "scale": "TT",
  "trackSystem": "tillig-bedded",
  "dimensions": { "width": 2000, "depth": 1000 },
  "requirements": {
    "mainLine": { "tracks": 2, "type": "loop" },
    "station": {
      "tracks": 3,
      "stubTracks": 1,
      "style": "rural"
    },
    "depot": { "tracks": 3 },
    "features": ["bridge", "valley"],
    "theme": "rural"
  }
}
```

### 7.3 AI generování layoutu

AI model (Claude/GPT) dostane:
1. **System prompt** s pravidly kolejiště (geometrie, pravidla napojení, min. poloměry)
2. **Knihovnu dostupných dílů** (zjednodušený katalog s geometriemi)
3. **Požadavky uživatele** (strukturované)
4. **Instrukci** generovat validní JSON layout

**Co AI vrací:**

```json
{
  "layout": {
    "pieces": [
      {
        "typeId": "tillig-83101",
        "position": { "x": 0, "y": 0, "z": 0 },
        "rotation": 0,
        "connections": [
          { "pointId": "A", "connectedTo": { "instanceId": "piece-2", "pointId": "B" } }
        ]
      }
      // ... desítky dalších dílů
    ]
  },
  "explanation": "Layout je navržen jako dvojitý ovál s nádražím uprostřed..."
}
```

### 7.4 Validace

**Post-processing po AI generování:**

```typescript
function validateLayout(layout: Layout): ValidationResult {
  const errors: ValidationError[] = [];

  // 1. Kontrola napojení — shodují se pozice connection points?
  for (const piece of layout.pieces) {
    for (const conn of piece.connections) {
      if (conn.connectedTo) {
        const target = findPiece(layout, conn.connectedTo.instanceId);
        const targetPoint = findConnection(target, conn.connectedTo.pointId);
        const distance = calculateDistance(
          getWorldPosition(piece, conn),
          getWorldPosition(target, targetPoint)
        );
        if (distance > TOLERANCE) {
          errors.push({
            type: 'connection_gap',
            pieces: [piece.id, target.id],
            gap: distance
          });
        }
      }
    }
  }

  // 2. Kontrola kolizí — překrývají se díly?
  for (let i = 0; i < layout.pieces.length; i++) {
    for (let j = i + 1; j < layout.pieces.length; j++) {
      if (checkCollision(layout.pieces[i], layout.pieces[j])) {
        errors.push({
          type: 'collision',
          pieces: [layout.pieces[i].id, layout.pieces[j].id]
        });
      }
    }
  }

  // 3. Kontrola rozměrů — vejde se na desku?
  const bbox = calculateBoundingBox(layout);
  if (bbox.width > layout.dimensions.width || bbox.depth > layout.dimensions.depth) {
    errors.push({ type: 'exceeds_dimensions', bbox });
  }

  // 4. Kontrola stoupání — nepřekračuje max. gradient?
  for (const piece of layout.pieces) {
    const gradient = calculateGradient(piece);
    if (gradient > MAX_GRADIENT) {
      errors.push({ type: 'gradient_too_steep', pieceId: piece.id, gradient });
    }
  }

  // 5. Kontrola uzavřených smyček — má hlavní trať smysl?
  const loops = findLoops(layout);
  if (loops.length === 0) {
    errors.push({ type: 'no_closed_loop', severity: 'warning' });
  }

  return { valid: errors.length === 0, errors };
}
```

### 7.5 Iterativní vylepšování

```
Kolo 1: AI generuje hrubý layout
         → Validátor najde 5 chyb (gapy, kolize)
         → Vizualizace s červeně zvýrazněnými chybami

Kolo 2: AI opraví chyby na základě feedback
         → Validátor najde 1 chybu
         → Blízko cíle

Kolo 3: AI finální úprava
         → Validátor: ✅ OK
         → Uživatel vidí hotový layout

Uživatel: Může ručně upravit (drag & drop) → re-validace v reálném čase
```

### 7.6 Alternativní AI přístup: Constraint-based generování

Místo přímého generování JSON layoutu:

1. **AI generuje high-level plán** (graf propojení)
2. **Deterministický algoritmus** rozmísťuje díly podle grafu
3. **Optimalizátor** (greedy/GA) minimalizuje chyby

```typescript
// High-level graf od AI
interface LayoutGraph {
  nodes: Array<{
    id: string;
    type: 'station' | 'junction' | 'terminus' | 'depot' | 'bridge' | 'tunnel';
    tracks?: number;
    position_hint?: { x: number, z: number }; // Přibližná pozice
  }>;
  edges: Array<{
    from: string;
    to: string;
    type: 'main' | 'branch' | 'siding';
    constraints?: {
      minCurveRadius?: number;
      maxGradient?: number;
      elevated?: boolean;
    };
  }>;
}
```

**Výhoda:** AI je dobrý na high-level design, deterministický kód na přesné geometrie.

### 7.7 Doporučený přístup pro MVP

1. **Fáze 1: Manuální editor (bez AI)**
   - Drag & drop dílů z katalogu
   - Snap/connect systém
   - 3D vizualizace
   - Export/import JSON

2. **Fáze 2: AI asistence**
   - AI navrhne layout na základě textového popisu
   - Uživatel upraví v editoru
   - AI jako "co-pilot" — navrhuje kde přidat výhybku, jak vyřešit smyčku

3. **Fáze 3: Pokročilé funkce**
   - Výškové úrovně
   - Terén
   - Simulace jízdy
   - Export do STL/OBJ pro 3D tisk

---

## Appendix A: XTrackCAD .xtp formát

Formát .xtp souborů je klíčový zdroj geometrických dat. Struktura:

```
CONTENTS <název systému>
SUBCONTENTS <název sekce>
TURNOUT <měřítko> "<výrobce>\t<název>\t<kat.č.>"
  P "<jméno pozice>" <čísla segmentů>     # Pozice výhybky
  E <x> <y> <úhel>                         # Endpoint (connection point)
  S <barva> <tloušťka> <x1> <y1> <x2> <y2> # Straight segment
  C <barva> <tloušťka> <radius> <cx> <cy> <startAngle> <sweepAngle> # Curve segment
  END
```

**Jednotky:** palce (1" = 25.4mm)
**Souřadnicový systém:** Y nahoru, úhly ve stupních (270° = vlevo, 90° = vpravo)
**Connection points:** Definovány řádky `E` — první E je vstup, další jsou výstupy

**Parser pro import do naší aplikace:**

```typescript
function parseXTP(content: string): TrackPieceDefinition[] {
  const pieces: TrackPieceDefinition[] = [];
  const lines = content.split('\n');
  let current: Partial<TrackPieceDefinition> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('TURNOUT')) {
      // Parse: TURNOUT TT "Manufacturer\tName\tCatalog"
      const match = trimmed.match(/TURNOUT\s+(\w+)\s+"(.+?)\\t(.+?)\\t(.+?)"/);
      if (match) {
        current = {
          scale: match[1],
          manufacturer: match[2],
          name: match[3],
          catalogNumber: match[4],
          connections: [],
          paths: []
        };
      }
    } else if (trimmed.startsWith('E ') && current) {
      const parts = trimmed.split(/\s+/);
      current.connections!.push({
        id: `E${current.connections!.length}`,
        position: {
          x: parseFloat(parts[1]) * 25.4,  // inches to mm
          y: 0,
          z: parseFloat(parts[2]) * 25.4
        },
        direction: parseFloat(parts[3])
      });
    } else if (trimmed === 'END' && current) {
      pieces.push(current as TrackPieceDefinition);
      current = null;
    }
  }

  return pieces;
}
```

---

## Appendix B: Srovnání rozměrů TT vs H0

| Parametr | TT (1:120) | H0 (1:87) |
|----------|-----------|-----------|
| Rozchod modelu | 12 mm | 16.5 mm |
| Min. poloměr oblouku (standard) | 310 mm | 358 mm |
| Standardní poloměr | 353 mm | 434.5 mm |
| Rozteč souběžných tratí | 43 mm | 76.5 mm |
| Standardní přímá kolej | 166 mm | 200 mm |
| Úhel segmentu oblouku | 30°/15°/7.5° | 30°/7.5° |
| Úhel výhybky (standard) | 15° | 22.5° |
| Min. výška pro podchod | ~45 mm | ~80 mm |
| Min. plocha pro smysluplné kolejiště | ~0.7 m² | ~1.2 m² |
| Plný kruh (min. R) | Ø 620 mm | Ø 716 mm |

---

## Appendix C: Klíčové koncepty pro implementaci

### C.1 Bezierovy křivky vs kruhové oblouky

Modelové koleje používají **kruhové oblouky** (konstantní poloměr), nikoliv Bézierovy křivky. To zjednodušuje:
- Geometrii (arc = středový bod + poloměr + úhel)
- Přesnost napojení
- Kompatibilitu s reálnými díly

Výjimka: "flex track" (ohebná kolej) — ta je parametrická a může být modelována jako spline.

### C.2 Pražce a kolejnicový profil

Pro 3D vizualizaci:
- **Kolejnice:** 2 rovnoběžné čáry/extrude s profilem tvaru obráceného T
- **Pražce:** Opakující se obdélníky kolmo na osu koleje, rozteč ~8-10 mm (TT) / ~11-14 mm (H0)
- **Podloží (ballast):** Trapézový profil pod kolejemi

### C.3 Level of Detail (LOD)

```
Zoom blízko:   Detailní kolejnice + pražce + šrouby (LOD 0)
Zoom střední:  Kolejnice + pražce (LOD 1)
Zoom daleko:   Pouze čáry kolejí (LOD 2)
Celkový pohled: Schématické čáry (LOD 3)
```

### C.4 Turntable (točna)

Speciální díl — kruhová platforma s otočným mostem:
- N připojovacích pozic (typicky 12-24) rozmístěných po obvodu
- Otočný most spojuje protilehlé pozice
- V 3D: animovaná rotace

---

*Tento dokument slouží jako podklad pro implementaci webového 3D konfigurátoru kolejišť v rámci projektu Lokopolis.*
*Zpracováno na základě analýzy open-source zdrojů (XTrackCAD), oficiálních katalogů výrobců a existujících softwarových řešení.*
