---
project: "DentiPlan"
version: 1
status: draft
created: 2026-05-24
context_type: greenfield
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: null
  after_hours_only: false
---

# DentiPlan — Product Requirements Document

> Wersja: 1 (draft). Wygenerowane przez `/10x-prd` z `context/foundation/shape-notes.md` (2026-05-24).

---

## Vision & Problem Statement

Dentystka prowadząca gabinet Dentina (Kołobrzeg) po pierwszej wizycie konsultacyjnej (pantomogram + badanie kliniczne) wpisuje rozpoznanie do swojego istniejącego systemu dokumentacji medycznej w formie półustrukturyzowanego tekstu (np. `Do leczenia: 17,16,15... Kanałowe: 34,37,36, (32?) Kamień do usunięcia`). Aby przedstawić pacjentowi propozycję leczenia z kosztorysem, musi ten surowy wpis ręcznie przekształcić: zidentyfikować każdy ząb, dobrać pozycje cennikowe, policzyć sumy osobno dla wariantu standardowego (kilka wizyt) i wariantu w narkozie (jedna sesja pod opieką anestezjologa — preferowanego przez gabinet), opisać scenariusze warunkowe i zaprezentować to w czytelnej formie. Koszt dzisiejszy: kilka–kilkanaście minut ręcznej pracy per pacjent, brak spójnej prezentacji porównawczej, ryzyko błędów rachunkowych.

Insight, który czyni ten produkt możliwym dopiero teraz: dostępne na polskim rynku systemy gabinetowe celują w dokumentację medyczną, nie w prezentację dla pacjenta — porównanie dwuwariantowych planów leczenia (standardowy vs. w narkozie) jest niezagospodarowaną niszą. Drugi insight: parsowanie chaotycznego wpisu typu `(32?)` lub `Kanałowe: 34,37,36,` deterministycznymi regułami było wcześniej niewykonalne; współczesne metody automatycznego rozumienia języka naturalnego zamykają tę lukę bez konieczności narzucania dentystce sztywnego formatu wprowadzania. Aplikacja nie podejmuje decyzji medycznych — tylko strukturyzuje i prezentuje to, co dentystka już zdiagnozowała.

---

## User & Persona

**Primary persona — Dentystka (gabinet Dentina, Kołobrzeg)**

Pojedyncza osoba prowadząca gabinet stomatologiczny. Robi diagnostykę (pantomogram, badanie kliniczne), wprowadza rozpoznanie do istniejącego systemu dokumentacji medycznej. Po konsultacji potrzebuje szybko (kilka minut, nie kilkanaście) przygotować dla pacjenta czytelny plan leczenia z dwoma wariantami kosztowymi i przekazać go linkiem. Pracuje z gabinetu (desktop/laptop), ale może też dokończyć kosztorys w domu. Zna swój cennik na pamięć dla typowych pozycji; pamięta dwuwariantową logikę narkozową; nie chce uczyć się obsługi skomplikowanego narzędzia.

### Secondary persona — Pacjent (odbiorca linku)

Nie jest personą-operatorem w sensie produktu. Otrzymuje link, otwiera stronę, czyta plan i kosztorys. Nie loguje się, nie wprowadza danych, nie ma konta. Decyzja o wyborze wariantu i umówienie kolejnej wizyty dzieje się poza aplikacją (telefon, e-mail, kolejna wizyta).

---

## Success Criteria

### Primary

- **Czas pracy dentystki ≤ 5 minut od wklejenia surowego wpisu diagnozy do wygenerowania linku dla pacjenta.** Mierzone od pierwszego wklejenia tekstu w pole wprowadzania do uzyskania kopiowalnego linku. Próg wybrany jako redukcja ~15+ min ręcznej pracy do około 1/3. Pomiar subiektywny przez dentystkę po pierwszych 5–10 pacjentach.

### Secondary

- Brak. MVP utrzymuje pojedyncze, jasne kryterium sukcesu. Cele biznesowe (np. wybór wariantu narkozowego przez większy odsetek pacjentów) wymagałyby pomiaru po stronie pacjenta i CTA, które są poza zakresem v1.

### Guardrails

- **Brak danych identyfikujących pacjenta w jakimkolwiek wywołaniu zewnętrznej usługi przetwarzania tekstu diagnozy.** Do takiej usługi trafia wyłącznie tekst diagnozy zębowej. Złamanie = naruszenie ochrony danych osobowych i utrata zaufania.
- **Token pacjenta nieodgadywalny i nieenumerowalny.** Kryptograficznie bezpieczny, ≥ 128 bit entropii, nie sekwencyjny identyfikator. Złamanie = wyciek planów leczenia innych pacjentów.
- **Strona pacjenta zawsze zawiera wyraźne, niedające się ukryć zastrzeżenie o szacunkowym charakterze kosztorysu.** Złamanie = ryzyko roszczeń pacjenta typu "na linku było X zł".

---

## User Stories

### US-01: Dentystka generuje kosztorys po konsultacji

- **Given** zalogowana dentystka i świeży pacjent zaraz po konsultacji (pantomogram + badanie zostały wykonane, rozpoznanie wpisane do systemu dokumentacji)
- **When** wkleja surowy tekst rozpoznania (np. `Do leczenia: 17,16... Kanałowe: 34,37,36, (32?) Kamień do usunięcia`), weryfikuje wstępnie wypełniony formularz, ustawia typ pacjenta (dziecko/dorosły), poprawia pozycje cennikowe per ząb, oznacza zęby niepewne i poza planem, opcjonalnie układa zęby w wizyty, i klika "Zatwierdź"
- **Then** dostaje na ekranie gotowy do skopiowania link postaci `/p/<token>`, który po otwarciu pokazuje pacjentowi dwuwariantowy plan leczenia i kosztorys

#### Acceptance Criteria

- Cały przepływ od pierwszego wklejenia do skopiowalnego linku ≤ 5 minut (Primary success).
- Zewnętrzna usługa przetwarzania tekstu diagnozy nigdy nie otrzymuje żadnych danych identyfikujących pacjenta — wyłącznie tekst rozpoznania.
- Niezatwierdzona praca jest możliwa do porzucenia bez zostawiania śladu na liście kosztorysów (draft state).
- Zatwierdzenie jest jednorazowe i nieodwracalne: zmiana po zatwierdzeniu = nowy kosztorys, nowy token.

### US-02: Pacjent otwiera plan leczenia

- **Given** pacjent dostał od gabinetu link `/p/<token>` (wklejony przez dentystkę do e-maila lub przesłany SMS-em — kanał poza aplikacją w v1)
- **When** otwiera link w przeglądarce na telefonie lub komputerze
- **Then** widzi: listę zębów do leczenia pogrupowaną wg ćwiartek łuku, sekcję "poza bieżącym planem", sekcję "scenariusze, które mogą zmienić koszt", porównanie side-by-side dwóch wariantów (standardowy z podziałem na wizyty vs. narkoza w jednej sesji) z wyróżnieniem wariantu narkozowego jako rekomendowanego, oraz wyraźne zastrzeżenie o szacunkowym charakterze kosztorysu

#### Acceptance Criteria

- Brak danych identyfikujących pacjenta na stronie (żadnego imienia, e-maila, PESEL).
- Token w URL jest nieodgadywalny i nieenumerowalny.
- Strona nie pojawia się w wynikach wyszukiwarek.
- Niepoprawny / nieznany token zwraca generyczny komunikat "Link nieaktywny lub nieprawidłowy" bez ujawniania, czy taki kosztorys w ogóle istniał.
- Strona jest responsywna (telefon + komputer).

---

## Functional Requirements

> 42 FR-y w 8 grupach. Tag `Priority: must-have` dla wszystkich v1 poza FR-033, która jest `should-have` — plan wizyt działa bez niej, ona tylko domyka koszt wizyty. FR-y oznaczone `> Socrates:` mają wyzwanie kontr-argumentowe z fazy szlifowania (preserved verbatim).

### Authentication & session

- FR-001: Dentystka can sign in to the admin panel using email + password. Priority: must-have
- FR-002: Dentystka can sign out from the admin panel. Priority: must-have
- FR-003: An unauthenticated request to `/admin/*` is redirected to the login page. Priority: must-have

### Diagnosis input & parsing

- FR-010: Dentystka can paste raw diagnosis text into a multi-line input field on the new-quote screen. Priority: must-have
- FR-011: The system processes the diagnosis text into structured output: list of teeth, proposed treatment type per tooth, proposed visit split for the standard plan, and detected general items (e.g. "kamień" → higienizacja, "pantomogram"). The only data sent to any external processing service is the diagnosis text itself — no patient identifiers, no e-mail. Priority: must-have
  > Socrates: Counter-argument considered: "regułka pokrywa 60–70% wpisów; LLM dodaje niedeterminizm i koszt API." Resolution: utrzymano. Regułka padłaby na `(32?)`, końcowych przecinkach typu `34,37,36,` i swobodnych notatkach typu "Kamień do usunięcia" — czyli na realnych wpisach dentystki. **Dodano warunek**: jeśli LLM padnie lub wynik nie przejdzie walidacji schemy (FR-012), formularz musi być wypełnialny ręcznie od zera — LLM nigdy nie jest blokerem zatwierdzenia.
- FR-012: The system validates the parsing output against a known structure. Unrecognized tokens, ambiguous markers (e.g. `(32?)` → uncertain), and out-of-range tooth numbers are surfaced as warnings on the form rather than auto-dropped or auto-accepted. Priority: must-have
- FR-013: A quote can never be approved without a manual click on "Zatwierdź" by the dentystka, regardless of parsing confidence. Priority: must-have
- FR-014: The system proposes a complete visit split for the standard plan, also when the diagnosis text says nothing about visits: every `in-plan` tooth is placed in a visit, and the visits are ordered so that the most urgent teeth fall in the first one. Visit numbers and visit names are assigned by the system — never written by the external processing service — and the names come from a closed vocabulary. The proposal is a starting point: the dentystka renumbers, renames, reassigns and approves it herself (FR-030, FR-031, FR-013). Priority: must-have
  > Socrates: Counter-argument considered: „skoro dentystka i tak poprawia podział, po co go proponować — pusty formularz jest uczciwszy". Resolution: utrzymano. Podział na wizyty to praca, którą wykonuje przy każdym kosztorysie, a notatka zwykle daje na niego podstawę (pilność, strona łuku, rodzaj zabiegu). **Dodano warunek**: żadne zdanie widziane przez pacjenta nie pochodzi z propozycji — nazwy wizyt bierze się ze słownika systemu, więc cena za pomyłkę modelu to źle ułożone zęby, a nie obcy tekst na stronie pacjenta.
- FR-015: Every value the system supplied without direct support in the diagnosis text is named in the FR-012 warnings: which teeth got an urgency inferred rather than read, and the reasoning behind the proposed split. These warnings are visible to the dentystka only — no free-text prose produced by the external processing service reaches the patient's page. Priority: must-have

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
- FR-033: A general item proposed from the diagnosis text can carry a visit assignment, so a visit's partial cost (FR-032) covers everything that happens at that visit and not only its teeth. Priority: should-have

### Cost calculation rules

- FR-040: Standard plan total = sum of pricelist items for all teeth marked `in-plan` + general items. Teeth marked `uncertain` do not contribute to the base total but are displayed as conditional add-on scenarios. Teeth marked `out-of-current-plan` do not contribute to any total. Priority: must-have
- FR-041: Anesthesia plan default content = copy of in-plan tooth treatment items from the standard plan, **with pricelist items categorized as local anesthesia automatically excluded**, plus general items if applicable, plus the calculated anesthesia fee. Always one session. Priority: must-have
  > Socrates: Counter-argument considered: "ręczne usuwanie znieczulenia miejscowego raz na kosztorys = mniej schema, mniej kodu". Resolution: utrzymano auto-skip. Kosztorys regenerowany przy każdym pacjencie; ręczne usuwanie 5–15 pozycji per kosztorys × N pacjentów rocznie szybko przekracza koszt jednej flagi w cenniku. Flaga `local-anesthesia` konfigurowana w cenniku raz.
- FR-042: Anesthesia base fee = 1400 PLN if all teeth in the anesthesia plan are milk teeth; 2000 PLN if at least one permanent tooth is included. Priority: must-have
- FR-043: Anesthesia base fee receives +100 PLN per tooth above 5, counted from teeth in the anesthesia plan. Priority: must-have
- FR-044: Teeth marked `out-of-current-plan` do not count toward the anesthesia tooth count, the anesthesia fee, or any cost total. Priority: must-have

### Pricelist snapshot & approval

- FR-050: On quote approval, the system captures a snapshot of the active pricelist permanently associated with the quote. Subsequent pricelist edits do not change already-approved quotes. Priority: must-have
- FR-051: Quote approval generates a cryptographically secure, non-enumerable token (≥ 128 bits of entropy) used as the patient URL path segment. Priority: must-have
- FR-052: After approval, the admin panel displays the patient URL (`/p/<token>`) in a copy-friendly format for the dentystka to send manually (no automated e-mail in v1). Priority: must-have
- FR-053: An approved quote is read-only. Editing requires creating a new quote (new snapshot, new token); the original remains intact and accessible by its original token. Priority: must-have
  > Socrates: Counter-argument considered: "dentystka zechce poprawić literówkę po wysłaniu — zmuszanie do nowego linku frustrujące". Resolution: utrzymano read-only. Eliminuje klasę bugów "co pacjent widział wczoraj vs. dzisiaj" i upraszcza prawnie. Workflow: regeneracja kosztorysu, nowy link, pacjent dostaje "wersja zaktualizowana — proszę użyć nowego linku" mailem (kanał poza aplikacją w v1). Stary link aktywny = forensic snapshot.
- FR-054: After approval, the admin panel displays a locally generated QR code for the same absolute patient URL as FR-052, both immediately after approval and when an approved quote is reopened. Priority: must-have

### Patient view (public, token-only)

- FR-055: The printed patient view contains a locally generated QR code at least 2 cm square plus a readable fallback URL, both pointing to the exact online version of that quote; the QR footer is absent from screen media. Priority: must-have
- FR-060: A request to `/p/<token>` with a valid, active token returns the patient view. An invalid, unknown, or revoked token returns a generic "Link nieaktywny lub nieprawidłowy" page with no information disclosure (no leak of whether such a token ever existed). Priority: must-have
- FR-061: The patient view displays a grouped tooth list (`górne prawe`, `górne lewe`, `dolne prawe`, `dolne lewe`) for teeth marked `in-plan`, with treatment type and urgency per tooth. Priority: must-have
  > Socrates: Counter-argument considered: "pacjent nie zna notacji FDI — numer '47' to abrakadabra bez wizualizacji". Resolution: utrzymano listę pogrupowaną. FR-021 wymusza pokazanie nazwy obok numeru ("47 — drugi trzonowiec dolny prawy"), więc pacjent czyta lokalizację słownie. Bonus: grupowanie wg ćwiartki daje przestrzenny kontekst bez SVG. SVG = v2.
- FR-062: The patient view displays a separate section for `out-of-current-plan` teeth, visible to the patient but clearly marked as outside the current treatment plan. Priority: must-have
  > Socrates: Counter-argument considered: "pacjent widzi zęby, których dentystka nie zamierza leczyć — może być zdezorientowany". Resolution: utrzymano. Transparentność buduje zaufanie ("wiem, że są, decydujemy razem co dalej") i przygotowuje pacjenta na kolejną konsultację. Nazwa sekcji ("Do obserwacji" / "Odroczone" / inna) — nadal Open Question, nieblokujące.
- FR-063: The patient view displays a "Scenariusze, które mogą zmienić koszt" section listing `uncertain` teeth with their notes and conditional cost impact. Priority: must-have
  > Socrates: Counter-argument considered: "ryzyko komunikacyjne — pacjent zobaczy '+800 zł w razie X' i przestraszy się". Resolution: utrzymano pełną sekcję z kwotami. Konkretne scenariusze ("ząb 32 — jeśli próchnica głęboka, +800 zł") są lepsze niż ogólne "może być drożej" — pacjent jest przygotowany finansowo i nie czuje się zaskoczony przy wizycie. Zgodne z guardrail "zastrzeżenie o szacunkowości" — daje mu konkretne treści, a nie tylko dyskredytujący caveat.
- FR-064: The patient view displays a side-by-side comparison of the two plan variants: standard (visit list + total or range per visit + grand total or range) and anesthesia (single session + total or range), with the anesthesia variant explicitly marked as "rekomendowane przez gabinet". Priority: must-have
- FR-065: The patient view always displays a prominent, non-dismissible disclaimer that the cost is an estimate and may differ from the final cost. Priority: must-have
- FR-066: The patient view contains no personally identifying data (no name, no email, no other identifiers); only the cryptographic token in the URL. Priority: must-have
- FR-074: The patient view displays a graphical tooth chart (dental arch, FDI positions) above the grouped list. Every tooth in the quote is drawn coloured by urgency and outlined by status, consistent with the vocabulary FR-061/FR-062/FR-063 use in the lists; teeth outside the quote are drawn plain. Hovering, focusing or tapping a tooth names it (Polish anatomical name), its treatment and its contribution to the standard plan. Priority: must-have
  > _Numeracja:_ ta sekcja ma pasmo 060, a jego maksimum (FR-072) jest zajęte poza nią. Numery FR-074–076 zostały nazwane wprost przed implementacją i użyte tak, jak nazwane; to zdanie jest zapisem tej niespójności, żeby nie wyglądała na pomyłkę.
- FR-075: The patient view displays a legend for the chart. Status is distinguishable by a treatment that is not a hue (solid / dashed / dashed with hatch), so it survives greyscale and a black-and-white printout; the grouped list (FR-061) is retained as a parallel layer, not replaced. Priority: must-have
- FR-076: In the admin editor the same chart is a picker: clicking a tooth that is not in the plan adds it, clicking one that is jumps to its row. An approved (read-only, FR-053) quote's chart is inert but still answers hover, focus and tap. Priority: must-have

### Admin panel — quote management

- FR-070: Dentystka can view a list of all generated quotes in the admin panel, showing for each: identifier, recipient e-mail, date created, status (`draft` | `approved`). Priority: must-have
- FR-071: Dentystka can open any quote from the list to view its current state (drafts are editable; approved are read-only per FR-053). Priority: must-have
- FR-072: Dentystka can store the patient's e-mail alongside the quote (for her own reference). The e-mail is never sent to any external processing service and never displayed on the patient page. Priority: must-have
  > Socrates: Counter-argument considered: "po wygenerowaniu linku e-mail nie jest potrzebny — trzymanie = więcej RODO". Resolution: utrzymano. Dentystka musi wiedzieć, do kogo wysłała co (regeneracja linku, kontakt). Default retencja: 12 miesięcy od `dataUtworzenia` (do potwierdzenia w Open Question). Operacyjnie e-mail jest jedyną informacją łączącą kosztorys z pacjentem — bez niego panel admin jest bezużyteczny.

---

## Non-Functional Requirements

> Własności obserwowalne z zewnątrz (od pacjenta, dentystki, audytora). Nie nazywają mechanizmu — mechanizm dobiera się na etapie stack i implementacji.

### Privacy & security

- Hasło dentystki nie jest składowalne ani odzyskiwalne z warstwy składowania danych aplikacji — dla osoby z dostępem do tej warstwy wszystkie hasła wyglądają tak samo niedostępnie.
- Token pacjenta jest na tyle nieprzewidywalny, że atakujący zgadujący 1 000 000 tokenów na sekundę nie znalazłby ważnego tokena w ciągu 10 lat istnienia aplikacji.
- Nieudane logowanie dentystki nie blokuje konta po 3 ręcznych pomyłkach, ale rozproszone próby zgadywania hasła są odrzucane, zanim mogłyby trafić na próbę weryfikacji poświadczeń.
- Tekst diagnozy wysyłany do zewnętrznej usługi przetwarzania nie zawiera danych identyfikujących pacjenta. Mierzalne: dowolny zrzut wywołania tej usługi zawiera wyłącznie pole "tekst diagnozy zębowej".

### Data retention & ochrona danych osobowych

- Po 12 miesiącach od utworzenia kosztorysu: link `/p/<token>` zwraca "Link nieaktywny lub nieprawidłowy"; e-mail pacjenta jest usunięty z rekordu kosztorysu; sam kosztorys może być zachowany w formie zanonimizowanej do celów analitycznych gabinetu lub usunięty całkowicie (do potwierdzenia w Open Questions razem z prawnikiem).
- Token pacjenta nie wygasa wcześniej niż retencja kosztorysu (brak osobnego TTL na token w MVP — patrz Open Question).

### Localization

- Cała UI po polsku, ceny w PLN, format daty zgodny z konwencją polską (`DD.MM.YYYY`).

### Compatibility & discoverability

- Strona pacjenta i panel dentystki renderują się poprawnie na dwóch ostatnich wersjach głównych przeglądarek desktopowych i mobilnych.
- Strona pacjenta nie pojawia się w wynikach publicznych wyszukiwarek — token nie przecieka przez crawler ani publiczny cache.

### Świadomie pominięte w MVP

- **Performance** — brak twardych progów odpowiedzi (parsowanie, render formularza, render strony pacjenta). Akceptujemy, co wyjdzie z naturalnego stacku; jeśli okaże się problem, dodajemy NFR w v2.
- **WCAG-AA** — pełna zgodność jest poza MVP. Minimalny rozsądek wizualny (kontrast, semantyczne nagłówki, klikalne obszary ≥ 24 px) jest dobrym tonem, ale nie blokerem.
- **Gwarancja braku retencji po stronie zewnętrznej usługi przetwarzania** — usługa parsująca może mieć dowolną politykę retencji; zabezpieczeniem jest brak danych identyfikujących pacjenta w przesyłanym tekście.

---

## Business Logic

**Aplikacja przekształca półustrukturyzowany wpis diagnozy w dwa porównywalne plany kosztowe (standardowy wielowizytowy oraz jedna sesja w narkozie z opłatą wyliczoną wg reguły gabinetu) i prezentuje je pacjentowi side-by-side.**

Wejście: tekst rozpoznania z konsultacji (np. `Do leczenia: 17,16,15... Kanałowe: 34,37,36, (32?) Kamień do usunięcia`) oraz typ pacjenta (dziecko / dorosły). Aplikacja parsuje tekst, identyfikuje zęby wg notacji FDI (11–48 stałe, 51–85 mleczne), proponuje typ zabiegu na podstawie kontekstu ("Do leczenia" → wypełnienie, "Kanałowe" → leczenie kanałowe + odbudowa, "Do ekstrakcji" → ekstrakcja), wykrywa pozycje ogólne ("kamień" → higienizacja) i znaczniki niepewności (`(32?)` → status _uncertain_). Wynik parsowania jest zawsze pretekstem do weryfikacji w formularzu — dentystka jest jedyną instancją zatwierdzającą.

Wyjście: dla każdego zatwierdzonego kosztorysu aplikacja wylicza dwa równoległe plany. **Plan standardowy** = suma pozycji cennikowych zębów oznaczonych jako _in-plan_ + pozycje ogólne, z podziałem na N wizyt; zęby _uncertain_ pokazane jako warunkowe scenariusze; zęby _out-of-current-plan_ widoczne, ale nieliczone do żadnej sumy. **Plan narkozowy** = jedna sesja zawierająca zabiegi z planu standardowego (z automatycznie pominiętymi pozycjami oznaczonymi w cenniku jako "znieczulenie miejscowe") + opłata za narkozę. Opłata za narkozę = baza zależna od typu uzębienia (1400 PLN, jeśli wszystkie zęby w planie narkozowym są mleczne; 2000 PLN, jeśli wśród nich jest co najmniej jeden stały) plus 100 PLN za każdy ząb powyżej piątego, liczony wyłącznie z zębów w planie narkozowym.

Pacjent doświadcza tej reguły jako strona pod unikalnym, nieenumerowalnym linkiem — z listą zębów, sekcjami scenariuszy i zębów odroczonych, porównaniem dwóch wariantów obok siebie (wariant narkozowy wyróżniony jako rekomendowany przez gabinet) oraz wyraźnym zastrzeżeniem o szacunkowym charakterze. Pacjent nie podejmuje akcji w aplikacji — decyzja o wyborze wariantu i umówienie wizyty dzieje się off-line (telefon, e-mail, wizyta w gabinecie).

---

## Access Control

Dwa rozdzielne tryby dostępu w jednej aplikacji, jedna domena:

- **Panel dentystki (`/admin/...`)** — wymaga uwierzytelnienia. Mechanizm: e-mail + hasło. Konto dentystki tworzone ręcznie (1 konto na MVP, brak self-service signup). Wylogowanie ręczne oraz automatyczne po ustalonym okresie nieaktywności (próg do dopracowania w Open Questions). Brak ról — pojedynczy operator ma pełne uprawnienia w MVP.
- **Strona pacjenta (`/p/<token>`)** — bez logowania. Dostęp wyłącznie przez nieodgadywalny, kryptograficznie bezpieczny token w URL (nie sekwencyjny identyfikator). Pacjent nigdy nie widzi UI logowania ani panelu admin. Token nie wymaga uwierzytelnienia, ale jest tajemnicą — przekazywany pacjentowi przez dentystkę.

**Sekrety na granicy systemu:** hasło dentystki przechowywane w sposób uniemożliwiający jego odzyskanie z warstwy składowania danych aplikacji; token pacjenta — losowy ciąg ≥ 128 bit entropii. E-mail pacjenta nie jest częścią strony pacjenta — jest trzymany tylko po stronie panelu admin.

---

## Non-Goals

> Co MVP v1 **wprost nie robi**. Każda pozycja = decyzja świadoma, nie zapomnienie.

### Funkcjonalne non-goals

- **Multi-tenant SaaS.** DentiPlan v1 obsługuje wyłącznie 1 gabinet. Brak izolacji danych między gabinetami, brak onboardingu, brak billingu. _Powód:_ zawęża wszystko (auth, model danych, deployment) na korzyść trzytygodniowego MVP. Drugi gabinet = osobna instancja.
- **Natywne aplikacje mobilne lub desktopowe.** Wyłącznie web (responsywny). Brak instalowalnych aplikacji.
- **Integracja z systemami dokumentacji medycznej.** Tekst diagnozy wkleja się ręcznie z dowolnego źródła. Brak API, brak importu bazy pacjentów.
- **Płatności online / billing pacjenta.** Pacjent nie płaci przez aplikację. Brak integracji z dostawcami płatności online. Płatność dzieje się off-line w gabinecie.
- **Diagnostyka / decyzje medyczne wspomagane AI.** Automatyczne parsowanie ogranicza się do tekstu, który dentystka już wpisała. Aplikacja nigdy nie proponuje zabiegów "od siebie" poza tym, co dentystka zdiagnozowała. Aplikacja nie jest wyrobem medycznym.
- **Historia pacjenta / kartoteka.** Brak rejestru "pacjent X miał wcześniej kosztorysy Y, Z". Każdy kosztorys istnieje osobno; powiązanie do pacjenta po stronie dentystki (jej zewnętrzny system dokumentacji).
- **Wersjonowanie kosztorysu pod tym samym tokenem.** Zgodnie z FR-053: edycja po zatwierdzeniu = nowy kosztorys, nowy token. Pacjent nigdy nie widzi "wersja 2 z dnia X".
- **Powiadomienia push / SMS / e-mail do pacjenta z aplikacji.** Link kopiuje dentystka do swojego kanału komunikacji. Brak automatycznej wysyłki.

### Non-funkcjonalne non-goals

- **Twarde progi performance.** Brak gwarancji p95 czasu odpowiedzi w v1. Akceptujemy, co wyjdzie z naturalnego stacku.
- **Pełna zgodność WCAG-AA.** Minimalny rozsądek wizualny tak (kontrast, semantyczne nagłówki, klikalne obszary), pełen audyt — nie w v1.
- **High availability / multi-region SLA.** 1 gabinet, brak twardego deadline'u = brak SLA. Downtime w nocy = akceptowalny.
- **Certyfikacja medyczna / wyrób medyczny (CE).** Aplikacja jest narzędziem prezentacyjno-rachunkowym, nie diagnostycznym; nie pretenduje do statusu wyrobu medycznego.

### Odroczone na v2 (świadome scope-cuts — nie "nigdy", tylko "nie teraz")

- ~~Graficzna wizualizacja łuków zębowych z hover-sync (zamiast: lista pogrupowana, FR-061).~~ — **cofnięte 2026-09-06, zrealizowane w S-06 jako FR-074–076.** Powód odroczenia był kosztem: rysunek łuku wyglądał na osobny podprojekt. Okazał się czystą funkcją z danych, które są w rekordzie od S-01 — geometria pochodzi z jednej zewnętrznej biblioteki na licencji MIT, skopiowanej jako dane (`THIRD-PARTY-NOTICES.md`), a wszystko, co ma stan, styl albo semantykę dostępności, jest napisane tutaj. Lista pogrupowana **zostaje** jako warstwa dostępności i druku; rysunek jest warstwą równoległą, nie zamiennikiem.
- Drag-and-drop zębów między wizytami (zamiast: dropdown "Wizyta nr [N]", FR-030).
- Automatyczna wysyłka e-maili z aplikacji (zamiast: ręczna kopia linku, FR-052).
- UI edycji cennika w panelu admin (zamiast: cennik definiowany jako konfiguracja techniczna).
- Tryb "zdefiniuj osobny zestaw zabiegów dla narkozy" (zamiast: domyślnie kopia ze standardowego z auto-skip pozycji znieczulenia miejscowego, FR-041).
- Wygaszanie tokena (TTL po stronie tokena niezależny od retencji kosztorysu — patrz Open Question).
- CTA dla pacjenta (przycisk "wybierz wariant", "umów wizytę" — w v1 strona jest wyłącznie informacyjna).

---

## Open Questions

> Pozostałe niezamknięte decyzje, plus implementacyjne gapy do potwierdzenia. Pozycje rozstrzygnięte w fazach 3–6 zostały zrealizowane w odpowiednich FR-ach i nie pojawiają się tutaj. Forward-looking decyzje (wybór dostawcy LLM, charakter promptu, dobór języka i frameworków, dostawca poczty, layout snapshotu cennika) przekazane do `/10x-tech-stack-selector` oraz fazy implementacji — nie są częścią PRD.

1. **Czy default 12 miesięcy TTL tokena jest OK, czy dentystka chce krótszy domyślny TTL z możliwością przedłużenia?** — _Owner:_ dentystka. _Block:_ nie (domyślne ustawienie wystarcza do startu).
2. **Czy źródłowy cennik konfigurowany przez aktualizację techniczną (UI edycji cennika odroczone na v2) jest akceptowalny?** Jeśli częstotliwość zmian cen w gabinecie jest realnie wysoka, trzeba wrócić do FR i dodać minimalne UI edycji do v1. — _Owner:_ dentystka. _Block:_ warunkowy (blokujący, jeśli częstotliwość zmian cennika realnie wysoka).
3. **Medyczne potwierdzenie reguły auto-skip dla planu narkozowego (FR-041).** Założenie: pozycje cennikowe oznaczone jako "znieczulenie miejscowe" są wykluczane z planu narkozowego automatycznie. Czy to założenie jest medycznie zawsze prawdziwe (np. czy żadne lokalne znieczulenie nie jest podawane uzupełniająco w narkozie)? — _Owner:_ dentystka. _Block:_ tak (błędne założenie zafałszuje kosztorys narkozowy).
4. ~~**Sygnalizacja uzębienia mieszanego u dzieci.**~~ — **rozstrzygnięte 2026-09-06 wraz z implementacją S-06.** Nazwa zęba niesie typ uzębienia słownie (FR-021: „55 — drugi trzonowiec mleczny górny prawy"), a schemat (FR-074) niesie go rysunkiem: ząb mleczny rysowany jest mniejszy, w miejscu zęba stałego, który go zastąpi. Gdy kosztorys trzyma jednocześnie ząb mleczny i jego następcę (wymiana uzębienia), oba są rysowane — następca przesunięty na zewnątrz łuku — bo ząb, który jest w planie, nie może zniknąć pod innym. Kształt następcy w 85% to **przybliżenie**: skopiowana geometria ma współrzędne bezwzględne, więc kształt jest jednocześnie miejscem na łuku i osobnej geometrii mlecznej nie ma. Przybliżenie jest nazwane w legendzie schematu, a nie ukryte.
5. **Finalna nazwa statusu "poza bieżącym planem" wyświetlana pacjentowi.** Kandydaci: "Do rozważenia później", "Odroczone", "Poza bieżącym planem", "Do obserwacji" (ten ostatni ma znaczenie kliniczne — może mylić). _Default v1:_ "Odroczone". — _Owner:_ dentystka. _Block:_ nie (łatwa zmiana stringów UI).
6. **Retencja danych pacjenta i podstawa prawna (RODO).** Default v1: 12 miesięcy od daty utworzenia kosztorysu; e-mail usuwany razem z kosztorysem; sam kosztorys usuwany lub anonimizowany. Podstawa prawna: zgoda pacjenta wyrażona przy konsultacji (umowna), z wzmianką w polityce prywatności gabinetu. Czy ten domyślny model wystarcza, czy potrzebne są dodatkowe zabezpieczenia (np. opt-in, klauzula informacyjna w gabinecie)? — _Owner:_ dentystka + prawnik RODO. _Block:_ częściowy (niewymagane przed implementacją, ale **wymagane przed udostępnieniem aplikacji prawdziwym pacjentom**).
7. **Timeout sesji dentystki — po jakim czasie nieaktywności wylogować?** _Default v1:_ 8 godzin (typowy dzień pracy w gabinecie). — _Owner:_ dentystka. _Block:_ nie.
8. ~~**Treść walidacji struktury parsowania (FR-012).**~~ — **rozstrzygnięte 2026-09-05 wraz z implementacją S-02.** Wynik modelu jest walidowany dwuwarstwowo: schemat Zod pilnuje kształtu, a kod pilnuje znaczenia. Kod sprawdza (a) przynależność numeru zęba do notacji FDI, (b) obecność każdego id w cenniku, (c) czy pozycja jest dopuszczalna w kontekście, w jakim ją zaproponowano (pozycja ogólna nie trafia na ząb), (d) czy `visitNumber` wskazuje wizytę, która faktycznie została zaproponowana. Każde naruszenie **pomija** wartość i **nazywa** ją w ostrzeżeniu na formularzu — nigdy nie akceptuje po cichu i nigdy nie porzuca po cichu. Znacznik `(32?)` odczytywany jest jako status `uncertain`. Podział jest wymuszony przez dostawcę, nie wybrany: strukturyzowane wyjście Anthropica odrzuca `minimum`/`maximum` na liczbie, więc ząb 99 przechodzi walidację schematu i tylko kod może go zatrzymać.

   Dodatkowo, **model nie zapisuje pola `note`**. `note` jest częścią `content`, a `content` trafia dosłownie do każdego, kto ma link pacjenta (patrz _Invariant_ w `docs/reference/contract-surfaces.md`); model, który właśnie przeczytał poufną notatkę dentystki, nie dostaje pióra na stronie pacjenta. Kontekst, który trafiłby do notatki, trafia do ostrzeżeń — widzi je wyłącznie dentystka.

9. **Reguły grupowania wizyt i progi pilności, na których opiera się propozycja podziału (FR-014).** Domyślne reguły — ile zębów przypada na wizytę, że leczenie kanałowe liczy się jak dwa, że jedna wizyta to jedna strona łuku, że higienizacja i pantomogram idą na pierwszą wizytę, oraz które objawy z notatki oznaczają "urgent" — są punktem wyjścia napisanym przez implementację, nie decyzją kliniczną. Dentystka ma je przepisać po pierwszych realnych notatkach; do tego czasu propozycja pozostaje propozycją, którą i tak zatwierdza ręcznie (FR-013), a wszystko, czego notatka nie stwierdza wprost, jest nazwane w ostrzeżeniach (FR-015). — _Owner:_ dentystka. _Block:_ nie.
