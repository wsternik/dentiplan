---
change_id: llm-parsing-prefill
title: LLM pre-fills the quote form from the dentystka's pasted note
status: impl_reviewed
created: 2026-09-05
updated: 2026-09-05
archived_at: null
---

## Notes

Roadmap S-02, PRD FR-011 / FR-012, with FR-013 as the hard constraint: the LLM is
an accelerator, never a gate. If the call fails the dentystka fills the form by
hand exactly as she does today.

Provider decision (closed 2026-09-05, see `tech-stack.md` §LLM provider):
Anthropic through the AI SDK, `generateText` + `Output.object` against a Zod
schema, no tool loop. Same stack as `scripts/review/agent.ts`.

The mapping from the model's output onto `QuoteContent` is done in code, not by
the model: pricelist ids are resolved server-side, ids outside the pricelist and
tooth numbers outside FDI become FR-012 warnings and are dropped from the
prefill — never silently accepted, never silently dropped.

Privacy is structural: `parseDiagnosis(text: string)` takes the note and nothing
else, so `patient_email` has no path into a prompt (FR-011, FR-072).
