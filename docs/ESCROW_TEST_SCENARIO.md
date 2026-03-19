# 🧪 Escrow — Kompletní testovací scénář

## Příprava

### Potřebuješ:
- **2 účty** — Admin (Tom) + testovací uživatel (např. "TestProdejce")
- **Testovací uživatel** musí mít vyplněný bankovní účet v profilu (`/ucet` → Bankovní údaje)
- **Escrow zapnutý** — `escrow_settings.escrow_enabled = 'true'`
- **Bank account v settings** — `escrow_settings.bank_account` (účet Lokopolis pro příjem)
- **Admin payout account** — `escrow_settings.admin_payout_account` (účet pro provize)
- **FIO_API_TOKEN** v Vercel env vars (pro test FIO exportu)

### Nastavení (escrow_settings):
| Klíč | Výchozí | Popis |
|------|---------|-------|
| `commission_rate` | `5` | Provize v % |
| `min_commission` | `15` | Minimální provize v Kč |
| `payment_deadline_hours` | `24` | Lhůta na zaplacení (h) |
| `shipping_deadline_days` | `5` | Lhůta na odeslání (dny) |
| `confirmation_deadline_days` | `7` | Lhůta na potvrzení doručení (dny) |
| `auto_complete_days` | `14` | Automatické dokončení po odeslání (dny) |
| `bank_account` | — | Bankovní účet Lokopolis (formát `123456/0100`) |
| `bank_iban` | — | IBAN Lokopolis |
| `admin_payout_account` | — | Účet pro výplatu provizí |

---

## Scénář A: Šťastná cesta (happy path)

Kompletní průchod od vytvoření inzerátu po výplatu.

### 1. Vytvoření inzerátu
- **Kdo:** TestProdejce
- **Kde:** `/bazar/novy`
- **Co:** Vyplnit název, popis, cenu (např. 500 Kč), fotky, kategorie, měřítko
- **Ověř:** Inzerát se zobrazuje v `/bazar`

### 2. Kupující klikne "Koupit s ochranou"
- **Kdo:** Admin (jako kupující)
- **Kde:** `/bazar/{id}` → tlačítko bezpečné platby
- **Co:** Vytvoří se escrow transakce
- **API:** `POST /api/escrow/create` → `{ listing_id }`
- **Ověř:**
  - ✅ Stav: `created`
  - ✅ Zobrazí se platební údaje (číslo účtu, VS, QR kód)
  - ✅ Provize se vypočítala správně (5% z 500 = 25 Kč, min 15 Kč)
  - ✅ `seller_payout` = cena − provize = 475 Kč
  - ✅ Email kupujícímu s platebními instrukcemi
  - ✅ Transakce viditelná v `/bazar/transakce`

### 3. Kupující zaplatí
Dvě varianty:

#### 3a. Automatické spárování (FIO sync)
- **Kdo:** Automaticky (cron) nebo admin ručně
- **API:** `POST /api/escrow/fio-sync`
- **Ověř:**
  - ✅ Platba se spáruje podle VS
  - ✅ Záznam v `escrow_bank_payments`
  - ✅ Stav escrow: `created` → `paid`

#### 3b. Ruční potvrzení adminem
- **Kdo:** Admin
- **Kde:** `/admin/platby` (záložka "Přijaté platby") nebo `/admin/escrow`
- **API:** `POST /api/escrow/confirm-payment` → `{ escrow_id }`
- **Ověř:**
  - ✅ Stav: `created` → `paid`
  - ✅ Email prodávajícímu: "Platba přijata, odešlete zboží"
  - ✅ Email kupujícímu: "Platba potvrzena"

### 4. Prodávající odešle zboží
- **Kdo:** TestProdejce
- **Kde:** `/bazar/transakce/{id}`
- **Co:** Klikne "Odesláno" + zadá sledovací číslo zásilky
- **API:** `POST /api/escrow/ship` → `{ escrow_id, tracking_number?, carrier? }`
- **Ověř:**
  - ✅ Stav: `paid` → `shipped`
  - ✅ Email kupujícímu: "Zásilka odeslána"
  - ✅ Sledovací číslo zobrazeno v detailu transakce

### 5. Kupující potvrdí doručení
- **Kdo:** Admin (jako kupující)
- **Kde:** `/bazar/transakce/{id}`
- **Co:** Klikne "Potvrzuji doručení"
- **API:** `POST /api/escrow/confirm-delivery` → `{ escrow_id }`
- **Ověř:**
  - ✅ Stav: `shipped` → `completed`
  - ✅ Email prodávajícímu: "Kupující potvrdil, výplata bude odeslána"
  - ✅ Transakce se objeví v `/admin/platby` → "Platby k odeslání"

### 6. Admin odešle výplatu přes FIO
- **Kdo:** Admin
- **Kde:** `/admin/platby` → záložka "Platby k odeslání"
- **Co:**
  1. Zaškrtne checkbox u dokončené transakce
  2. Klikne "📤 Odeslat do FIO"
  3. Zkontroluje modal (výplata prodávajícímu 475 Kč + provize 25 Kč)
  4. Klikne "✅ Potvrdit a odeslat"
- **API:** `POST /api/escrow/fio-payout` → `{ escrow_ids: [...] }`
- **Ověř:**
  - ✅ Stav: `completed` → `payout_sent`
  - ✅ FIO API přijalo XML
  - ✅ 2 platební příkazy: seller payout + provize
  - ✅ V modalu zelený výsledek "✅ OK"

### 7. Admin potvrdí odeslání výplaty
- **Kdo:** Admin
- **Kde:** `/admin/platby` → filtr "Odesláno"
- **Co:** Klikne "✅ Výplata potvrzena"
- **API:** `POST /api/escrow/confirm-payout` → `{ escrow_id }`
- **Ověř:**
  - ✅ Stav: `payout_sent` → `payout_confirmed`
  - ✅ Email prodávajícímu: "Výplata odeslána na váš účet"

### 8. Kupující ohodnotí prodávajícího
- **Kdo:** Admin (jako kupující)
- **Kde:** `/bazar/transakce/{id}`
- **API:** `POST /api/escrow/review` → `{ escrow_id, rating, comment }`
- **Ověř:**
  - ✅ Hodnocení se uloží
  - ✅ Zobrazuje se u prodávajícího

---

## Scénář B: Částečná platba

### 1–2. Stejné jako Scénář A (vytvoření inzerátu + escrow)

### 3. Kupující pošle jen část
- **Kdo:** Admin
- **API:** `POST /api/escrow/partial-payment` → `{ escrow_id, partial_amount: 200 }`
- **Ověř:**
  - ✅ Stav: `created` → `partial_paid`
  - ✅ `partial_amount` = 200
  - ✅ Email kupujícímu: "Přijata částečná platba, doplaťte zbývajících 300 Kč"
  - ✅ QR kód na doplatek

### 4. Kupující doplatí zbytek
- **API:** `POST /api/escrow/confirm-payment` → `{ escrow_id }`
- **Ověř:**
  - ✅ Stav: `partial_paid` → `paid`
  - ✅ Pokračuje standardní flow (odeslání → doručení → výplata)

---

## Scénář C: Spor (dispute)

### 1–5. Stejné jako Scénář A (až po odeslání)

### 5. Kupující reklamuje
- **Kdo:** Admin (jako kupující)
- **Kde:** `/bazar/transakce/{id}`
- **API:** `POST /api/escrow/dispute` → `{ escrow_id, reason: "Zboží neodpovídá popisu" }`
- **Ověř:**
  - ✅ Stav: `shipped` → `disputed`
  - ✅ Email oběma stranám + adminovi
  - ✅ Transakce se objeví v admin panelu s důvodem sporu

### 6. Admin vyřeší spor
- **Kdo:** Admin
- **API:** `POST /api/escrow/resolve` → `{ escrow_id, resolution: "refund" | "release" | "partial", amount?: number }`
- **Ověř:**
  - ✅ Při `refund`: stav → `refunded`, peníze zpět kupujícímu
  - ✅ Při `release`: stav → `completed`, výplata prodávajícímu
  - ✅ Při `partial`: částečná náhrada

---

## Scénář D: Automatické dokončení

### 1–4. Stejné jako Scénář A (až po odeslání)

### 5. Kupující nepotvrdí doručení (čeká se `auto_complete_days` dní)
- **Simulace:** V DB změň `shipped_at` na datum 15 dní zpět
  ```sql
  UPDATE escrow_transactions
  SET shipped_at = NOW() - INTERVAL '15 days'
  WHERE id = '{escrow_id}';
  ```
- **Spusť cron:** `POST /api/escrow/auto-complete`
- **Ověř:**
  - ✅ Stav: `shipped` → `auto_completed`
  - ✅ Email kupujícímu: "Transakce automaticky dokončena"
  - ✅ Email prodávajícímu: "Výplata bude odeslána"
  - ✅ Transakce se objeví v "Platby k odeslání"

---

## Scénář E: Zrušení transakce

### 1–2. Stejné jako Scénář A

### 3. Admin zruší transakci
- **Kdo:** Admin
- **API:** `POST /api/escrow/cancel` → `{ escrow_id }`
- **Ověř:**
  - ✅ Stav: `created` → `cancelled`
  - ✅ Lze zrušit jen ve stavu `created` nebo `partial_paid`
  - ✅ Inzerát se vrátí do původního stavu

---

## Scénář F: Hold (pozastavení)

### Po zaplacení:
- **API:** `POST /api/escrow/hold` → `{ escrow_id }`
- **Ověř:**
  - ✅ Stav → `hold`
  - ✅ Transakce zamrzne — žádné akce ani auto-complete
  - ✅ Admin může obnovit

---

## Scénář G: FIO sync + Admin platby

### Test automatického párování
1. V Supabase vytvoř testovací escrow transakci (stav `created`, payment_reference `ESC-2026-1234`)
2. Zavolej `/api/escrow/fio-sync` (pokud je FIO token nastaven a na účtu jsou platby)
3. **Ověř:** Záložka "Přijaté platby" v `/admin/platby`:
   - ✅ Platba se zobrazuje
   - ✅ Pokud VS odpovídá → `matched = true`, `processing_status = paid`
   - ✅ Pokud neodpovídá → `processing_status = new`

### Test ručního přiřazení
1. Najdi nepřiřazenou platbu
2. Klikni "Přiřadit k inzerátu"
3. Vyber escrow transakci
4. **Ověř:** Platba se přiřadila, stav escrow se aktualizoval

### Test označení platby
1. Najdi nepřiřazenou platbu
2. Klikni "Označit jako…" → vyber status (neidentifikovaná / duplicitní / jiné)
3. **Ověř:** Status se změnil, platba se přesunula z "K řešení"

---

## Scénář H: Foto verifikace zásilky

### Po odeslání:
- **API:** `POST /api/escrow/verify-photo` → `{ escrow_id, photo_url }`
- **Ověř:**
  - ✅ AI analyzuje fotku zásilky
  - ✅ Výsledek uložen v transakci
  - ✅ Admin vidí výsledek verifikace

---

## Checklist pro produkci

- [ ] `escrow_settings.bank_account` vyplněn (účet Lokopolis)
- [ ] `escrow_settings.bank_iban` vyplněn
- [ ] `escrow_settings.admin_payout_account` vyplněn (účet pro provize)
- [ ] `FIO_API_TOKEN` nastaven ve Vercel env vars
- [ ] `CRON_SECRET` nastaven ve Vercel env vars (pro auto-complete cron)
- [ ] SQL migrace 050 spuštěna
- [ ] Testovací prodávající má vyplněný bankovní účet v profilu
- [ ] Emaily odcházejí správně (zkontrolovat SMTP/Resend nastavení)
- [ ] Provize se počítá správně (5%, min 15 Kč)

---

## Přehled stavů

```
created ──→ partial_paid ──→ paid ──→ shipped ──→ delivered ──→ completed ──→ payout_sent ──→ payout_confirmed
   │              │                      │              │
   │              │                      └──→ disputed ──→ refunded
   │              │                                       ──→ completed (resolve: release)
   └──→ cancelled └──→ cancelled
                                         └──→ auto_completed ──→ payout_sent ──→ payout_confirmed
                                    
   * Z jakéhokoli stavu → hold (admin)
```

---

*Poslední aktualizace: 2026-03-19*
