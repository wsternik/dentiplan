---
project: "DentiPlan"
context_type: greenfield
created: 2026-05-24
updated: 2026-05-24
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "persona scope"
      decision: "Tylko 1 gabinet, 1 dentystka. Brak multi-tenant w MVP."
    - topic: "insight (dlaczego jeszcze nie istnieje)"
      decision: "Nisza dwuwariantowych planów (standardowy vs. narkoza) + LLM jako enabler parsowania chaotycznego wpisu diagnozy."
    - topic: "inne persony"
      decision: "Brak. Tylko dentystka (operator) i pacjent (odbiorca linku, bez logowania)."
    - topic: "auth dentystki"
      decision: "E-mail + hasło. Klasyczna sesja."
    - topic: "topologia"
      decision: "Jedna aplikacja, jedna domena. /admin (dentystka), /p/<token> (pacjent)."
    - topic: "scope cuts na v2"
      decision: "v2 przesunięte: wizualizacja SVG szczeki + hover (J), drag-and-drop wizyt (F), wysyłka e-maili (L), UI edycji cennika (B), tryb 'osobny zestaw narkozowy' (G). v1 zachowuje: pozycje widełkowe i status 'poza planem'."
    - topic: "primary success metric"
      decision: "≤ 5 minut od wklejenia diagnozy do wygenerowania linku dla pacjenta (vs. obecne ~15+ min ręcznie)."
    - topic: "secondary success"
      decision: "Brak Secondary w MVP — jedno Primary wystarczy."
    - topic: "guardrails"
      decision: "(1) Brak PII pacjenta w żadnym requesie do LLM. (2) Token pacjenta nieodgadywalny i nieenumerowalny (≥128 bit entropii). (3) Strona pacjenta zawsze pokazuje zastrzeżenie o szacunkowości."
    - topic: "timeline"
      decision: "MVP w 3 tygodniach, tryb pracy: część dnia + after-hours, brak twardego deadline'u."
  frs_drafted: 39
  quality_check_status: accepted
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: false # część dnia + after-hours mix
product_type: web-app
target_scale:
  users: small # 1 dentystka-operator
  qps: low # ~kilka kosztorysów dziennie w szczycie
  data_volume: small # ~kilkadziesiąt kosztorysów rocznie, każdy < 100 KB
---

# DentiPlan — shape-notes

> Źródło: pełny dokument konceptualny dostarczony przez użytkownika 2026-05-24 (Aplikacja: plan leczenia i szacunkowy kosztorys).
> Skill: `/10x-shape` (greenfield). Następny krok łańcucha: `/10x-prd`.

---

## Vision & Problem Statement

Dentystka prowadząca jednoosobowy gabinet stomatologiczny po pierwszej wizycie konsultacyjnej (pantomogram + badanie) wpisuje rozpoznanie do swojego istniejącego systemu dokumentacji medycznej w formie półustrukturyzowanego tekstu (np. `Do leczenia: 17,16,15... Kanałowe: 34,37,36, (32?) Kamień do usunięcia`). Aby przedstawić pacjentowi propozycję leczenia z kosztorysem, musi ten surowy wpis ręcznie przekształcić: zidentyfikować każdy ząb, dobrać pozycje cennikowe, policzyć sumy osobno dla wariantu standardowego (kilka wizyt) i wariantu w narkozie (jedna sesja pod opieką anestezjologa — preferowanego przez gabinet), opisać scenariusze warunkowe i zaprezentować to w czytelnej formie. Koszt dzisiejszy: kilka–kilkanaście minut ręcznej pracy per pacjent, brak spójnej prezentacji porównawczej, ryzyko błędów rachunkowych.

Insight, który czyni ten produkt możliwym dopiero teraz: standardowe polskie systemy gabinetowe (Estomed, Dentiplus itp.) celują w dokumentację medyczną, nie w prezentację dla pacjenta — porównanie dwuwariantowych planów (standard vs. narkoza) jest niszą. Drugi insight: parsowanie chaotycznego wpisu typu `(32?)` lub `Kanałowe: 34,37,36,` regułkami było wcześniej niewykonalne; LLM domyka tę lukę bez konieczności narzucania dentystce sztywnego formatu wprowadzania. Aplikacja nie podejmuje decyzji medycznych — tylko strukturyzuje i prezentuje to, co dentystka już zdiagnozowała.

---

## User & Persona

**Primary persona — Dentystka (jednoosobowy gabinet stomatologiczny)**

Pojedyncza osoba prowadząca gabinet. Robi diagnostykę (pantomogram, badanie kliniczne), wprowadza rozpoznanie do istniejącego systemu dokumentacji medycznej. Po konsultacji potrzebuje szybko (kilka minut, nie kilkanaście) przygotować dla pacjenta czytelny plan leczenia z dwoma wariantami kosztowymi i wysłać go linkiem. Pracuje z gabinetu (desktop/laptop), ale może też dokończyć kosztorys w domu. Zna swój cennik na pamięć dla typowych pozycji; pamięta dwuwariantową logikę narkozową; nie chce uczyć się obsługi skomplikowanego narzędzia.

**Pacjent** — nie jest personą-operatorem w sensie produktu. Otrzymuje link, otwiera stronę, czyta plan i kosztorys. Nie loguje się, nie wprowadza danych, nie ma konta. Decyzja o wyborze wariantu i umówienie kolejnej wizyty dzieje się poza aplikacją (telefon, e-mail, kolejna wizyta).

---

## Access Control

Dwa rozdzielne tryby dostępu w jednej aplikacji, jedna domena:

- **Panel dentystki (`/admin/...`)** — wymaga uwierzytelnienia. Mechanizm: e-mail + hasło, klasyczna sesja. Konto dentystki tworzone ręcznie / przy starcie aplikacji (1 konto na MVP, brak self-service signup). Wylogowanie ręczne i automatyczne po ustalonym okresie nieaktywności (do dopracowania w PRD/Open Questions). Brak ról — pojedynczy operator ma pełne uprawnienia w MVP.
- **Strona pacjenta (`/p/<token>`)** — bez logowania. Dostęp wyłącznie przez nieodgadywalny, kryptograficznie bezpieczny token w URL (nie enumerowalny ID z bazy). Pacjent nigdy nie widzi UI logowania ani panelu admin. Token nie wymaga uwierzytelnienia, ale jest tajemnicą — przekazywany pacjentowi e-mailem.

**Sekrety na granicy systemu:** hasło dentystki (hash + odpowiedni KDF, decyzja stack-stage), token pacjenta (losowy ≥ 128 bit entropii). E-mail pacjenta NIE jest częścią strony pacjenta — jest trzymany tylko po stronie panelu admin i serwera pocztowego.

---

## Success Criteria

### Primary

- **Czas pracy dentystki ≤ 5 minut od wklejenia surowego wpisu diagnozy do wygenerowania linku dla pacjenta** (mierzone od pierwszego paste w `textarea` do kliknięcia "Zatwierdź" i otrzymania kopiowalnego linku). Próg wybrany jako redukcja ~15+ min ręcznej pracy do 1/3. Mierzone subiektywnie przez dentystkę po pierwszych 5–10 pacjentach.

### Secondary

- Brak. MVP utrzymuje pojedyncze, jasne kryterium sukcesu. Cele biznesowe (np. wybór wariantu narkozowego przez większy odsetek pacjentów) wymagałyby telemetrii po stronie pacjenta i CTA, które są poza zakresem v1 (patrz Open Question #6).

### Guardrails

- **Brak PII pacjenta w jakimkolwiek requesie do LLM.** Do LLM trafia wyłącznie tekst diagnozy zębowej. Złamanie = naruszenie RODO i utrata zaufania.
- **Token pacjenta nieodgadywalny i nieenumerowalny** (kryptograficznie bezpieczny, ≥ 128 bit entropii, nie kolejny ID z bazy). Złamanie = wyciek planów leczenia innych pacjentów.
- **Strona pacjenta zawsze zawiera wyraźne, niedające się ukryć zastrzeżenie o szacunkowym charakterze kosztorysu.** Złamanie = ryzyko roszczeń pacjenta typu "na linku było X zł".

### Zakres v1 — scope-cuts zaakceptowane w Phase 3

> Następujące funkcjonalności z dokumentu seed zostały **przesunięte na v2**, żeby zmieścić MVP w 3 tygodniach:

- **Wizualizacja SVG łuków zębowych + hover sync z tabelą** → v1: lista zębów pogrupowana ("górne prawe / górne lewe / dolne prawe / dolne lewe") z numerami pogrubionymi dla zębów w planie.
- **Drag-and-drop przenoszenia zębów między wizytami** → v1: dropdown "Wizyta nr [1/2/3]" przy każdym wierszu zęba + przycisk "Dodaj wizytę".
- **Wysyłka e-maili przez transakcyjnego dostawcę** → v1: po zatwierdzeniu UI pokazuje gotowy link do skopiowania; dentystka wkleja go do własnej poczty. Eliminuje dostawcę transakcyjnego, domenę nadawcy, szablon, deliverability. Pacjent dostaje funkcjonalnie to samo.
- **UI edycji cennika w panelu admin** → v1: cennik jako seed/JSON w repo; zmiana cennika = redeploy. Akceptowalne dla 1 gabinetu z rzadkimi zmianami.
- **Tryb "zdefiniuj osobny zestaw zabiegów dla narkozy"** → v1: plan narkozowy = kopia ze standardowego z pominięciem znieczulenia miejscowego + opłata wg reguły. Wariant "inny zestaw dla narkozy" — v2.

### Zakres v1 — pozostają w MVP (świadomie utrzymane mimo kosztu)

- **Pozycje cennikowe widełkowe** (`cenaMin`–`cenaMax`, np. ekstrakcja 400–600 zł). Sumują się jako widełki na poziomie kosztorysu.
- **Status zęba "poza bieżącym planem"** (trzeci status obok "w planie" i "niepewny") z osobną sekcją na stronie pacjenta.

---

## User Stories

### US-01: Dentystka generuje kosztorys po konsultacji

- **Given** zalogowana dentystka i świeży pacjent zaraz po konsultacji (pantomogram + badanie zostały wykonane, rozpoznanie wpisane do systemu dokumentacji)
- **When** wkleja surowy tekst rozpoznania (np. `Do leczenia: 17,16... Kanałowe: 34,37,36, (32?) Kamień do usunięcia`), weryfikuje wstępnie wypełniony formularz, ustawia typ pacjenta (dziecko/dorosły), poprawia pozycje cennikowe per ząb, oznacza zęby niepewne i poza planem, opcjonalnie układa zęby w wizyty, i klika "Zatwierdź"
- **Then** dostaje na ekranie gotowy do skopiowania link postaci `/p/<token>`, który po otwarciu pokazuje pacjentowi dwuwariantowy plan leczenia i kosztorys

#### Acceptance Criteria

- Cały przepływ od pierwszego wklejenia do skopiowalnego linku ≤ 5 minut (Primary success).
- LLM nigdy nie dostaje żadnych danych identyfikujących pacjenta — tylko tekst rozpoznania.
- Niezatwierdzona praca jest możliwa do porzucenia bez zostawiania śladu na liście kosztorysów (draft state).
- Zatwierdzenie jest jednorazowe i nieodwracalne: zmiana po zatwierdzeniu = nowy kosztorys, nowy token.

### US-02: Pacjent otwiera plan leczenia

- **Given** pacjent dostał od gabinetu link `/p/<token>` (wklejony przez dentystkę do e-maila lub przesłany SMS-em — kanał poza aplikacją w v1)
- **When** otwiera link w przeglądarce na telefonie lub komputerze
- **Then** widzi: listę zębów do leczenia pogrupowaną wg ćwiartek łuku, sekcję "poza bieżącym planem", sekcję "scenariusze, które mogą zmienić koszt", porównanie side-by-side dwóch wariantów (standardowy z podziałem na wizyty vs. narkoza w jednej sesji) z wyróżnieniem wariantu narkozowego jako rekomendowanego, oraz wyraźne zastrzeżenie o szacunkowym charakterze kosztorysu

#### Acceptance Criteria

- Brak danych identyfikujących pacjenta na stronie (żadnego imienia, e-maila, PESEL).
- Token w URL jest nieodgadywalny i nieenumerowalny.
- Strona jest no-index (meta robots) — nie pojawia się w wyszukiwarkach.
- Niepoprawny / nieznany token zwraca generyczny komunikat "Link nieaktywny lub nieprawidłowy" bez ujawniania, czy taki kosztorys w ogóle istniał.
- Strona jest responsywna (telefon + komputer).

---

## Functional Requirements

> 39 FR-ów w 8 grupach. Tag `Priority: must-have` dla wszystkich v1 (zawężony scope eliminuje nice-to-have). FR-y oznaczone `> Socrates:` mają wyzwanie kontr-argumentowe z Phase 4.5; pozostałe są pochodnymi mechanicznymi z wcześniejszych decyzji.

### Authentication & session

- FR-001: Dentystka can sign in to the admin panel using email + password. Priority: must-have
- FR-002: Dentystka can sign out from the admin panel. Priority: must-have
- FR-003: An unauthenticated request to `/admin/*` is redirected to the login page. Priority: must-have

### Diagnosis input & LLM parsing

- FR-010: Dentystka can paste raw diagnosis text into a textarea on the new-quote screen. Priority: must-have
- FR-011: System sends ONLY the diagnosis text to the LLM (no patient identifiers, no e-mail) and receives structured output: list of teeth, proposed treatment type per tooth, proposed visit split for the standard plan, and detected general items (e.g. "kamień" → higienizacja, "pantomogram"). Priority: must-have
  > Socrates: Counter-argument considered: "regułka pokrywa 60–70% wpisów; LLM dodaje niedeterminizm i koszt API." Resolution: utrzymano. Regułka padłaby na `(32?)`, końcowych przecinkach typu `34,37,36,` i swobodnych notatkach typu "Kamień do usunięcia" — czyli na realnych wpisach dentystki. **Dodano warunek**: jeśli LLM padnie lub wynik nie przejdzie walidacji schemy (FR-012), formularz musi być wypełnialny ręcznie od zera — LLM nigdy nie jest blokerem zatwierdzenia.
- FR-012: System validates LLM output against a fixed schema. Unrecognized tokens, ambiguous markers (e.g. `(32?)` → uncertain), and out-of-range tooth numbers are surfaced as warnings on the form rather than auto-dropped or auto-accepted. Priority: must-have
- FR-013: A quote can never be approved without a manual click on "Zatwierdź" by the dentystka, regardless of LLM output confidence. Priority: must-have

### Editable working form (per-quote)

- FR-020: Dentystka can set the patient type (child / adult) once per quote; editable until approval. Priority: must-have
- FR-021: Each tooth row displays its number and a derived name (e.g. "74 — pierwszy trzonowiec mleczny lewy dolny"). The number → name mapping is deterministic and not user-editable. Priority: must-have
- FR-022: The dentition type (milk / permanent) of each tooth is derived from its number (51–85 = milk, 11–48 = permanent) and is not user-editable. Priority: must-have
- FR-023: Dentystka can set the treatment type per tooth from a defined list (extraction / root canal / caries removal / filling / other). Priority: must-have
- FR-024: Dentystka can set the urgency per tooth (urgent / moderate / mild). Priority: must-have
- FR-025: Dentystka can assign one or more pricelist items to each tooth. The tooth cost is the sum of its assigned items. Priority: must-have
- FR-026: Pricelist items with price ranges (`cenaMin`–`cenaMax`) sum as ranges at the tooth and quote level. Priority: must-have
  > Socrates: Counter-argument considered: "pacjent widząc 'plan: 3 400–5 200 zł' poczuje niepewność, lepiej pokazać punkt + notatę". Resolution: utrzymano. Widełki są uczciwe wobec niepewności medycyny i bronią się przed zarzutem "obiecaliście X zł, jest Y" — zgodne z guardrail szacunkowości. Decyzja UX: widełki sumują się, ale UI strony pacjenta unika nagromadzenia "min–max" — np. pokazuje "od 3 400 zł, do 5 200 zł w razie scenariuszy" zamiast jednego ciągu.
- FR-027: Dentystka can set the tooth status to one of three values: `in-plan`, `uncertain`, `out-of-current-plan`. Priority: must-have
  > Socrates: Counter-argument considered: "2 statusy wystarczą — uncertain i out-of-plan niewiele różnią się dla pacjenta". Resolution: utrzymano 3. Semantycznie są różne: `uncertain` wpływa na koszt warunkowo (sekcja scenariuszy FR-063), `out-of-current-plan` jest czysto informacyjny (sekcja FR-062) i nie wpływa na żaden total. Łączenie ich zlikwidowałoby sekcję scenariuszy = utratę informacji dla pacjenta o potencjalnych dopłatach.
- FR-028: Dentystka can attach a free-text note to any tooth (e.g. "może wymagać kanałowego, jeśli próchnica głęboka — +X zł"). Priority: must-have
- FR-029: Dentystka can add, edit, and remove general (non-per-tooth) items (higienizacja, pantomogram, konsultacja). Each general item references a pricelist item. Priority: must-have
  > Socrates: Counter-argument considered: "wystarczy jeden model 'pozycja' z opcjonalnym `nrZeba` (= 'wirtualny ząb 0' dla pozycji ogólnych)". Resolution: utrzymano rozdział. Pozycje ogólne są semantycznie inne (nie mają statusu, urgency, treatment type, dentition) — 'ząb 0' przeciekłby do UI jako rzeczywisty wiersz lub wymagałby filtra. Czystszy model danych, koszt: jedna sekcja więcej w formularzu.

### Visit planning (standard plan)

- FR-030: Dentystka can assign each `in-plan` tooth to a visit number via a dropdown (`Wizyta nr 1 / 2 / 3 …`). `out-of-current-plan` and `uncertain` teeth are not assigned to visits. Priority: must-have
- FR-031: Dentystka can add and remove visits in the standard plan. Priority: must-have
  > Socrates: Counter-argument considered: "sztywne 1–3 wizyty wystarczą — dropdown w 3 opcjach, prostsze UI". Resolution: utrzymano elastyczność. Plany z 8+ zębami u dorosłego wymagają realnie 4–5 wizyt; ograniczenie wymusiłoby workaround typu "wciśnij dwa kanałowe w jedną wizytę", co fałszuje plan. Koszt: dwa przyciski w UI ("dodaj wizytę", "usuń wizytę") i renumeracja przy usuwaniu.
- FR-032: Each visit displays its partial cost (sum of teeth assigned to it + general items if associated with that visit). Priority: must-have

### Cost calculation rules

- FR-040: Standard plan total = sum of pricelist items for all teeth marked `in-plan` + general items. Teeth marked `uncertain` do not contribute to the base total but are displayed as conditional add-on scenarios. Teeth marked `out-of-current-plan` do not contribute to any total. Priority: must-have
- FR-041: Anesthesia plan default content = copy of in-plan tooth treatment items from the standard plan, **with pricelist items flagged in the pricelist as `local-anesthesia` automatically excluded**, plus general items if applicable, plus the calculated anesthesia fee. Always one session. Priority: must-have
  > Socrates: Counter-argument considered: "ręczne usuwanie znieczulenia miejscowego raz na kosztorys = mniej schema, mniej kodu". Resolution: utrzymano auto-skip. Kosztorys regenerowany przy każdym pacjencie; ręczne usuwanie 5–15 pozycji per kosztorys × N pacjentów rocznie szybko przekracza koszt jednej flagi w cenniku. Flaga `local-anesthesia` konfigurowana w cenniku (seed JSON v1) raz.
- FR-042: Anesthesia base fee = 1400 PLN if all teeth in the anesthesia plan are milk teeth; 2000 PLN if at least one permanent tooth is included. Priority: must-have
- FR-043: Anesthesia base fee receives +100 PLN per tooth above 5, counted from teeth in the anesthesia plan. Priority: must-have
- FR-044: Teeth marked `out-of-current-plan` do not count toward the anesthesia tooth count, the anesthesia fee, or any cost total. Priority: must-have

### Pricelist snapshot & approval

- FR-050: On quote approval, the system captures a snapshot of the active pricelist into the quote record. Subsequent pricelist edits do not change already-approved quotes. Priority: must-have
- FR-051: Quote approval generates a cryptographically secure, non-enumerable token (≥ 128 bits of entropy) used as the patient URL path segment. Priority: must-have
- FR-052: After approval, the admin UI displays the patient URL (`/p/<token>`) in a copy-friendly format for the dentystka to send manually (no automated e-mail in v1). Priority: must-have
- FR-053: An approved quote is read-only. Editing requires creating a new quote (new snapshot, new token); the original remains intact and accessible by its original token. Priority: must-have
  > Socrates: Counter-argument considered: "dentystka zechce poprawić literówkę po wysłaniu — zmuszanie do nowego linku frustrujące". Resolution: utrzymano read-only. Eliminuje klasę bugów "co pacjent widział wczoraj vs. dzisiaj" i upraszcza prawnie. Workflow: regeneracja kosztorysu, nowy link, pacjent dostaje "wersja zaktualizowana — proszę użyć nowego linku" mailem (kanał poza aplikacją w v1). Stary link aktywny = forensic snapshot.

### Patient view (public, token-only)

- FR-060: A request to `/p/<token>` with a valid, active token returns the patient view. An invalid, unknown, or revoked token returns a generic "Link nieaktywny lub nieprawidłowy" page with no information disclosure (no leak of whether such a token ever existed). Priority: must-have
- FR-061: The patient view displays a grouped tooth list (`górne prawe`, `górne lewe`, `dolne prawe`, `dolne lewe`) for teeth marked `in-plan`, with treatment type and urgency per tooth. (v1 substitute for SVG arch visualization.) Priority: must-have
  > Socrates: Counter-argument considered: "pacjent nie zna notacji FDI — numer '47' to abrakadabra bez wizualizacji". Resolution: utrzymano listę pogrupowaną. FR-021 wymusza pokazanie nazwy obok numeru ("47 — drugi trzonowiec dolny prawy"), więc pacjent czyta lokalizację słownie. Bonus: grupowanie wg ćwiartki daje przestrzenny kontekst bez SVG. SVG = v2.
- FR-062: The patient view displays a separate section for `out-of-current-plan` teeth, visible to the patient but clearly marked as outside the current treatment plan. Priority: must-have
  > Socrates: Counter-argument considered: "pacjent widzi zęby, których dentystka nie zamierza leczyć — może być zdezorientowany". Resolution: utrzymano. Transparentność buduje zaufanie ("wiem, że są, decydujemy razem co dalej") i przygotowuje pacjenta na kolejną konsultację. Nazwa sekcji ("Do obserwacji" / "Odroczone" / inna) — nadal Open Question #8, nieblokujące.
- FR-063: The patient view displays a "Scenariusze, które mogą zmienić koszt" section listing `uncertain` teeth with their notes and conditional cost impact. Priority: must-have
  > Socrates: Counter-argument considered: "ryzyko komunikacyjne — pacjent zobaczy '+800 zł w razie X' i przestraszy się". Resolution: utrzymano pełną sekcję z kwotami. Konkretne scenariusze ("ząb 32 — jeśli próchnica głęboka, +800 zł") są lepsze niż ogólne "może być drożej" — pacjent jest przygotowany finansowo i nie czuje się zaskoczony przy wizycie. Zgodne z guardrail "zastrzeżenie o szacunkowości" — daje mu konkretne treści, a nie tylko dyskredytujący caveat.
- FR-064: The patient view displays a side-by-side comparison of the two plan variants: standard (visit list + total or range per visit + grand total or range) and anesthesia (single session + total or range), with the anesthesia variant explicitly marked as "rekomendowane przez gabinet". Priority: must-have
- FR-065: The patient view always displays a prominent, non-dismissible disclaimer that the cost is an estimate and may differ from the final cost. Priority: must-have
- FR-066: The patient view contains no personally identifying data (no name, no email, no other identifiers); only the cryptographic token in the URL. Priority: must-have

### Admin panel — quote management

- FR-070: Dentystka can view a list of all generated quotes (id, recipient email, date created, status: `draft` | `approved`) in the admin panel. Priority: must-have
- FR-071: Dentystka can open any quote from the list to view its current state (drafts are editable; approved are read-only per FR-053). Priority: must-have
- FR-072: Dentystka can store the patient's email alongside the quote (for her own reference). The email is never sent to the LLM and never displayed on the patient page. Priority: must-have
  > Socrates: Counter-argument considered: "po wygenerowaniu linku e-mail nie jest potrzebny — trzymanie = więcej RODO". Resolution: utrzymano. Dentystka musi wiedzieć, do kogo wysłała co (regeneracja linku, kontakt). Default retencja: 12 miesięcy od `dataUtworzenia` (do potwierdzenia w NFR Phase 5, Open Question #9). Operacyjnie e-mail jest jedyną informacją łączącą kosztorys z pacjentem — bez niego panel admin jest bezużyteczny.

---

## Non-Functional Requirements

> Własności obserwowalne z zewnątrz (od pacjenta, dentystki, audytora). Nie nazywają mechanizmu — mechanizm dobiera się na etapie stack i implementacji.

### Privacy & security

- Hasło dentystki nie jest składowalne ani odzyskiwalne z bazy aplikacji — dla operatora bazy wszystkie hasła wyglądają tak samo niedostępnie.
- Token pacjenta jest na tyle nieprzewidywalny, że atakujący zgadujący 1 000 000 tokenów na sekundę nie znalazłby ważnego tokena w ciągu 10 lat istnienia aplikacji.
- Nieudane logowanie dentystki nie blokuje konta po 3 ręcznych pomyłkach, ale rozproszone próby zgadywania hasła (credential stuffing) są odrzucane zanim dotrą do warstwy auth.
- Tekst diagnozy wysyłany do LLM nie zawiera danych identyfikujących pacjenta (egzekwowane przez FR-012; mierzalne: dowolny zrzut requesta do LLM zawiera wyłącznie pole "tekst diagnozy zębowej").

### Data retention & RODO

- Po `dataUtworzenia` + 12 miesięcy: link `/p/<token>` zwraca "Link nieaktywny lub nieprawidłowy"; e-mail pacjenta jest usunięty z rekordu kosztorysu; sam kosztorys może być zachowany w formie zanonimizowanej do celów analitycznych gabinetu lub usunięty całkowicie (do potwierdzenia w PRD Open Questions razem z prawnikiem).
- Token pacjenta nie wygasa wcześniej niż retencja kosztorysu (brak osobnego TTL na token w MVP — zgodne z Open Question #1, którego nie zamknęliśmy w shape).

### Localization

- Cała UI po polsku, ceny w PLN, format daty zgodny z konwencją polską (`DD.MM.YYYY`).

### Compatibility & discoverability

- Strona pacjenta renderuje się poprawnie na dwóch ostatnich wersjach Chrome, Safari, Firefox i Edge na desktop i mobile.
- Strona pacjenta wysyła `noindex, nofollow` w nagłówku — nie pojawia się w wynikach wyszukiwarek; token nie przecieka przez crawler / public cache.

### Świadomie pominięte w MVP

- **Performance** — brak twardych progów odpowiedzi (parsing LLM, render formularza, render strony pacjenta). Akceptujemy, co wyjdzie z naturalnego stacku; jeśli okaże się problem, dodajemy NFR w v2.
- **WCAG-AA** — pełna zgodność jest poza MVP. Minimalny rozsądek (kontrast, semantyczne nagłówki, klikalne obszary ≥ 24 px) jest dobrym tonem, ale nie blokerem.
- **LLM no-retention guarantee** — dostawca LLM może mieć dowolną politykę retencji; zabezpieczeniem jest brak PII w prompcie (FR-012). Dostawca dobierany w stack-stage.

---

## Business Logic

**Aplikacja przekształca półustrukturyzowany wpis diagnozy w dwa porównywalne plany kosztowe (standardowy wielowizytowy vs. jedna sesja w narkozie z opłatą wyliczoną wg reguły gabinetu) i prezentuje je pacjentowi side-by-side.**

Wejście: tekst rozpoznania z konsultacji (np. `Do leczenia: 17,16,15... Kanałowe: 34,37,36, (32?) Kamień do usunięcia`) oraz typ pacjenta (dziecko / dorosły). Aplikacja parsuje tekst, identyfikuje zęby wg notacji FDI (11–48 stałe, 51–85 mleczne), proponuje typ zabiegu na podstawie kontekstu ("Do leczenia" → wypełnienie, "Kanałowe" → leczenie kanałowe + odbudowa, "Do ekstrakcji" → ekstrakcja), wykrywa pozycje ogólne ("kamień" → higienizacja) i znaczniki niepewności (`(32?)` → status `uncertain`). Wynik LLM jest zawsze pretekstem do weryfikacji w formularzu — dentystka jest jedyną instancją zatwierdzającą.

Wyjście: dla każdego zatwierdzonego kosztorysu aplikacja wylicza dwa równoległe plany. **Plan standardowy** = suma pozycji cennikowych zębów w planie + pozycje ogólne, z podziałem na N wizyt; zęby `uncertain` pokazane jako warunkowe scenariusze; zęby `out-of-current-plan` widoczne ale nieliczone. **Plan narkozowy** = jedna sesja zawierająca zabiegi z planu standardowego (z automatycznie pominiętymi pozycjami `local-anesthesia`) + opłata za narkozę. Opłata za narkozę = baza zależna od typu uzębienia (`1400 PLN`, jeśli wszystkie zęby w planie narkozowym są mleczne; `2000 PLN`, jeśli wśród nich jest co najmniej jeden stały) plus `100 PLN` za każdy ząb powyżej piątego, liczony wyłącznie z zębów w planie narkozowym.

Pacjent encounters this rule jako stronę pod unikalnym, nieenumerowalnym linkiem — z listą zębów, sekcjami scenariuszy i zębów odroczonych, porównaniem dwóch wariantów obok siebie (wariant narkozowy wyróżniony jako rekomendowany przez gabinet), oraz wyraźnym zastrzeżeniem o szacunkowym charakterze. Nie podejmuje akcji w aplikacji — decyzja o wyborze wariantu i umówienie wizyty dzieje się off-line (telefon, e-mail, wizyta w gabinecie).

---

## Non-Goals

> Co MVP v1 **wprost nie robi**. Każda pozycja = decyzja świadoma, nie zapomnienie.

### Funkcjonalne non-goals (rzeczy, których aplikacja nie umie i nie będzie umiała w v1)

- **Multi-tenant SaaS.** DentiPlan v1 obsługuje wyłącznie 1 gabinet. Brak izolacji danych między gabinetami, brak onboardingu, brak billingu. _Powód:_ zawęża wszystko (auth, model danych, deployment) na korzyść trzytygodniowego MVP. Drugi gabinet = osobna instancja.
- **Aplikacja natywna mobilna / desktop.** Wyłącznie web (responsywny). Brak React Native, Electron, instalowalnego PWA.
- **Integracja z systemami dokumentacji medycznej** (Estomed, Dentiplus, NFZ, prosperEDM itp.). Tekst diagnozy wkleja się ręcznie z dowolnego źródła. Brak API, brak importu bazy pacjentów.
- **Płatności online / billing pacjenta.** Pacjent nie płaci przez aplikację. Brak integracji ze Stripe / Tpay / Przelewy24. Płatność dzieje się offline w gabinecie.
- **Diagnostyka / decyzje medyczne AI.** LLM wyłącznie parsuje tekst, który dentystka wpisała. Nigdy nie proponuje zabiegów "od siebie" poza tym, co dentystka już zdiagnozowała. Aplikacja nie jest wyrobem medycznym.
- **Historia pacjenta / kartoteka.** Brak rejestru "pacjent X miał wcześniej kosztorysy Y, Z". Każdy kosztorys istnieje osobno; powiązanie do pacjenta po stronie dentystki (jej zewnętrzny rejestr, np. wbudowany system dokumentacji medycznej).
- **Wersjonowanie kosztorysu pod tym samym tokenem.** Zgodnie z FR-053: edycja po zatwierdzeniu = nowy kosztorys, nowy token. Pacjent nigdy nie widzi "wersja 2 z dnia X".
- **Powiadomienia push / SMS / e-mail do pacjenta z aplikacji.** Link kopiuje dentystka do swojej poczty / SMS-a. Brak integracji z dostawcą SMS / push.

### Non-funkcjonalne non-goals (jakości, których MVP nie celuje)

- **Twarde progi performance.** Brak gwarancji p95 czasu odpowiedzi w v1. Akceptujemy, co wyjdzie z naturalnego stacku.
- **Pełna zgodność WCAG-AA.** Minimalny rozsądek wizualny tak (kontrast, semantyczne nagłówki, klikalne obszary), pełen audyt — nie w v1.
- **High availability / multi-region SLA.** 1 gabinet, brak twardego deadlinu = brak SLA. Downtime w nocy = OK.
- **Certyfikacja medyczna / wyrób medyczny (CE).** Aplikacja jest narzędziem prezentacyjno-rachunkowym, nie diagnostycznym; nie pretenduje do statusu wyrobu medycznego.

### Odroczone na v2 (świadome scope-cuts z Phase 3 — nie "nigdy", tylko "nie teraz")

- Wizualizacja SVG łuków zębowych z hover-sync (zamiast: lista pogrupowana, FR-061).
- Drag-and-drop zębów między wizytami (zamiast: dropdown "Wizyta nr [N]", FR-030).
- Wysyłka e-maili z aplikacji (zamiast: ręczna kopia linku, FR-052).
- UI edycji cennika w panelu admin (zamiast: seed JSON w repo, decyzja stack-stage).
- Tryb "zdefiniuj osobny zestaw zabiegów dla narkozy" (zamiast: domyślnie kopia ze standardowego z auto-skip `local-anesthesia`, FR-041).
- Wygaszanie tokena (TTL po stronie tokena niezależny od retencji kosztorysu — patrz Open Question #1).
- CTA dla pacjenta (przycisk "wybierz wariant", "umów wizytę" — patrz domknięta Open Question #6: w v1 strona jest wyłącznie informacyjna).

---

## Open Questions

> Z sekcji 10 dokumentu seed. Część została **domknięta w fazach 3–6** (oznaczona `[ROZSTRZYGNIĘTE]`); reszta przechodzi do PRD i ostatecznie do gestii dentystki lub prawnika.

1. **Wygaśnięcie linku dla pacjenta — niezależnie od retencji 12 mies.** Czy token ma osobne TTL (np. 30 dni) czy żyje tyle ile kosztorys (12 mies.)? _Decyzja default w v1 (Phase 5 NFR): token żyje tyle ile kosztorys (12 mies.)._ Pozostawione jako Open Question dla dentystki — czy domyślne 12 mies. jest OK, czy chce krótsze TTL z możliwością przedłużenia. Owner: dentystka. Nie blokujący implementacji.
2. **[ROZSTRZYGNIĘTE — Phase 4]** Edytowalność po wysłaniu = **read-only**, zmiana = nowy kosztorys, nowy token. FR-053.
3. **Zamrożenie cennika.** _Decyzja:_ snapshot pełnego cennika w rekord kosztorysu przy zatwierdzeniu (FR-050). _Pozostaje otwarte:_ gdzie trzymamy źródłowy cennik w v1 — Phase 3 zdecydowała "seed JSON w repo" (cut UI cennika do v2). Jeśli to nieakceptowalne dla dentystki, wracamy do FR i dodajemy minimalne UI edycji cennika do v1. Owner: dentystka.
4. **[ROZSTRZYGNIĘTE — Phase 4]** Znieczulenie miejscowe w planie narkozowym = **auto-skip** pozycji oznaczonych `local-anesthesia` w cenniku. FR-041. _Pozostawiamy do potwierdzenia stomatologicznego, czy to założenie jest medycznie zawsze prawdziwe._ Owner: dentystka.
5. **[ROZSTRZYGNIĘTE — Phase 4]** Walidacja LLM = ręczna akceptacja **zawsze** wymagana (FR-013), schema walidowana (FR-012). Konkretny schemat JSON Open Question dla implementacji.
6. **[ROZSTRZYGNIĘTE — Phase 4]** Strona pacjenta w v1 = **wyłącznie informacyjna**. Bez CTA. CTA na v2.
7. **Uzębienie mieszane u dzieci.** Wizualizacja i wycena przy jednoczesnych zębach mlecznych (51–85) i stałych (11–48) w jednym kosztorysie. Reguła kosztu narkozy bazuje na "co najmniej jeden stały" → 2000 PLN baza. Wizualizacja w v1 to lista pogrupowana (FR-061) — uzębienie mieszane wymaga dwóch grup górnych i dwóch grup dolnych w sekcji, jasno oznaczonych. _Pozostaje:_ czy w UI formularza i na stronie pacjenta dodajemy jakąś inną sygnalizację typu uzębienia mieszanego (np. ikonka, badge). Owner: dentystka. Nie blokujący.
8. **Nazwa statusu "poza bieżącym planem".** Kandydaci: _Do rozważenia później_, _Odroczone_, _Poza bieżącym planem_, _Do obserwacji_. "Do obserwacji" ma znaczenie kliniczne — może mylić. Default v1: **"Odroczone"**. Owner: dentystka. Nie blokujący — łatwa zmiana stringów UI.
9. **Retencja danych pacjenta i podstawa prawna (RODO).** Default v1: 12 miesięcy od `dataUtworzenia`, e-mail usuwany razem z kosztorysem, kosztorys usuwany lub anonimizowany (do dopytania prawnika). Podstawa prawna: realnie zgoda pacjenta wyrażona przy konsultacji (umowna). Wzmianka w polityce prywatności gabinetu. Owner: dentystka + prawnik RODO. Niewymagane przed startem implementacji, ale **wymagane przed udostępnieniem aplikacji prawdziwym pacjentom**.
10. **[ROZSTRZYGNIĘTE — Phase 3]** Wysyłka e-maili **odsunięta na v2**. v1 = ręczna kopia linku przez dentystkę. Dostawca, szablon, domena nadawcy — decyzja przy v2.
11. **Timeout sesji dentystki.** Po jakim czasie nieaktywności wylogować. Default v1: 8h (typowy dzień pracy w gabinecie). Owner: dentystka. Nie blokujący.
12. **Wybór dostawcy LLM.** OpenAI / Anthropic / OpenRouter / lokalny model. Wymagania: polskojęzyczna jakość parsowania, strukturyzowane wyjście (JSON schema / tool use), niska latencja (≤ 10s p95 — choć brak twardego NFR). FR-012 wymaga braku PII w prompcie — to chroni przed problemami retencji u dostawcy. Decyzja: **stack-stage** (po /10x-prd). Wpisane też w `## Forward: tech-stack`.
13. **Charakter LLM-promptu.** Czy prompt zna nazwy zabiegów po polsku i mapuje synonimy ("Kanałowe" = "endodoncja" = "leczenie kanałowe"), czy oczekujemy, że dentystka używa tylko terminów z listy treatment-type? Default v1: prompt zna typowe synonimy z polskiej stomatologii; nierozpoznane terminy → flag dla dentystki (FR-012). Owner: implementacja. By: implementacja.

---

## Forward: tech-stack

> Informacyjne dla kolejnych kroków łańcucha (`10x-tech-stack-selector`, bootstrapper). **Nie wchodzi do PRD.**

- **LLM**: wymagana integracja z modelem językowym do parsowania wejścia (sam tekst diagnozy, bez PII pacjenta). Wybór dostawcy (Claude/GPT/OpenRouter/lokalny) — decyzja stack-stage. Wymagania: strukturyzowane wyjście (JSON schema / tool use), niski koszt per request (jednorazowo ~kilkaset tokenów), polskojęzyczna jakość parsowania nazw zabiegów.
- **Web app** — front + back (decyzja stack-stage).
- **DB** — relacyjna (model danych w §8 dokumentu seed jest relacyjny). Snapshot cennika sugeruje immutable rows lub jsonb dump przy utworzeniu kosztorysu.
- **E-mail** — usługa transakcyjna z własnej / dedykowanej domeny.

## Forward: technical-roadmap

> Informacyjne. **Nie wchodzi do PRD.**

- Decyzje implementacyjne (storage layout snapshotu cennika, layout tokenu, walidacja schema LLM, retry/timeout LLM, edycja po wysłaniu) — do rozstrzygnięcia w fazie implementacji lub w osobnym ADR.
- Wizualizacja szczęki (komponent SVG generyczny dla łuków zębowych, mapowanie numer → pozycja) — decyzja UI/UX w fazie implementacji.
