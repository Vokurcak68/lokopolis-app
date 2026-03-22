# 🛡️ Bezpečná platba (Escrow) — Kompletní manuál

## Obsah

1. [Přehled systému](#1-přehled-systému)
2. [Životní cyklus transakce](#2-životní-cyklus-transakce)
3. [Stavy transakce](#3-stavy-transakce)
4. [Lhůty a automatické akce](#4-lhůty-a-automatické-akce)
5. [Crony (automatizované úlohy)](#5-crony-automatizované-úlohy)
6. [E-mailové notifikace](#6-e-mailové-notifikace)
7. [Admin panel](#7-admin-panel)
8. [Nastavení (escrow_settings)](#8-nastavení-escrow_settings)
9. [FIO banka — integrace](#9-fio-banka--integrace)
10. [ShieldTrack — integrace](#10-shieldtrack--integrace)
11. [Stránky a URL](#11-stránky-a-url)
12. [API endpointy](#12-api-endpointy)
13. [Databázové tabulky](#13-databázové-tabulky)
14. [SQL migrace](#14-sql-migrace)
15. [Env vars (Vercel)](#15-env-vars-vercel)
16. [Řešení problémů](#16-řešení-problémů)

---

## 1. Přehled systému

Bezpečná platba je C2C escrow systém pro Lokopolis bazar. Peníze kupujícího jsou drženy na escrow účtu, dokud nepotvrdí přijetí zboží nebo neuplyne automatická lhůta.

**Základní princip:**
```
Kupující zaplatí → Peníze na escrow účtu → Prodávající odešle → Kupující potvrdí → Peníze uvolněny prodávajícímu
```

**Provize:** 5 % z ceny (min. 15 Kč), konfigurovatelné v admin nastavení.

---

## 2. Životní cyklus transakce

```
┌─────────┐    platba    ┌──────┐   odeslání   ┌─────────┐   doručení   ┌───────────┐   potvrzení   ┌───────────┐
│ created │ ──────────→ │ paid │ ──────────→ │ shipped │ ──────────→ │ delivered │ ──────────→ │ completed │
└─────────┘              └──────┘              └─────────┘              └───────────┘              └───────────┘
     │                      │                                                │                         ▲
     │ částečná platba      │                                                │ auto (14d)               │
     ▼                      │                                                ▼                         │
┌──────────────┐            │                                          ┌────────────────┐              │
│ partial_paid │ ───────────┘                                          │ auto_completed │ ─────────────┘
└──────────────┘                                                       └────────────────┘

Vedlejší stavy:
  cancelled — zrušeno (nezaplaceno / neodesláno / manuálně)
  disputed  — kupující otevřel spor
  refunded  — peníze vráceny kupujícímu
  hold      — admin pozastavil výplatu
  payout_sent      — výplata odeslána
  payout_confirmed — výplata potvrzena
```

### Krok za krokem:

1. **Kupující** klikne „Koupit přes Bezpečnou platbu" na inzerátu
2. Zaškrtne souhlas s podmínkami (zobrazeny dynamické lhůty)
3. Zadá dodací adresu → transakce vytvořena (`created`)
4. Obdrží QR kód pro platbu (SPD formát, variabilní symbol z `payment_reference`)
5. FIO sync napáruje platbu → status `paid` (nebo `partial_paid`)
6. Prodávající obdrží e-mail „Odešlete zboží do X dní"
7. Prodávající označí jako odesláno + tracking číslo → `shipped`
8. ShieldTrack ověří zásilku, při doručení → `delivered`
9. Kupující potvrdí přijetí → `completed` → výplata prodávajícímu
10. Nebo po 14 dnech → `auto_completed`

---

## 3. Stavy transakce

| Stav | Popis | Kdo mění |
|------|-------|----------|
| `created` | Vytvořeno, čeká na platbu | Systém |
| `partial_paid` | Přijata částečná platba | FIO sync cron |
| `paid` | Plně zaplaceno | FIO sync cron |
| `shipped` | Odesláno prodávajícím | Prodávající |
| `delivered` | Doručeno (ShieldTrack nebo manuálně) | ShieldTrack / Admin |
| `completed` | Kupující potvrdil přijetí | Kupující |
| `auto_completed` | Automaticky dokončeno po 14 dnech | auto-complete cron |
| `cancelled` | Zrušeno | Cron / Admin |
| `disputed` | Spor otevřen kupujícím | Kupující |
| `refunded` | Peníze vráceny | Admin |
| `hold` | Výplata pozastavena adminem | Admin |
| `payout_sent` | Výplata odeslána do banky | Admin |
| `payout_confirmed` | Výplata potvrzena | Admin |

---

## 4. Lhůty a automatické akce

| Lhůta | Nastavení | Default | Co se stane po uplynutí |
|-------|-----------|---------|------------------------|
| **Platba** | `payment_deadline_hours` | 24h | Cron zruší transakci (+24h grace period), listing zpět active |
| **Odeslání** | `shipping_deadline_days` | 5 dní | Reminder 24-48h před. Po deadline (+24h grace): zrušení, listing zpět, admin notifikován pro refund |
| **Potvrzení** | `confirmation_deadline_days` | 7 dní | Soft deadline — reminder kupujícímu. Žádné automatické akce |
| **Auto-complete** | `auto_complete_days` | 14 dní | Transakce automaticky dokončena, peníze uvolněny prodávajícímu |

### Timeline upomínek po doručení:

```
Den 0:  📬 E-mail "Zásilka doručena, potvrďte do 7 dní"
Den 5-7: ⏰ 1. reminder "Zbývá X dní, potvrďte nebo otevřete spor"
Den 13:  🚨 Finální varování "Zítra proběhne auto-uvolnění platby" (přesné datum)
Den 14:  ✅ Auto-complete → peníze prodávajícímu
```

---

## 5. Crony (automatizované úlohy)

Všechny crony jsou v `vercel.json` a volají se jednou denně (UTC):

| Čas (UTC) | Endpoint | Funkce |
|-----------|----------|--------|
| **08:00** | `/api/escrow/fio-sync` | Napáruje platby z FIO banky dle VS |
| **08:30** | `/api/escrow/expire-unpaid` | Zruší nezaplacené transakce (`created`/`partial_paid`) po `payment_deadline_hours` + 24h grace |
| **09:00** | `/api/escrow/shipping-reminder` | Upozorní prodávajícího 24-48h před deadline odeslání |
| **09:30** | `/api/escrow/expire-unshipped` | Zruší neodeslaná (`paid`) po `shipping_deadline_days` + 24h grace. Listing zpět active. E-mail admin pro refund |
| **10:00** | `/api/escrow/delivery-reminder` | Wave 1 (den 5-7): upomínka kupujícímu. Wave 2 (den 13): 🚨 finální varování |
| **10:30** | `/api/escrow/auto-complete` | Dokončí doručené transakce po `auto_complete_days` |

### Pořadí je důležité!
Crony běží sekvenčně s rozestupy 30 minut. FIO sync musí být první (napáruje platby), teprve pak expiry a remindery.

### Vercel cron konfigurace (`vercel.json`):
```json
{
  "crons": [
    { "path": "/api/escrow/fio-sync", "schedule": "0 8 * * *" },
    { "path": "/api/escrow/expire-unpaid", "schedule": "30 8 * * *" },
    { "path": "/api/escrow/shipping-reminder", "schedule": "0 9 * * *" },
    { "path": "/api/escrow/expire-unshipped", "schedule": "30 9 * * *" },
    { "path": "/api/escrow/delivery-reminder", "schedule": "0 10 * * *" },
    { "path": "/api/escrow/auto-complete", "schedule": "30 10 * * *" }
  ]
}
```

### Zabezpečení cronů:
Všechny crony vyžadují `Authorization: Bearer <CRON_SECRET>` header. Vercel ho nastavuje automaticky.

### Duplicate flagy (ochrana proti opakovanému odeslání):
| Flag | Na čem | Účel |
|------|--------|------|
| `shipping_reminder_sent` | `escrow_transactions` | Reminder prodávajícímu o odeslání |
| `delivery_reminder_sent` | `escrow_transactions` | 1. reminder kupujícímu o potvrzení |
| `delivery_final_warning_sent` | `escrow_transactions` | Finální varování den před auto-complete |
| `bank_tx_id` | platby | Idempotence FIO sync |

---

## 6. E-mailové notifikace

### Při vytvoření transakce
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowCreated` | 🛡️ Bezpečná platba vytvořena — QR kód pro platbu |
| Prodávající | `escrowCreatedSeller` | 🛡️ Nová bezpečná platba — čekáme na úhradu |

### Při zaplacení
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowPaidBuyer` | ✅ Platba přijata |
| Prodávající | `escrowPaid` | 💰 Platba přijata — odešlete zboží do X dní |

### Reminder odeslání (24-48h před deadline)
| Komu | Šablona | Předmět |
|------|---------|---------|
| Prodávající | `escrowShippingReminder` | ⚠️ Odešlete zboží — lhůta vyprší [datum] |

### Neodesláno (po deadline)
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowUnshippedBuyer` | ❌ Transakce zrušena — peníze vrátíme |
| Prodávající | `escrowUnshippedSeller` | ❌ Transakce zrušena — neodeslali jste včas |
| Admin | `escrowUnshippedAdmin` | 🔄 REFUND: [ref] — prodávající neodeslal (částka) |

### Při odeslání
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowShipped` | 📦 Zboží odesláno — tracking [číslo] |

### Při doručení
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowDelivered` | 📬 Zásilka doručena — potvrďte do 7 dní |
| Prodávající | `escrowDeliveredSeller` | 📬 Zásilka doručena — čekáme na potvrzení kupujícího |

### Reminder potvrzení (den 5-7)
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowDeliveryReminder` | ⏰ Potvrďte přijetí — zbývá X dní |

### Finální varování (den 13)
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowDeliveryFinalWarning` | 🚨 Poslední den — zítra auto-uvolnění platby |

### Při dokončení
| Komu | Šablona | Předmět |
|------|---------|---------|
| Prodávající | `escrowCompleted` | ✅ Peníze uvolněny |
| Kupující | `escrowCompletedBuyer` | ✅ Transakce dokončena |

### Auto-complete (po 14 dnech)
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowAutoCompleted` (role=buyer) | ✅ Automaticky dokončeno po 14 dnech |
| Prodávající | `escrowAutoCompleted` (role=seller) | ✅ Automaticky dokončeno po 14 dnech |

### Nezaplaceno (po deadline)
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující | `escrowExpiredBuyer` | ❌ Transakce zrušena — nezaplaceno |
| Prodávající | `escrowExpiredSeller` | ℹ️ Kupující nezaplatil |

### Spor
| Komu | Šablona | Předmět |
|------|---------|---------|
| Admin | (notifikace) | ⚠️ Nový spor otevřen |

### ShieldTrack alert
| Komu | Šablona | Předmět |
|------|---------|---------|
| Admin | `escrowVerificationAlert` | ⚠️ Nízké ST skóre |

### Hold
| Komu | Šablona | Předmět |
|------|---------|---------|
| Kupující + Prodávající | (hold email) | ⏸️ Výplata pozastavena + důvod |

---

## 7. Admin panel

### `/admin/escrow` — Přehled transakcí
- 3 skupiny: **K řešení** / **V procesu** / **Ukončeno**
- ShieldTrack verifikační skóre u každé transakce
- Filtry, detail transakce, admin poznámky
- Tlačítka: Potvrdit doručení, Držet (hold), Zrušit, Vrátit peníze

### `/admin/platby` — Správa plateb
- **Přijaté platby** — přehled příchozích plateb z FIO sync
- **Platby k odeslání** — výplaty prodávajícím + provize
- FIO payout export (XML platební příkaz)
- Checkboxy pro výběr + modal s rozpisem

### `/admin/escrow` nastavení
Přístupné přes admin → escrow nastavení:
- Provize (%), minimální provize (Kč)
- Lhůty (platba, odeslání, potvrzení, auto-complete)
- Bankovní účet, IBAN
- Zapnout/Vypnout escrow

---

## 8. Nastavení (escrow_settings)

Tabulka `escrow_settings` v Supabase (key-value):

| Klíč | Default | Popis |
|------|---------|-------|
| `commission_rate` | `5` | Provize v % |
| `min_commission` | `15` | Minimální provize v Kč |
| `payment_deadline_hours` | `24` | Lhůta pro zaplacení (hodiny) |
| `shipping_deadline_days` | `5` | Lhůta pro odeslání (dny) |
| `confirmation_deadline_days` | `7` | Doporučená lhůta pro potvrzení přijetí (dny) — soft |
| `auto_complete_days` | `14` | Hard deadline pro auto-complete (dny od doručení) |
| `bank_account` | — | Číslo escrow bankovního účtu |
| `bank_iban` | — | IBAN escrow účtu |
| `escrow_enabled` | `true` | Globální zapnutí/vypnutí |
| `admin_email` | `info@lokopolis.cz` | Admin e-mail pro notifikace |

### Změna nastavení:
Admin → Escrow → Nastavení, nebo API `PUT /api/escrow/settings` (vyžaduje admin auth).

**⚠️ Změny lhůt se automaticky projeví:**
- V e-mailech (dynamické šablony)
- V modalu kupujícího (checkbox podmínek)
- Ve všech cronech (čtou nastavení při každém běhu)

---

## 9. FIO banka — integrace

### Sync plateb (`/api/escrow/fio-sync`)
- Stahuje pohyby z FIO API za posledních 30 dní
- Páruje dle variabilního symbolu (VS = čísla z `payment_reference`, např. ESC-2026-1234 → VS 20261234)
- Kumulativní přičítání (více plateb = sčítá se)
- Idempotence přes `bank_tx_id`
- Při plné úhradě: status → `paid`, e-mail oběma stranám

### Payout (`/api/escrow/fio-payout`)
- Generuje XML platební příkaz (FIO import formát)
- Dva příkazy na transakci:
  1. Výplata prodávajícímu (cena - provize)
  2. Provize na admin účet
- Admin vybere transakce → generuje se XML → odešle přes FIO API

### FIO API:
- Base URL: `https://fioapi.fio.cz/v1/rest/` (⚠️ NE `www.fio.cz`)
- Token: env var `FIO_API_TOKEN`

---

## 10. ShieldTrack — integrace

### Automatická registrace zásilky
Při odeslání (`ship`) se zásilka automaticky zaregistruje v ShieldTrack.

### Verifikace (7 kontrol, max 105 bodů):
1. Tracking existuje (20b)
2. Zásilka aktivní (15b)
3. Jméno příjemce (15b)
4. Shoda města (15b)
5. Shoda PSČ (10b)
6. Platná časová osa (15b)
7. Potvrzení doručení (15b)

### Auto-delivered:
Pokud ShieldTrack hlásí `delivery_confirmed=pass` → transakce automaticky přejde do `delivered`.

### Skóre alert:
Pokud ST skóre < 40 → admin e-mail + možnost hold.

### Konfigurace:
- `SHIELDTRACK_API_KEY` — env var na Vercel
- `SHIELDTRACK_API_URL` = `https://shieldtrack.lokopolis.cz`

---

## 11. Stránky a URL

### Veřejné:
| URL | Popis |
|-----|-------|
| `/bazar` | Seznam inzerátů |
| `/bazar/[id]` | Detail inzerátu + tlačítko „Koupit přes Bezpečnou platbu" |
| `/bazar/bezpecna-platba` | Informační stránka o escrow |
| `/bazar/jak-to-funguje` | Jak funguje bazar (11 sekcí) |
| `/bazar/podminky-escrow` | Právní podmínky (10 článků) |

### Uživatelské:
| URL | Popis |
|-----|-------|
| `/bazar/transakce` | Moje transakce (kupující i prodávající) |
| `/bazar/transakce/[id]` | Detail transakce (timeline, akce, ShieldTrack skóre) |
| `/bazar/moje` | Moje inzeráty |
| `/bazar/zpravy` | Interní zprávy |

### Admin:
| URL | Popis |
|-----|-------|
| `/admin/escrow` | Přehled všech transakcí |
| `/admin/platby` | Přijaté platby + výplaty |

---

## 12. API endpointy

### Transakce:
| Metoda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/api/escrow/create` | Vytvořit transakci |
| POST | `/api/escrow/cancel` | Zrušit transakci |
| POST | `/api/escrow/ship` | Označit jako odesláno + tracking |
| POST | `/api/escrow/confirm-delivery` | Kupující potvrdí přijetí |
| POST | `/api/escrow/dispute` | Otevřít spor |
| POST | `/api/escrow/resolve` | Vyřešit spor (admin) |
| POST | `/api/escrow/hold` | Pozastavit výplatu (admin) |
| POST | `/api/escrow/review` | Ohodnotit prodávajícího |

### Platby:
| Metoda | Endpoint | Popis |
|--------|----------|-------|
| POST | `/api/escrow/confirm-payment` | Manuální potvrzení platby |
| POST | `/api/escrow/partial-payment` | Zaznamenat částečnou platbu |
| POST | `/api/escrow/bank-payment-update` | Aktualizovat stav platby |
| POST | `/api/escrow/send-payout` | Odeslat výplatu |
| POST | `/api/escrow/confirm-payout` | Potvrdit výplatu |
| POST | `/api/escrow/fio-payout` | Generovat FIO XML příkaz |

### Nastavení:
| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/api/escrow/public-settings` | Veřejné nastavení (provize, lhůty) |
| GET/PUT | `/api/escrow/settings` | Admin nastavení (vyžaduje admin auth) |

### Ostatní:
| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/api/escrow/my-transactions` | Moje transakce |
| POST | `/api/escrow/admin-note` | Admin poznámka |
| POST | `/api/escrow/verify-photo` | GPT-4o Vision analýza fotek |
| GET | `/api/escrow/verification` | ShieldTrack verifikace |
| POST | `/api/escrow/verification-alert` | ST alert webhook |
| GET | `/api/escrow/donation-account` | Účet pro podporu projektu |

### Crony:
| Metoda | Endpoint | Popis |
|--------|----------|-------|
| GET | `/api/escrow/fio-sync` | Sync plateb z FIO |
| GET | `/api/escrow/expire-unpaid` | Zrušit nezaplacené |
| GET | `/api/escrow/shipping-reminder` | Reminder odeslání |
| GET | `/api/escrow/expire-unshipped` | Zrušit neodeslaná |
| GET | `/api/escrow/delivery-reminder` | Reminder potvrzení (2 vlny) |
| GET | `/api/escrow/auto-complete` | Auto-complete doručených |

---

## 13. Databázové tabulky

### `escrow_transactions`
Hlavní tabulka transakcí.

Klíčové sloupce:
- `id` (UUID, PK)
- `listing_id`, `buyer_id`, `seller_id` (FK)
- `status` (enum — viz stavy výše)
- `amount`, `commission`, `commission_rate`
- `payment_reference` (ESC-YYYY-XXXX)
- `tracking_number`, `carrier`
- `delivery_address` (JSONB)
- `paid_at`, `shipped_at`, `delivered_at`, `completed_at`
- `shieldtrack_shipment_id`, `st_score`, `st_alert_sent`
- `shipping_reminder_sent`, `delivery_reminder_sent`, `delivery_final_warning_sent` (boolean flagy)
- `bank_tx_id` (idempotence FIO sync)

### `escrow_settings`
Key-value nastavení (viz sekce 8).

### `escrow_disputes`
Spory — důvod, fotky, řešení.

### `escrow_payments`
Platební záznamy (příchozí platby, výplaty).

---

## 14. SQL migrace

| Číslo | Soubor | Popis |
|-------|--------|-------|
| 035-045 | `035_*.sql` — `045_*.sql` | Základní escrow tabulky, stavy, indexy |
| 050 | `050_*.sql` | Expire-unpaid rozšíření |
| 051 | `051_shipping_reminder_flag.sql` | `shipping_reminder_sent` boolean |
| 052 | `052_delivery_reminder_flag.sql` | `delivery_reminder_sent` boolean |
| 053 | `053_delivery_final_warning_flag.sql` | `delivery_final_warning_sent` boolean |

Všechny migrace uloženy v `supabase/migrations/`.

---

## 15. Env vars (Vercel)

| Proměnná | Popis |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon klíč |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role (server-side) |
| `FIO_API_TOKEN` | FIO banka API token |
| `FIO_API_BASE` | `https://fioapi.fio.cz/v1/rest` |
| `SHIELDTRACK_API_KEY` | ShieldTrack API klíč |
| `SHIELDTRACK_API_URL` | `https://shieldtrack.lokopolis.cz` |
| `OPENAI_API_KEY` | GPT-4o Vision pro foto ověřování |
| `CRON_SECRET` | Ochrana cronů (Vercel nastavuje automaticky) |

---

## 16. Řešení problémů

### Platba se nenápárovala
1. Zkontroluj VS — musí odpovídat `payment_reference` (jen čísla, např. ESC-2026-1234 → 20261234)
2. FIO sync běží denně v 8:00 UTC — můžeš spustit manuálně: `curl -H "Authorization: Bearer $CRON_SECRET" https://lokopolis.cz/api/escrow/fio-sync`
3. Zkontroluj `bank_tx_id` — pokud platba už byla zpracována, nepřičte se znovu

### Prodávající neodeslal
- Systém automaticky upozorní (shipping-reminder) a pak zruší (expire-unshipped)
- Admin obdrží e-mail s výzvou k refundu
- Refund je manuální (FIO neumí automatický refund)

### Kupující nepotvrdil přijetí
- Den 5-7: automatický reminder
- Den 13: finální varování
- Den 14: auto-complete → peníze prodávajícímu
- Kupující může do dne 14 otevřít spor

### ShieldTrack skóre nízké
- Admin obdrží alert e-mail
- Může dát transakci do hold stavu
- Hold zastaví výplatu + e-mail oběma stranám s důvodem

### Cron neběží
- Zkontroluj Vercel dashboard → Cron Jobs
- Hobby plan: max 2 crony zdarma, Pro plan neomezeno
- ⚠️ Na Hobby plánu Vercel povoluje jen 2 crony! Pro 6 cronů je potřeba Pro plán nebo alternativní scheduler.

---

*Poslední aktualizace: 22. března 2026*
