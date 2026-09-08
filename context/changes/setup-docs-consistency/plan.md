# Local setup documentation consistency

## Current State Analysis

- `README.md` copies `.env.example` to `.dev.vars` even though a dedicated `.dev.vars.example` exists.
- The design brief link still points at the former in-flight change path; the brief now lives in the dated archive.
- The roadmap summary calls the SVG odontogram out of scope although S-06 is shipped and recorded as done in `context/foundation/roadmap.md`.
- `supabase/config.toml` enables `db.seed` and references `supabase/seed.sql`, which does not exist. The project has no database seed contract: the pricelist is repository data and the sole operator account is created manually.

## Desired End State

README links and setup commands resolve against a clean checkout, shipped capabilities are described as shipped, and `supabase db reset` applies migrations without looking for a nonexistent seed file.

## What We're NOT Doing

- Adding sample patient, quote, pricelist, or auth data to the database.
- Changing migrations, hosted schema, product behavior, or the roadmap itself.
- Automating creation of the single operator account.

## Phase 1: Align setup documentation and local Supabase configuration

### Changes Required

#### 1. Correct local environment and design-document references

**File:** `README.md`

**Intent:** Make setup commands and links point to files present in a clean checkout.

**Contract:** Cloudflare local development copies `.dev.vars.example`; the design brief link targets its archived path.

#### 2. Describe the shipped odontogram accurately

**File:** `README.md`

**Intent:** Keep the high-level roadmap summary consistent with the canonical roadmap and current UI.

**Contract:** The odontogram is listed among shipped capabilities, while only drag-and-drop and the other genuinely parked items remain out of scope.

#### 3. Disable the absent database seed step

**File:** `supabase/config.toml`

**Intent:** Prevent local reset from resolving a seed file the project does not define.

**Contract:** `[db.seed]` is disabled and no empty or synthetic seed is introduced.

### Success Criteria

#### Automated Verification

- Repository-local Markdown links in `README.md` resolve to existing paths.
- README references `.dev.vars.example` and does not call the shipped odontogram out of scope.
- Supabase config parses and reports database seeding as disabled.
- `npm run format:check` passes if the repository exposes that command; otherwise Prettier check passes for changed files.
- `supabase db reset` completes when the local Docker/Supabase environment is available.

#### Manual Verification

- Setup text remains coherent: migrations create schema, the operator account is still explicitly manual, and no data seed is promised.

## Testing Strategy

- Use a small link checker over Markdown destinations in `README.md`.
- Parse the Supabase config through the CLI and run `npx supabase db reset` against the local stack.
- Run Prettier on the changed Markdown and TOML files and inspect the targeted diff.

## Migration Notes

No hosted migration is involved. Disabling local seeding affects only `supabase db reset`; no seed file existed to execute.

## References

- Audit finding: `dowody/audyt-zaliczenia/raport-2026-09-08.md`, AUD-07
- Canonical shipped state: `context/foundation/roadmap.md`, S-06
- Archived design brief: `context/archive/2026-09-05-ui-redesign/design-brief.md`

## Progress

### Phase 1: Align setup documentation and local Supabase configuration

#### Automated

- [ ] 1.1 README local links resolve
- [ ] 1.2 README setup and odontogram statements match the repository
- [ ] 1.3 Supabase config parses with database seeding disabled
- [ ] 1.4 Changed files pass formatting checks
- [ ] 1.5 Local database reset completes

#### Manual

- [ ] 1.6 Setup narrative is internally consistent
