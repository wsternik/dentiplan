# LLM prefill from the diagnosis note — Plan Brief

> Full plan: `context/changes/llm-parsing-prefill/plan.md`
> Research: `context/changes/llm-parsing-prefill/research.md`

## What & Why

The dentystka already pastes her raw diagnosis note into a scratch field on the
new-quote screen, then retypes everything it says into the form by hand. This
slice adds a "Wypełnij z notatki" button that sends **only that text** to
Anthropic and appends the teeth, treatments, visits and general items it found.
Roadmap S-02, PRD FR-011/012/013 — the last must-have in the PRD that the app
did not do.

## Starting Point

The form, the pricelist and the write path all exist and are proven. `rawText`
is a transient island field that has never left the browser. The write endpoints
already accept a quote tree with pricelist items **by id** and re-resolve prices
server-side. The AI SDK is in the repo from the CI review agent, but in
`devDependencies`. `ANTHROPIC_API_KEY` became a Worker secret at the start of
this session.

## Desired End State

Pasting `Do leczenie: 17,16 Kanałowe: 34,37,36, (32?) Kamień do usunięcia` and
clicking once leaves the form holding those six teeth — 32 marked `uncertain` —
with plausible treatments and pricelist items attached, a hygiene item under
general items, and a visible list of anything that was dropped. She corrects
what she disagrees with and approves by hand, as she always has. If the call
fails she sees one sentence and the form still works.

## Key Decisions Made

| Decision          | Choice                                           | Why                                                                                                                                                            | Source                                     |
| ----------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| Provider          | Anthropic via the AI SDK, `claude-sonnet-5`      | The stack the repo already speaks (`scripts/review/agent.ts`); a second SDK would buy nothing                                                                  | `tech-stack.md`                            |
| Response contract | The write endpoints' request, run backwards      | One contract for "a quote tree in transit" instead of two                                                                                                      | Research                                   |
| Id resolution     | Server-side, via the non-throwing `findItemById` | `resolvePricelistItem` throws, which is right for a write and wrong for a prefill                                                                              | Research                                   |
| **`note` field**  | **The model may not write it**                   | `note` is inside `content`, which is served verbatim to anyone with the patient link; a model that just read the confidential note gets no pen there (risk #3) | Research — **narrows the sketched schema** |
| Nullables         | Closed enums with `"unknown"`, `visitNumber: 0`  | Anthropic's structured output has already rejected one JSON-Schema construct on this repo; translation belongs in the tested mapper                            | Plan                                       |
| Merge behaviour   | Appends; duplicates warn                         | Nothing the dentystka typed is overwritten                                                                                                                     | Plan                                       |
| Tests             | Unit on fixtures, no e2e                         | The assertion would depend on model output — a flaky test of someone else's service                                                                            | Plan                                       |
| Text cap          | 4000 characters                                  | The app has no request-size bound anywhere; this call costs money                                                                                              | Research                                   |

## Scope

**In scope:** `src/lib/llm/` (schema, prompt, mapper, client) with fixtures and
risk #7 tests; `POST /api/admin/quotes/parse`; the env/secret declaration and
config banner; the editor button, merge and warnings list; PRD Open Question 8,
test-plan risk #7, roadmap S-02 → `done`, README, `contract-surfaces.md`. Plus one fix the M3L5 audit
turned up: `auth/signout.ts` never checks whether sign-out failed.

**Out of scope:** streaming, parse history, persisting `rawText`, a model picker,
promptfoo, any e2e for the prefill, the redesign, and any change to an existing
DOM role, label or button text.

## Architecture / Approach

```
rawText ──► POST /api/admin/quotes/parse ──► parseDiagnosis(text)
            (auth, 4000-char cap)              ├── DiagnosisModel.read()   ← the only network call
            never 200 on failure               └── mapParsedDiagnosis()    ← pure; risk #7 lives here
                                                     ├── isValidToothNumber  → drop + warn
                                                     └── findItemById        → drop + warn
            ◄── { content, warnings } ──────────────┘
      editor appends to state; rawText still never enters treePayload()
```

Model output is client input by another name: a schema for its shape, code for
its meaning. The untrusted surface is one pure function, and that function is
what the tests exercise — which is why they need no network.

## Phases at a Glance

| Phase                | What it delivers                                          | Key risk                                                          |
| -------------------- | --------------------------------------------------------- | ----------------------------------------------------------------- |
| 1. Parsing boundary  | Schema, prompt, mapper, fixtures, risk #7 tests           | Provider rejects a schema construct at runtime, not in tests      |
| 2. Endpoint + secret | The door, the env declaration, config banner, signout fix | First request-size bound in the app; getting it wrong costs money |
| 3. Button + merge    | The only user-visible part                                | Merge must never overwrite what she typed                         |
| 4. Documents         | PRD Q8, risk #7, roadmap, README                          | —                                                                 |

**Prerequisites:** `ANTHROPIC_API_KEY` as a Worker secret (done), green E2E as
the regression baseline (done, 4/4).
**Estimated effort:** one session, four commits.

## Open Risks & Assumptions

- **Polish parsing quality is the real unknown.** Mitigation is prompt
  iteration, not schema change — if the model reads the note badly, the schema
  is not what is wrong.
- **Nothing stops the model proposing a milk-tooth item for tooth 16.** The
  catalog has no dentition subsetting and neither does the app, so this is a
  prompt instruction, visible to the dentystka in the row she is approving.
- **Dropping `note` costs context.** `(32?)` becomes `uncertain` with no
  explanation attached. The warnings list carries that instead, where only she
  sees it.
- **A spend cap on the Anthropic account is an operator action** and is not verified by this plan.

## Success Criteria (Summary)

- A real note fills the form on **production**, warnings visible, approved by hand.
- Killing the key degrades to a banner and a usable form — never a 500, never a
  silent empty result.
- `npm run test:e2e` green before merge **with no edit to any spec**.
