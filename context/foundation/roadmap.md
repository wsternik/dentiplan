---
project: DentiPlan
version: 1
status: draft
created: 2026-05-25
updated: 2026-09-05
prd_version: 1
main_goal: low-complexity
top_blocker: decisions
---

# Roadmap: DentiPlan

> Derived from `context/foundation/prd.md` (v1) + auto-researched codebase baseline + `tech-stack.md` + `infrastructure.md` + `deploy-plan.md`.
> Edit-in-place; archive when superseded.
> Slices below are listed in dependency order. The "At a glance" table is the index.

## Vision recap

DentiPlan przekształca półustrukturyzowany wpis diagnozy dentystki (np. `Do leczenia: 17,16... Kanałowe: 34,37,36, (32?) Kamień do usunięcia`) w czytelny dla pacjenta plan leczenia z dwoma porównywalnymi kosztorysami: standardowym (kilka wizyt) oraz w narkozie (jedna sesja). Dentystka po konsultacji wkleja surowy tekst, weryfikuje wstępnie wypełniony formularz, zatwierdza — i otrzymuje kopiowalny link `/p/<token>`, który po otwarciu pokazuje pacjentowi obie warianty side-by-side. Niezagospodarowana nisza w polskim rynku stomatologicznym: istniejące systemy gabinetowe celują w dokumentację medyczną, nie w prezentację dla pacjenta.

## North star

**S-01: Dentystka generuje pierwszy realny link `/p/<token>` (od ręcznie wpełnionego formularza do strony pacjenta z dwoma wariantami).** Bez tej ścieżki end-to-end hipoteza produktu (side-by-side standard vs. narkoza jako narzędzie sprzedażowe gabinetu) nie jest udowodniona — wszystkie pozostałe slice'y dodają wartość warunkową na jej osnowie.

> "North star" = najmniejsza ścieżka end-to-end, której pomyślne wdrożenie udowadnia podstawową hipotezę produktu; plasujemy ją tak wcześnie, jak pozwalają zależności, bo wszystko inne ma sens dopiero po niej.

## At a glance

| ID   | Change ID                         | Outcome (user can …)                                                                                                                                 | Prerequisites | PRD refs                                                                                                                                                                                                                                                                                     | Status   |
| ---- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| F-01 | quotes-data-foundation            | (foundation) schemat domeny (quote, tooth, visit, general-item, e-mail, snapshot, token) gotowy w Supabase z RLS                                     | —             | FR-050, FR-051, FR-070, FR-072, Access Control                                                                                                                                                                                                                                               | done     |
| F-02 | pricelist-seed-foundation         | (foundation) cennik gabinetu zdefiniowany jako seed w repo, z flagą `local-anesthesia` per pozycja                                                   | —             | FR-025, FR-026, FR-029, FR-041                                                                                                                                                                                                                                                               | done     |
| S-01 | first-thin-quote-and-patient-link | dentystka wkleja diagnozę, ręcznie wypełnia formularz, zatwierdza i otrzymuje link `/p/<token>`, który pokazuje pacjentowi dwa warianty side-by-side | F-01, F-02    | US-01, US-02, FR-001, FR-002, FR-003, FR-010, FR-013, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031, FR-032, FR-040, FR-041, FR-042, FR-043, FR-044, FR-050, FR-051, FR-052, FR-053, FR-060, FR-061, FR-062, FR-063, FR-064, FR-065, FR-066 | done     |
| S-02 | llm-parsing-prefill               | dentystka wkleja diagnozę i formularz dostaje wstępnie wypełnione pola z parsowania LLM                                                              | S-01          | FR-011, FR-012                                                                                                                                                                                                                                                                               | done     |
| S-03 | admin-quote-list                  | dentystka przegląda listę swoich kosztorysów, otwiera drafty do edycji, widzi e-maile odbiorców                                                      | S-01          | FR-070, FR-071, FR-072                                                                                                                                                                                                                                                                       | done     |
| S-04 | rodo-retention-enforcement        | link `/p/<token>` po 12 miesiącach od utworzenia zwraca "Link nieaktywny lub nieprawidłowy", e-mail pacjenta jest usuwany z rekordu                  | S-01          | NFR: Data retention & ochrona danych osobowych                                                                                                                                                                                                                                               | proposed |
| S-05 | auth-hardening                    | dentystka ma chronioną sesję (timeout 8h, ochrona przed credential stuffingiem, brak account lockout po 3 pomyłkach)                                 | —             | NFR: Privacy & security                                                                                                                                                                                                                                                                      | ready    |

## Streams

Navigation aid — groups items that share a Prerequisites chain. Canonical ordering still lives in the dependency graph below; this table is the proposed reading order across parallel tracks.

| Stream | Theme                | Chain                                      | Note                                                                                               |
| ------ | -------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| A      | Wzdłuż gwiazdy       | `F-01` → `S-01` → `S-02` / `S-03` / `S-04` | Główny ciąg do north star i jego rozszerzeń; `S-02`, `S-03`, `S-04` są względem siebie równoległe. |
| B      | Konfiguracja cennika | `F-02` → dołącza do Stream A na `S-01`     | Niezależna decyzja seedu cennika; gotowa równolegle do `F-01`.                                     |
| C      | Twardnienie auth     | `S-05`                                     | Hardening bazowego scaffoldu — niezależny od reszty, można robić w dowolnym momencie.              |

## Baseline

What's already in place in the codebase as of `2026-05-25` (auto-researched + user-confirmed via `deploy-plan.md` and direct inspection).
Foundations below assume these are present and do NOT re-scaffold them.

- **Frontend:** present — Astro 6 SSR + React 19 islands + Tailwind 4 + shadcn/ui ("new-york"); pages w `src/pages/` (`index.astro`, `dashboard.astro`, `auth/{signin,signup,confirm-email}.astro`); jeden komponent UI shadcn (`button.tsx`).
- **Backend / API:** present — Astro endpointy w `src/pages/api/auth/{signin,signout,signup}.ts`; brak innych endpointów domenowych.
- **Data:** absent — Supabase project jest skonfigurowany (`SUPABASE_URL` / `SUPABASE_KEY` jako secrets na produkcji), ale `supabase/migrations/` nie istnieje; brak schematu domenowego (quote, tooth, visit, snapshot).
- **Auth:** present — Supabase SSR z cookie sessions (`src/lib/supabase.ts`), middleware (`src/middleware.ts`) chroniący trasy z `PROTECTED_ROUTES`, endpoint `signin/signout/signup`. KV namespace `dentiplan-production-session` powiązany jako `SESSION`. Polityka haseł i hashing — po stronie Supabase (per tech-stack.md).
- **Deploy / infra:** present — wdrożone na Cloudflare Workers jako worker `dentiplan-production` (PoP: WAW), `wrangler.jsonc` z `nodejs_compat`, CI w `.github/workflows/ci.yml` (lint + build + auto-deploy `main` → prod, bez staging). Custom domain — nie skonfigurowana. Patrz `deploy-plan.md`.
- **Observability:** absent — brak Sentry / Logflare / Axiom / OTel; logi wyłącznie przez `wrangler tail` + Workers Observability MCP (per infrastructure.md). Świadomie poza scope MVP.

## Foundations

### F-01: Schemat domeny kosztorysów w Supabase

- **Outcome:** (foundation) schemat encji domenowych (quote, tooth, visit, general-item, e-mail pacjenta, snapshot cennika, token) jest zmigracjowany w Supabase z politykami RLS; typy w `src/types.ts` zsynchronizowane.
- **Change ID:** quotes-data-foundation
- **PRD refs:** FR-050 (snapshot na approval), FR-051 (token ≥ 128 bit entropii), FR-070 (lista kosztorysów dentystki), FR-072 (e-mail pacjenta przy kosztorysie), Access Control (1 dentystka jako jedyny operator)
- **Unlocks:** S-01, S-02 (LLM parsing zapisuje do tej samej struktury), S-03 (lista kosztorysów), S-04 (retencja działa na tej strukturze)
- **Prerequisites:** —
- **Parallel with:** F-02, S-05
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Najwcześniejszy fundament, bo każdy slice domenowy go używa; źle dobrana granica draftu vs. zatwierdzonego (immutable snapshot wymagany przez FR-053) wymusi późniejszą migrację. Konserwatywna decyzja: snapshot cennika trzymany inline (jsonb) w wierszu quote, żeby zatwierdzony rekord był samowystarczalny — zmiany cennika nie zmieniają historycznych kosztorysów.
- **Status:** done

### F-02: Cennik gabinetu jako seed w repo

- **Outcome:** (foundation) pełny cennik Dentiny (nazwa pozycji, cena punktowa lub `cenaMin`–`cenaMax`, flaga `local-anesthesia` per pozycja) zdefiniowany jako JSON w repozytorium, ładowany przy budowaniu/deploy; UI edycji cennika świadomie odroczone na v2.
- **Change ID:** pricelist-seed-foundation
- **PRD refs:** FR-025 (pozycje cennikowe per ząb), FR-026 (widełki sumują się jako widełki), FR-029 (pozycje ogólne), FR-041 (auto-skip pozycji `local-anesthesia` w planie narkozowym)
- **Unlocks:** S-01 (cały rachunek standardowy i narkozowy referuje pozycje z tego cennika)
- **Prerequisites:** —
- **Parallel with:** F-01, S-05
- **Blockers:** Potrzebny komplet cen i flag `local-anesthesia` od dentystki — komunikacyjny, nie techniczny.
- **Unknowns:**
  - Czy częstotliwość zmian cennika w gabinecie jest na tyle niska, że "redeploy na zmianę cennika" jest akceptowalny przez dentystkę? (PRD Open Q #2) — Owner: dentystka. Block: no (default seed wystarcza do startu; gdyby okazało się to uciążliwe, S-01 nie blokuje — dodajemy UI cennika jako nowy slice w v1.5).
- **Risk:** Brak UI cennika to świadomy scope-cut (shape-notes Phase 3); ryzyko = dentystka prosi o często aktualizowane ceny i każda zmiana wymaga PR-a. Mitigacja: pierwszy seed konsultowany z dentystką, dokumentacja "jak zmienić cenę" w README dla niej (jednoosobowy gabinet, akceptowalne).
- **Status:** done

## Slices

### S-01: Pierwsza realna ścieżka end-to-end (north star)

- **Outcome:** dentystka loguje się do panelu `/admin`, otwiera nowy kosztorys, wkleja surowy tekst diagnozy do textarea, ręcznie wypełnia formularz (typ pacjenta, per-ząb: typ zabiegu, pilność, status `in-plan`/`uncertain`/`out-of-current-plan`, pozycje cennikowe, notatka; pozycje ogólne; przypisanie do wizyt dla `in-plan`), zatwierdza — i otrzymuje kopiowalny link `/p/<token>`, który po otwarciu w drugiej przeglądarce pokazuje pacjentowi: pogrupowaną listę zębów, sekcję "Odroczone" dla `out-of-current-plan`, sekcję "Scenariusze, które mogą zmienić koszt" dla `uncertain`, porównanie side-by-side wariantu standardowego (wizyty + sumy) i wariantu w narkozie (jedna sesja + opłata wg reguły, rekomendowany), oraz niedające się ukryć zastrzeżenie o szacunkowości.
- **Change ID:** first-thin-quote-and-patient-link
- **PRD refs:** US-01, US-02, FR-001, FR-002, FR-003, FR-010, FR-013, FR-020, FR-021, FR-022, FR-023, FR-024, FR-025, FR-026, FR-027, FR-028, FR-029, FR-030, FR-031, FR-032, FR-040, FR-041, FR-042, FR-043, FR-044, FR-050, FR-051, FR-052, FR-053, FR-060, FR-061, FR-062, FR-063, FR-064, FR-065, FR-066
- **Prerequisites:** F-01, F-02
- **Parallel with:** —
- **Blockers:** —
- **Unknowns:**
  - Medyczne potwierdzenie reguły auto-skip `local-anesthesia` dla planu narkozowego (PRD Open Q #3) — Owner: dentystka. Block: no (implementacja zgodna z FR-041 może iść do przodu; walidacja przed pokazaniem prawdziwym pacjentom — patrz `## Open Roadmap Questions`).
  - Czy w UI formularza i na stronie pacjenta dodajemy dodatkową sygnalizację uzębienia mieszanego (badge/ikonka), czy wystarczą nazwy zębów z numerem (PRD Open Q #4)? — Owner: dentystka. Block: no.
  - Finalna nazwa statusu wyświetlana pacjentowi dla `out-of-current-plan` — default v1 "Odroczone" (PRD Open Q #5) — Owner: dentystka. Block: no.
- **Risk:** Najszerszy slice w roadmapie — pokrywa większość must-have FRs, bo north star wymaga rzeczywiście kompletnej ścieżki end-to-end (admin + patient). Próba dalszego podziału (np. admin osobno, patient osobno) tworzy slice'y, których pojedyncze ukończenie nie udowadnia niczego — admin daje link, który prowadzi do 404, patient renderuje pusty mock. `/10x-plan` na tym slice'ie powinien podzielić pracę wewnętrznie na podzadania, nie jako osobne slice'y roadmapy. Tokeny generowane przez `crypto.getRandomValues` (≥ 128 bit) — nie przez DB sequence.
- **Status:** done

### S-02: LLM pre-fills the form from raw diagnosis text

- **Outcome:** dentystka wkleja surowy tekst diagnozy do textarea i system wysyła **wyłącznie ten tekst** do wybranego dostawcy LLM (bez żadnych identyfikatorów pacjenta) z prośbą o ustrukturyzowane wyjście (lista zębów, proponowany typ zabiegu per ząb, proponowane wizyty dla planu standardowego, pozycje ogólne, znaczniki niepewności typu `(32?)` → `uncertain`); wynik walidowany przeciw schemie wstępnie wypełnia formularz z S-01; nierozpoznane terminy i poza-zakresowe numery zębów są pokazywane jako ostrzeżenia na formularzu; dentystka nadal zatwierdza manualnie (LLM nigdy nie blokuje zatwierdzenia — gdy padnie, formularz jest wypełnialny ręcznie od zera).
- **Change ID:** llm-parsing-prefill
- **PRD refs:** FR-011, FR-012
- **Prerequisites:** S-01
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - ~~**Wybór dostawcy LLM**~~ — **rozstrzygnięte 2026-09-05: Anthropic przez AI SDK** (`ai` + `@ai-sdk/anthropic`), model `claude-sonnet-5`, `generateText` + `Output.object`. Powód i odrzucone alternatywy w `tech-stack.md` §LLM provider; ten sam stos, którym repo już mówi w `scripts/review/agent.ts`. Zamyka PRD Open Q #12. Block: **no**.
  - Konkretny schemat walidacji wyjścia LLM (zestaw walidatorów typu "nieznane terminy", "out-of-range numer zęba", "ambiguous marker") — PRD Open Q #8. — Owner: implementacja. Block: no (domyślny zestaw z FR-012 wystarcza do startu; iteracyjne udoskonalanie po pierwszych realnych wpisach).
  - Czy prompt zna polskie synonimy nazw zabiegów ("Kanałowe" = "endodoncja" = "leczenie kanałowe") czy oczekujemy że dentystka używa tylko terminów z listy — shape-notes Open Q #13. — Owner: implementacja. Block: no.
- **Risk:** Każdy slice w którym LLM jest enhancement — nie hard dependency — projektujemy z fallbackiem "formularz wypełnialny ręcznie" (FR-013). Klient LLM trzymamy za cienkim adapterem w `src/lib/llm/` (per infrastructure.md Risk: AI Gateway lock-in), żeby zmiana dostawcy była zmianą jednego pliku. Brak PII w prompt jest egzekwowany strukturalnie (nigdy nie wysyłamy pól typu `patient_email`).
- **Status:** done — zrealizowane 2026-09-05 jako `llm-parsing-prefill`. Adapter w `src/lib/llm/` (schemat, prompt z żywego cennika, czyste mapowanie, klient za interfejsem), endpoint `POST /api/admin/quotes/parse`, przycisk „Wypełnij z notatki" w edytorze. Ostrzeżenia FR-012 pokazywane na formularzu; awaria LLM to komunikat i ręczny formularz (FR-013). Model nie zapisuje pola `note` — patrz `docs/reference/contract-surfaces.md`. Nowe ryzyko #7 w `test-plan.md`, pokryte testami jednostkowymi na nagranych odpowiedziach modelu.

### S-03: Admin quote list with email reference

- **Outcome:** dentystka widzi w panelu `/admin` listę wszystkich swoich kosztorysów (identyfikator, e-mail odbiorcy, data utworzenia, status `draft`/`approved`), klika dowolny żeby otworzyć — drafty są edytowalne, zatwierdzone są read-only (zgodnie z FR-053); może zapisać e-mail pacjenta przy kosztorysie do własnej referencji (nigdy nie wysyłany do LLM, nigdy nie widoczny na stronie pacjenta).
- **Change ID:** admin-quote-list
- **PRD refs:** FR-070, FR-071, FR-072
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-04
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Bez tej listy panel admin po S-01 jest "trial bez historii" — dentystka generuje link i potem nie wie do kogo poszedł. Ten slice domyka panel admin do realnie używalnego stanu. Risk: lista bez paginacji jest OK przy małej skali (PRD: ~kilkadziesiąt kosztorysów rocznie); paginacja wchodzi w v2 jeśli realna skala rośnie.
- **Status:** done

### S-04: 12-month retention enforcement

- **Outcome:** dla każdego zatwierdzonego kosztorysu po 12 miesiącach od daty utworzenia: link `/p/<token>` zwraca generyczny komunikat "Link nieaktywny lub nieprawidłowy" (bez ujawnienia, czy taki kosztorys kiedykolwiek istniał — zgodnie z FR-060), pole `patient_email` w rekordzie kosztorysu jest wymazane; sam kosztorys może być zachowany w formie zanonimizowanej (decyzja w Open Roadmap Q poniżej).
- **Change ID:** rodo-retention-enforcement
- **PRD refs:** NFR: Data retention & ochrona danych osobowych (12 mies. od `dataUtworzenia`)
- **Prerequisites:** S-01
- **Parallel with:** S-02, S-03
- **Blockers:** Potwierdzenie podstawy prawnej i wybór "kosztorys usuwany vs. anonimizowany" — od prawnika RODO i dentystki (patrz `## Open Roadmap Questions`).
- **Unknowns:**
  - Czy default 12 mies. TTL tokena jest OK, czy dentystka chce krótszy domyślny TTL z możliwością przedłużenia (PRD Open Q #1)? — Owner: dentystka. Block: no.
  - Czy kosztorys po retencji ma być usunięty całkowicie, czy zanonimizowany do celów analitycznych gabinetu (PRD Open Q #6, składnik)? — Owner: dentystka + prawnik RODO. Block: no dla implementacji (możemy zacząć od "delete całkowicie" jako default i dodać "anonimizuj" jako tryb konfiguracyjny gdy będzie decyzja); yes dla publicznego startu.
- **Risk:** Mechanizm wygaszania można zaimplementować jako scheduled job (Cloudflare Cron Trigger) albo lazy check on read; lazy check on read jest prostszy dla MVP (sprawdzamy timestamp przy każdym hicie `/p/<token>` i odpowiednio zwracamy 404; cleanup e-maila jako oddzielny daily job). Bez tego slice'a aplikacja narusza RODO przy pierwszym pacjencie, dla którego minął rok — czyli ten slice jest hard launch-gate na produkcję z prawdziwymi pacjentami.
- **Status:** proposed

### S-05: Auth hardening

- **Outcome:** sesja dentystki wylogowuje się automatycznie po ustalonym okresie nieaktywności (default v1: 8h); rozproszone próby zgadywania hasła (credential stuffing) są odrzucane zanim dotrą do warstwy auth (rate limiting / WAF rule); konto NIE jest blokowane po 3 ręcznych pomyłkach (zgodnie z NFR — chcemy chronić przed atakami, nie blokować jedynej dentystki).
- **Change ID:** auth-hardening
- **PRD refs:** NFR: Privacy & security (credential stuffing odrzucany przed weryfikacją, brak account lockout po 3 pomyłkach, ustalony timeout nieaktywności)
- **Prerequisites:** —
- **Parallel with:** F-01, F-02, S-01, S-02, S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Timeout sesji dentystki — po jakim czasie nieaktywności wylogować (PRD Open Q #7). Default v1: 8h. — Owner: dentystka. Block: no.
- **Risk:** Baseline (Supabase + KV sessions) załatwia hashing haseł i ważność sesji "out of the box"; ten slice dodaje tylko trzy rzeczy: konfigurację TTL sesji, rate limiting per IP/email (Cloudflare WAF rule lub middleware-side counter w KV) oraz świadomą decyzję "nie blokujemy konta po N pomyłkach". Można zrobić niezależnie od reszty, w dowolnym momencie. Risk: rate limiting po stronie middleware z KV ma eventual consistency (per infrastructure.md Risk #5); dla jednego użytkownika to nie problem, ale do udokumentowania w runbooku.
- **Status:** ready

## Backlog Handoff

| Roadmap ID | Change ID                         | Suggested issue title                                                       | Ready for `/10x-plan` | Notes                                                                                      |
| ---------- | --------------------------------- | --------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| F-01       | quotes-data-foundation            | Domain schema for quotes/teeth/visits/snapshot in Supabase with RLS         | yes                   | Run `/10x-plan quotes-data-foundation` — odblokuje wszystkie cztery slice'y                |
| F-02       | pricelist-seed-foundation         | Seed gabinet's pricelist as repo-config JSON with `local-anesthesia` flag   | yes                   | Run `/10x-plan pricelist-seed-foundation` — równolegle z F-01; potrzebne dane od dentystki |
| S-01       | first-thin-quote-and-patient-link | First end-to-end quote flow: paste → form → approve → patient link          | no                    | Czeka na F-01 i F-02. Najszerszy slice; `/10x-plan` podzieli wewnętrznie na podzadania.    |
| S-02       | llm-parsing-prefill               | LLM pre-fills the new-quote form from pasted diagnosis text                 | done                  | Zrealizowany 2026-09-05. Archiwum: `context/archive/…-llm-parsing-prefill/`.               |
| S-03       | admin-quote-list                  | Admin can browse, open, and tag quotes with the patient's e-mail            | no                    | Czeka na S-01.                                                                             |
| S-04       | rodo-retention-enforcement        | Enforce 12-month retention: token returns "nieaktywny", e-mail scrubbed     | no                    | Czeka na S-01. Decyzja "usuń vs. anonimizuj" przed launch (Open Roadmap Q #3).             |
| S-05       | auth-hardening                    | Auth hardening: session timeout, credential-stuffing protection, no lockout | yes                   | Run `/10x-plan auth-hardening` — równolegle do wszystkiego.                                |

## Open Roadmap Questions

> Pytania, które przekraczają zakres pojedynczego slice'a albo blokują launch (nie implementację) całej aplikacji. Pytania per-slice zostają w slice'ach.

1. ~~**Wybór dostawcy LLM (OpenAI / Anthropic / OpenRouter / lokalny model)**~~ — **zamknięte 2026-09-05: Anthropic przez AI SDK** (`ai` + `@ai-sdk/anthropic`, `claude-sonnet-5`, `generateText` + `Output.object`). Kryteria spełnione: strukturyzowane wyjście walidowane Zodem (FR-012), koszt ułamka grosza per request, brak PII w prompcie egzekwowany sygnaturą `parseDiagnosis(text: string)`. Uzasadnienie i odrzucone alternatywy: `tech-stack.md` §LLM provider. — `S-02` odblokowany.
2. **Medyczne potwierdzenie reguły auto-skip pozycji `local-anesthesia` w planie narkozowym (FR-041).** Czy żadne lokalne znieczulenie nie jest podawane uzupełniająco w narkozie? Błędne założenie → zafałszowany kosztorys narkozowy. PRD Open Q #3. — Owner: dentystka. Block: `S-01` przed pokazaniem prawdziwym pacjentom (implementacja może iść do przodu zgodnie z FR-041).
3. **Retencja danych pacjenta i podstawa prawna RODO** — default v1: 12 mies. od `dataUtworzenia`, e-mail usuwany razem z kosztorysem, kosztorys usuwany lub anonimizowany; podstawa prawna: zgoda pacjenta przy konsultacji. PRD Open Q #6. — Owner: dentystka + prawnik RODO. Block: `S-04` przed publicznym startem (implementacja default może iść do przodu).

## Parked

> Wszystkie pozycje świadomie poza scope v1, zgodnie z PRD `## Non-Goals` i shape-notes Phase 3.

- **Multi-tenant SaaS dla wielu gabinetów** — Why parked: PRD §Non-Goals; v1 obsługuje wyłącznie Dentinę. Drugi gabinet = osobna instancja.
- **Natywne aplikacje mobilne / desktop** — Why parked: PRD §Non-Goals; tylko web responsywny.
- **Integracja z systemami dokumentacji medycznej (Estomed, Dentiplus, NFZ)** — Why parked: PRD §Non-Goals; tekst diagnozy wkleja się ręcznie.
- **Płatności online / billing pacjenta** — Why parked: PRD §Non-Goals; płatność dzieje się offline w gabinecie.
- **Diagnostyka / decyzje medyczne wspomagane AI** — Why parked: PRD §Non-Goals; aplikacja nie jest wyrobem medycznym, LLM tylko parsuje tekst dentystki.
- **Historia pacjenta / kartoteka** — Why parked: PRD §Non-Goals; każdy kosztorys istnieje osobno.
- **Wersjonowanie kosztorysu pod tym samym tokenem** — Why parked: PRD §Non-Goals i FR-053; edycja = nowy kosztorys + nowy token.
- **Powiadomienia push / SMS / e-mail do pacjenta z aplikacji** — Why parked: PRD §Non-Goals; link kopiuje dentystka ręcznie.
- **Twarde progi performance (p95)** — Why parked: PRD §NFR "Świadomie pominięte"; akceptujemy co wyjdzie z naturalnego stacku.
- **Pełna zgodność WCAG-AA** — Why parked: PRD §NFR; minimalny rozsądek wizualny tak, audyt — nie w v1.
- **High availability / multi-region SLA** — Why parked: PRD §Non-Goals; downtime w nocy = OK.
- **Certyfikacja medyczna (CE / wyrób medyczny)** — Why parked: PRD §Non-Goals; aplikacja jest narzędziem prezentacyjno-rachunkowym.
- **Graficzna wizualizacja SVG łuków zębowych z hover-sync** — Why parked: PRD §Non-Goals "Odroczone na v2"; substytuowane przez listę pogrupowaną (FR-061).
- **Drag-and-drop zębów między wizytami** — Why parked: PRD §Non-Goals "Odroczone na v2"; substytuowane przez dropdown "Wizyta nr [N]" (FR-030).
- **Automatyczna wysyłka e-maili z aplikacji** — Why parked: PRD §Non-Goals "Odroczone na v2"; dentystka kopiuje link manualnie (FR-052).
- **UI edycji cennika w panelu admin** — Why parked: PRD §Non-Goals "Odroczone na v2"; cennik jako seed JSON w repo (F-02).
- **Tryb "zdefiniuj osobny zestaw zabiegów dla narkozy"** — Why parked: PRD §Non-Goals "Odroczone na v2"; default = kopia ze standardowego z auto-skip `local-anesthesia` (FR-041).
- **Osobne TTL tokena niezależne od retencji kosztorysu** — Why parked: PRD §Non-Goals "Odroczone na v2"; token żyje tyle co kosztorys (12 mies.).
- **CTA dla pacjenta ("wybierz wariant", "umów wizytę")** — Why parked: PRD §Non-Goals "Odroczone na v2"; strona pacjenta w v1 jest wyłącznie informacyjna.
- **Obserwability dedykowany (Sentry / OTel / logflare)** — Why parked: świadome wykluczenie z main_goal=low-complexity; logi via `wrangler tail` i Workers Observability MCP wystarczają dla MVP 1-dentysty (per infrastructure.md).
- **Środowisko staging i manualna bramka deploy na prod** — Why parked: dev wybrał production-only w pierwszym deploy (per deploy-plan.md "Decisions explicitly deferred"); wraca jako decyzja przed udostępnieniem realnym pacjentom.
- **Custom domain dla worker'a** — Why parked: per deploy-plan.md, prod aktualnie pod `dentiplan-production.wsternik.workers.dev`; podpięcie custom domain dopiero przed publicznym startem.

## Done

- **F-01: (foundation) schemat domeny (quote, tooth, visit, general-item, e-mail, snapshot, token) gotowy w Supabase z RLS** — Archived 2026-06-03 → `context/archive/2026-06-03-quotes-data-foundation/`. Lesson: —.
- **F-02: (foundation) cennik gabinetu zdefiniowany jako seed w repo, z flagą `local-anesthesia` per pozycja** — Archived 2026-06-04 → `context/archive/2026-06-03-pricelist-seed-foundation/`. Lesson: —.
- **S-01: dentystka wkleja diagnozę, ręcznie wypełnia formularz, zatwierdza i otrzymuje link `/p/<token>`, który pokazuje pacjentowi dwa warianty side-by-side** — Archived 2026-09-04 → `context/archive/2026-06-04-first-thin-quote-and-patient-link/`. Lesson: —.
- **S-03: dentystka widzi w panelu `/admin` listę wszystkich swoich kosztorysów, otwiera drafty do edycji, widzi e-maile odbiorców** — Archived 2026-09-04 → `context/archive/2026-09-04-admin-quote-list/`. Lesson: —.
- **S-02: dentystka wkleja diagnozę i formularz dostaje wstępnie wypełnione pola z parsowania LLM** — Archived 2026-09-05 → `context/archive/2026-09-05-llm-parsing-prefill/`. Lesson: wyjście modelu to dane od klienta pod inną nazwą — schemat pilnuje kształtu, kod pilnuje znaczenia; a pole, którego model nie może zapisać, jest mocniejszą gwarancją niż prompt, który mu tego zabrania.
