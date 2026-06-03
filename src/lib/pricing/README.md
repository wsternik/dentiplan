# Cennik (pricelist) — jak zmienić cenę

Cennik gabinetu jest zapisany w kodzie aplikacji (nie ma panelu administracyjnego —
to świadoma decyzja na wersję v1). Zmiana ceny = krótka edycja pliku + wdrożenie.

## Gdzie są ceny

- `data/pricing.json` — wszystkie zabiegi pogrupowane w kategorie.
- `data/pricing-narkoza.json` — model opłaty za znieczulenie ogólne (narkozę).

## Jak zmienić cenę zabiegu

W `data/pricing.json` znajdź pozycję po nazwie i edytuj pola:

| Pole | Znaczenie |
| --- | --- |
| `price_type` | `fixed` = jedna cena · `range` = widełki · `modifier` = dopłata (np. +500 zł) · `from` = cena „od" |
| `price_min` | cena (dla `fixed`/`modifier`/`from`) lub dolna granica widełek (dla `range`) |
| `price_max` | górna granica widełek — **tylko** dla `range`; w pozostałych przypadkach musi być `null` |
| `display` | tekst pokazywany pacjentowi (np. `"450–500 zł"`) — zmień ręcznie, by pasował do nowej ceny |
| `note` | opcjonalna notatka przy pozycji (lub `null`) |

Przykład — podniesienie ceny higienizacji:

```json
{ "name": "Higienizacja", "price_type": "range", "price_min": 450, "price_max": 500, "note": null, "display": "450–500 zł" }
```

## Przed zapisaniem — uruchom walidację

```bash
npm run validate:pricing
```

Skrypt sprawdza, czy cennik jest poprawny (typy cen, kompletność oznaczeń). Jeśli
wypisze błąd i zakończy się niepowodzeniem — popraw wskazaną pozycję i uruchom
ponownie, aż zobaczysz `✓`.

## Co dalej

- Zmiana wchodzi w życie dopiero po **wdrożeniu** (PR + redeploy) — sama edycja
  pliku lokalnie nie zmienia działającej aplikacji.
- **Zatwierdzone kosztorysy się nie zmieniają.** Każdy zaakceptowany kosztorys
  przechowuje ceny z momentu zatwierdzenia (FR-050), więc zmiana cennika nigdy nie
  modyfikuje historycznych wycen — dotyczy tylko nowych kosztorysów.

> Uwaga techniczna: dodanie/usunięcie pozycji wymaga też aktualizacji mapy oznaczeń
> (`localAnesthesia` / `validForTooth` / `validForGeneral`) w `seed.ts` — `validate:pricing`
> wymusi to, zgłaszając brakujące oznaczenie. Zmiana samej ceny nie wymaga ruszania `seed.ts`.
