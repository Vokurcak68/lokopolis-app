# 📖 LOKOPOLIS.CZ — Kompletní manuál

> **Verze:** 1.0 | **Datum:** 2026-03-22 | **Autor:** Arc ⚡

---

## 1. Přehled projektu

| Položka | Hodnota |
|---|---|
| **Název** | Lokopolis |
| **Účel** | Česká komunitní platforma pro modelovou železnici |
| **URL** | [lokopolis.cz](https://lokopolis.cz) |
| **Repo** | [github.com/Vokurcak68/lokopolis-app](https://github.com/Vokurcak68/lokopolis-app) |
| **Stack** | Next.js 16.1.7, TypeScript, Tailwind CSS v4, Supabase |
| **Hosting** | Vercel (lokopolis-app.vercel.app) |

### Design

- **Tmavý a světlý theme** — uživatel si přepíná dle preference
- **Oranžové akcenty** — primární barva `#f0a030`
- **CSS variables:** `--bg-card`, `--accent`, `--text-primary` a další

### Logo

CSS badge vykreslený přímo v kódu:

```
· est. 2026 ·
LOKOPOLIS
modelová železnice
```

---

## 2. Registrace a uživatelské účty

### Registrace a přihlášení

| Akce | URL |
|---|---|
| Registrace | `/registrace` |
| Přihlášení | `/prihlaseni` |
| Profil / účet | `/ucet` |

- Autentizace přes **Supabase Auth** (email + heslo)
- Při registraci se vytvoří záznam v tabulce `profiles`

### Profil (`/ucet`)

- **Avatar** — nahrání profilového obrázku
- **Jméno** — zobrazované jméno v komunitě
- **Username** — unikátní identifikátor

### Role

| Role | Popis |
|---|---|
| `user` | Běžný uživatel — čtení, psaní článků, příspěvky ve fóru, bazar |
| `admin` | Plný přístup k admin panelu, moderování, správa obsahu |

Admin se ověřuje přes `profiles.role === "admin"`.

---

## 3. Homepage

Homepage je plně dynamická — admin může zapínat/vypínat jednotlivé sekce v `/admin/homepage` (18 checkboxů).

### Sekce homepage

| # | Klíč | Popis |
|---|---|---|
| 1 | `leaderboard_banner` | Hlavní reklamní banner v horní části stránky (hero pozice) |
| 2 | `latest_articles` | Nejnovější publikované články z komunity |
| 3 | `forum_bar` | Rychlý přehled posledních diskuzí ve fóru |
| 4 | `categories` | Dlaždice kategorií článků s ikonami |
| 5 | `cta_strip` | Výzva k akci — registrace, přidání článku apod. |
| 6 | `stats_bar` | Statistiky komunity (počet článků, uživatelů, příspěvků) |
| 7 | `inline_banner` | Nativní banner v obsahu — typicky propagace soutěže |
| 8 | `bazar` | Výběr nejnovějších inzerátů z bazaru |
| 9 | `competition` | Aktuální soutěž "Kolejiště měsíce" |
| 10 | `shop_products` | Doporučené produkty ze shopu |
| 11 | `downloads` | Nejnovější soubory ke stažení |
| 12 | `popular_articles` | Nejčtenější články (dle view counteru) |
| 13 | `events` | Nadcházející akce a události |
| 14 | `active_authors` | Nejaktivnější autoři komunity |
| 15 | `forum_widget` | Widget s aktivními vlákny fóra |
| 16 | `tags` | Oblak tagů — rychlá navigace dle témat |
| 17 | `activity_feed` | Chronologický feed aktivity (články, příspěvky, inzeráty) |
| 18 | `sidebar_banner` | Reklamní banner v postranním panelu |

---

## 4. Navigace a menu

### Hlavní navigace

```
Domů
Články
Komunita ▾
  ├── Fórum
  ├── Galerie
  ├── Akce
  └── Soutěž
Obchod ▾
  ├── Shop
  ├── Bazar
  └── Ke stažení
```

### Další prvky navigace

- **Theme toggle** — přepínání tmavý/světlý režim
- **Košík** — ikona s počtem položek, odkaz na `/kosik`
- **Uživatelské menu** — avatar, odkaz na profil, odhlášení, admin panel (pro adminy)

### Admin toggle

V `/admin/menu` lze zapínat/vypínat **9 položek** navigace pomocí checkboxů. Každá položka menu se dá individuálně skrýt.

---

## 5. Články

### Psaní článků (`/novy-clanek`)

- **Tiptap WYSIWYG editor** — formátování textu, obrázky, odkazy, kód
- **Cover image upload** — titulní obrázek článku
- Článek se po odeslání čeká na schválení adminem (flag `verified`)

### Kategorie

12 kategorií, každá s vlastní **PNG ikonou** (256×256 px, průhledné pozadí). Ikony uloženy v Supabase Storage: `images/icons/`.

### Tagy

- **17+ tagů** k dispozici
- **Autocomplete** — při psaní tagu se nabízejí existující tagy

### View counter

Každé zobrazení článku inkrementuje počítadlo přes Supabase RPC funkci `increment_article_view`.

### Moderování

- Admin schvaluje články v `/admin/clanky`
- Filtry: **pending** (čeká na schválení), **verified** (schválené), **all** (vše)
- Admin může článek schválit nebo smazat

### Moje články (`/moje-clanky`)

- Autor vidí své koncepty a publikované články
- Filtry podle stavu
- Možnost editovat nebo smazat vlastní článek

### Vyhledávání (`/hledat`)

Fulltext hledání přes články (viz také sekce [20. Vyhledávání](#20-vyhledávání)).

---

## 6. Fórum

### 5 sekcí

| Sekce | Popis |
|---|---|
| Obecná diskuze | Volná konverzace o čemkoliv kolem modelové železnice |
| Recenze & doporučení | Hodnocení produktů, obchodů, materiálů |
| Poradna | Otázky a odpovědi, pomoc začátečníkům |
| Novinky ze světa | Novinky z průmyslu, veletrhy, nové modely |
| Moje kolejiště | Prezentace vlastních kolejišť s fotkami a parametry |

### URL struktura

| Stránka | URL |
|---|---|
| Přehled fóra | `/forum` |
| Sekce | `/forum/[section-slug]` |
| Vlákno | `/forum/[section-slug]/[thread-id]` |
| Nové vlákno | `/forum/nove-vlakno` |

### Funkce

- **Reakce** na příspěvky
- **Citování** — odpověď s citací původního příspěvku
- **Moderace:** pin (připnout), lock (zamknout), skrýt, nahlásit, ban uživatele

### Sekce "Moje kolejiště"

Speciální sekce s rozšířenými možnostmi:
- **Multi-image upload** — nahrání více fotek najednou
- **Strukturovaná pole** — rozměry, měřítko, použitý systém atd.

### Admin moderace

| Stránka | URL | Popis |
|---|---|---|
| Nahlášené příspěvky | `/forum/nahlasene` | Přehled nahlášeného obsahu |
| Bany | `/forum/bany` | Správa zabanovaných uživatelů |

---

## 7. Galerie

| Stránka | URL |
|---|---|
| Seznam alb | `/galerie` |
| Detail alba | `/galerie/[id]` |

### Funkce

- **Fotky** — nahrávání a prohlížení fotografií
- **Videa** — upload videí
- **YouTube embedy** — vložení YouTube videí do alba
- **Lightbox** — fullscreen prohlížení s navigací
- **Masonry grid** — responzivní rozložení fotek v mřížce

### Správa

- Admin může nahrávat a mazat obsah
- Přístupová práva na úrovni jednotlivých alb

---

## 8. Akce (Kalendář)

**URL:** `/akce`

### Vytváření akcí

- **Název** — název akce/události
- **Datum** — ve formátu českého data
- **Místo** — lokace konání
- **Popis** — detailní popis akce
- **Obrázek** — ilustrační fotka

### Přístupová práva

Akce mohou vytvářet registrovaní uživatelé, admin je může moderovat.

---

## 9. Soutěž — Kolejiště měsíce

### URL

| Stránka | URL |
|---|---|
| Přehled soutěží | `/soutez` |
| Detail soutěže | `/soutez/[id]` |
| Přihlášení kolejiště | `/soutez/prihlasit` |

### Průběh

1. Uživatel přihlásí své kolejiště (fotky, popis, parametry)
2. Komunita hlasuje
3. Admin vyhodnotí vítěze

### Databáze

3 tabulky pro správu soutěží, přihlášek a hlasů.

### Design

Ikony: **pohár** (vítěz) + **lokomotiva** (soutěžící kolejiště).

---

## 10. Bazar (C2C marketplace)

### URL struktura

| Stránka | URL |
|---|---|
| Přehled inzerátů | `/bazar` |
| Detail inzerátu | `/bazar/[id]` |
| Nový inzerát | `/bazar/novy` |
| Úprava inzerátu | `/bazar/[id]/upravit` |
| Moje inzeráty | `/bazar/moje` |
| Zprávy | `/bazar/zpravy` |

### Databáze

4 tabulky:
- `listings` — inzeráty
- `bazar_messages` — interní zprávy mezi kupujícím a prodávajícím
- `seller_reviews` — hodnocení prodejců
- `watchdogs` — hlídací psi na nové inzeráty

### Filtry

- **Kategorie** — typ zboží
- **Měřítko** — H0, TT, N, Z a další
- **Stav** — nové, použité, poškozené
- **Cena** — rozsah od–do
- **Fulltext** — hledání v názvu a popisu
- **Třídění** — dle data, ceny, relevance

### Funkce

- **Drag & drop fotky** — max 8 fotografií na inzerát
- **Interní zprávy** — komunikace přes bazar bez sdílení kontaktů
- **Hodnocení prodejců** — recenze po dokončeném obchodu
- **Hlídací pes (watchdog)** — notifikace na nové inzeráty dle kritérií
- **Duplikování inzerátu** — rychlé vytvoření nového inzerátu z existujícího

### Platební metody

Checkboxy — prodejce vybere, co akceptuje:
- Hotovost
- Bankovní převod
- Dobírka
- Escrow (bezpečná platba)

### Další funkce

- **Lokace** → automatický odkaz na Google Maps
- **Responsivní tlačítka** — 2×2 grid na mobilních zařízeních

### Informační stránky bazaru

| Stránka | URL |
|---|---|
| Bezpečná platba | `/bazar/bezpecna-platba` |
| Jak to funguje | `/bazar/jak-to-funguje` |
| Podmínky escrow | `/bazar/podminky-escrow` |

---

## 11. Bezpečná platba (Escrow)

> 📄 **Kompletní dokumentace escrow systému je v [ESCROW-MANUAL.md](./ESCROW-MANUAL.md).**

### Stručný přehled

- **14 stavů** transakce (od vytvoření po dokončení/spor)
- **6 cronů** — všechny spouštěné přes master cron `daily-jobs`
- **FIO integrace** — automatické párování plateb z FIO banky
- **ShieldTrack** — ověření důvěryhodnosti protistrany
- **Provize** — 5 % z částky transakce

### Admin

| Sekce | URL |
|---|---|
| Escrow transakce | `/admin/escrow` |
| Platby | `/admin/platby` |

---

## 12. Shop (B2C e-shop)

### URL struktura

| Stránka | URL |
|---|---|
| Katalog produktů | `/shop` |
| Detail produktu | `/shop/[slug]` |
| Moje nákupy | `/shop/moje` |
| Oblíbené | `/shop/oblibene` |
| Košík | `/kosik` |
| Pokladna | `/pokladna` |
| Přehled objednávek | `/objednavky` |
| Detail objednávky | `/objednavka/[orderNumber]` |

### Databáze

3 tabulky:
- `shop_products` — produkty
- `shop_orders` — objednávky
- `user_purchases` — záznamy o nákupech uživatele

### Kategorie a filtry

- **Hierarchické kategorie** — stromová struktura (`buildCategoryTree`)
- Filtry: hledání (search), kategorie, měřítka (scales), cenové rozmezí (price), zdarma (free), třídění (sort)

### Produkty

- **Digitální produkty** — automatický download
  - Zdarma → okamžité stažení
  - Placené → stažení po dokončení objednávky

### Objednávky

- Čísla objednávek ve formátu: **LKP-YYYY-XXXX** (např. LKP-2026-0042)
- **QR platba** — generovaný QR kód pro bankovní převod

### Kupóny a věrnostní program

- Slevové kupóny aplikovatelné v pokladně
- Věrnostní body za nákupy (viz [13. Věrnostní program](#13-věrnostní-program))

### Admin: `/admin/shop`

- **Produkty** — CRUD operace, upload souborů, varianty produktů
- **Objednávky** — správa statusů objednávek
- **Kategorie** — správa hierarchie kategorií
- **Kupóny** — vytváření a správa slevových kupónů
- **Doprava** — nastavení způsobů dopravy
- **Platby** — přehled přijatých plateb

---

## 13. Věrnostní program

**URL:** `/vernostni-program`

### Jak funguje

- **Body za nákupy** — za každý nákup v shopu uživatel získá věrnostní body
- **Úrovně** — systém `LoyaltyLevel` s progresivními benefity
- **Hodnota bodů** — body mají definovanou hodnotu v Kč, lze je uplatnit na slevu

### Historie bodů

Uživatel vidí přehled získaných a čerpaných bodů s daty a důvody.

---

## 14. Ke stažení

**URL:** `/ke-stazeni`

### Kategorie souborů

| Kategorie | Popis |
|---|---|
| Kolejové plány | Plány tratí a kolejišť |
| STL modely | 3D modely pro tisk |
| 3D tisk | Návody a šablony pro 3D tisk |
| Návody | Postupy, tutoriály, manuály |
| Software | Programy a utility pro modeláře |
| Ostatní | Vše co se nevejde jinam |

### Technické detaily

- **Force download** — stahování přes blob (prohlížeč soubor stáhne místo otevření)
- **SVG ikony** — dle typu souboru (PDF, ZIP, STL, atd.)
- **Upload s validací** — kontrola povolených MIME typů a přípon souborů

---

## 15. Kamera — YouTube Live

**URL:** `/kamera`

### Funkce

- Nadpis **"Kolejiště LIVE 🔴"**
- Klikací YouTube náhled — po kliknutí se spustí live stream
- Stream pochází z Tomova PC

### Technický stack

```
RTSP (kamera) → FFmpeg → RTMP → YouTube Live
```

FFmpeg běží na lokálním PC a přeposílá RTSP stream z kamery jako RTMP do YouTube Live.

### Admin: `/admin/kamera`

- **go2rtc stream náhled** — živý náhled ze streamu
- Připojení přes **WSS (WebSocket Secure) přes Cloudflare tunnel**

---

## 16. Další stránky

| URL | Název | Popis |
|---|---|---|
| `/o-projektu` | O projektu | Představení Lokopolis — 10 položek "Co tu najdete" |
| `/kontakt` | Kontakt | Kontaktní informace |
| `/podporte-nas` | Podpořte nás | QR kód pro finanční podporu (SPD formát, FIO účet) |
| `/pravidla` | Pravidla komunity | Pravidla chování a používání platformy |
| `/links` | Užitečné odkazy | Odkazy na zajímavé zdroje pro modeláře |
| `/ochrana-udaju` | Ochrana osobních údajů | GDPR a zásady zpracování dat |
| `/obchodni-podminky` | Obchodní podmínky | Právní podmínky používání služeb |

---

## 17. Admin panel (`/admin`)

Přístup pouze pro uživatele s rolí `admin`. Celkem **9 sekcí:**

### 1. 🏠 Homepage (`/admin/homepage`)

Toggle 18 sekcí homepage — každá sekce má checkbox pro zapnutí/vypnutí. Změny se projeví okamžitě na hlavní stránce.

### 2. 📋 Menu (`/admin/menu`)

Toggle 9 položek navigace — možnost skrýt libovolnou položku z hlavního menu.

### 3. 🛒 Shop (`/admin/shop`)

Kompletní správa e-shopu:
- **Produkty** — vytváření, editace, mazání, upload souborů, varianty
- **Objednávky** — přehled objednávek, změna statusů
- **Kategorie** — hierarchická správa kategorií
- **Kupóny** — slevové kódy
- **Doprava** — nastavení dopravních metod
- **Platby** — přehled přijatých plateb

### 4. 📝 Články (`/admin/clanky`)

Moderování článků:
- Filtry: **pending** (čekající), **verified** (schválené), **all** (vše)
- Schvalování článků jedním klikem
- Mazání nevhodného obsahu

### 5. 👥 Zákazníci

Přehled registrovaných uživatelů:
- Seznam všech uživatelů
- Počty objednávek na uživatele
- Celková útrata

### 6. 📧 Šablony

E-mailové šablony s editovatelnými texty:
- **email** — běžné notifikace
- **invoice** — fakturační šablony
- **legal** — právní dokumenty

### 7. 🛡️ Escrow (`/admin/escrow`)

Správa escrow transakcí a sporů. Kompletní dokumentace → [ESCROW-MANUAL.md](./ESCROW-MANUAL.md).

### 8. 💳 Platby (`/admin/platby`)

- Přijaté platby — přehled příchozích transakcí
- Výplaty — správa výplat prodejcům
- FIO payout — automatické výplaty přes FIO API

### 9. 🖼️ Bannery (`/admin/bannery`)

Správa reklamních bannerů:
- **CRUD operace** — vytváření, editace, mazání
- **4 pozice** — hero_leaderboard, article_native, bazar_native, sidebar_native
- **Upload** — nahrání grafiky banneru
- **CTR statistiky** — sledování prokliků
- **Plánování** — `starts_at` / `ends_at` pro časově omezené kampaně

---

## 18. Banner systém

### 4 pozice bannerů

| Pozice | Umístění |
|---|---|
| `hero_leaderboard` | Hlavní banner na homepage v horní části |
| `article_native` | Nativní banner v seznamu článků |
| `bazar_native` | Nativní banner v seznamu inzerátů bazaru |
| `sidebar_native` | Banner v postranním panelu |

### BannerCarousel

Komponenta pro rotaci bannerů:
- **Random start** — při načtení stránky začne na náhodném banneru
- **Auto fade** — automatické přepínání po 6 sekundách
- **Pause on hover** — při najetí myší se rotace pozastaví
- **Dot indikátory** — tečky pod karuselem ukazují pozici a umožňují přepnutí

### Admin

Správa v `/admin/bannery` — viz [sekce 17.9](#9-🖼️-bannery-adminbannery).

---

## 19. Instagram Post Helper

### Funkce

- **Generování karuselových postů** — z článků na Lokopolis se automaticky vygenerují slidy pro Instagram karusel
- **Hashtagy modal** — dialogové okno s doporučenými hashtagy pro kopírování

---

## 20. Vyhledávání

**URL:** `/hledat`

Fulltext vyhledávání napříč celou platformou:
- **Články** — hledání v názvech a textech článků
- **Fórum** — hledání ve vláknech a příspěvcích
- **Bazar** — hledání v inzerátech

---

## 21. Technická dokumentace

### Stack

| Technologie | Verze / Detail |
|---|---|
| **Next.js** | 16.1.7 |
| **TypeScript** | Striktní typování |
| **Tailwind CSS** | v4 |
| **Supabase** | Backend, DB, Auth, Storage |

### Hosting

| Služba | Detail |
|---|---|
| **Vercel** | `lokopolis-app.vercel.app` |
| **Doména** | `lokopolis.cz` |
| **Supabase** | `https://ekfywlfnhmhcxxvyahmz.supabase.co` |

### Design systém

CSS variables pro konzistentní vzhled:
- `--bg-card` — pozadí karet
- `--accent` — akcentová barva (`#f0a030`)
- `--text-primary` — primární barva textu
- a další

Tmavý a světlý theme se přepíná na úrovni CSS třídy na `<html>` elementu.

### Obrázky

Obrázky servírované ze Supabase Storage s optimalizací:

```
?width=X&height=Y&resize=contain&quality=75
```

### Autentizace

- **Supabase Auth** — registrace a přihlášení přes email + heslo
- Admin kontrola: `profiles.role === "admin"`

---

## 22. Environment variables (Vercel)

| Proměnná | Účel |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase projektu (veřejná) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anonymní klíč Supabase (veřejný) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role klíč Supabase (server-side) |
| `FIO_API_TOKEN` | API token pro FIO banku |
| `FIO_API_BASE` | Základní URL FIO API |
| `SHIELDTRACK_API_KEY` | API klíč pro ShieldTrack službu |
| `SHIELDTRACK_API_URL` | URL ShieldTrack API |
| `OPENAI_API_KEY` | API klíč pro OpenAI (Instagram helper, aj.) |
| `CRON_SECRET` | Secret pro ověření cron volání |
| `NEXT_PUBLIC_SITE_URL` | Veřejná URL webu (lokopolis.cz) |

---

## 23. Crony

### Master cron

Jediný cron job na celé platformě:

```
/api/escrow/daily-jobs
```

- **Spouštění:** každý den v **8:00 UTC**
- **Princip:** volá 6 dílčích jobů **sekvenčně** (jeden po druhém)
- Ověřen přes `CRON_SECRET`

### Detail jobů

Kompletní dokumentace všech 6 jobů, jejich účelu a logiky je v **[ESCROW-MANUAL.md](./ESCROW-MANUAL.md)**.

---

*Poslední aktualizace: 22. března 2026*
