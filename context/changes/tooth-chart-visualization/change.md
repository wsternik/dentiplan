---
change_id: tooth-chart-visualization
title: Tooth chart on the patient page and in the editor
status: plan_reviewed
created: 2026-09-06
updated: 2026-09-06
archived_at: null
---

## Notes

S-06. The patient sees a dental chart with the plan's teeth marked — colour by
urgency, status (`in-plan` / `uncertain` / `out-of-current-plan`) distinguishable
**also by shape/outline**, tooltip on hover/tap with tooth name, treatment and
cost. In the editor the dentystka clicks a tooth on the same drawing to add it to
the plan or to jump to its row. The grouped list (FR-061) stays as the
accessibility and print layer.

Decided before this change started, not to be renegotiated: tooth geometry is
**copied**, not installed — from the local clone `../react-odontogram` (v0.5.6,
MIT) into `src/lib/tooth-chart/paths.ts` as data, with the licence notice and a
root `THIRD-PARTY-NOTICES.md`. The component is written here, controlled.
`npm install react-odontogram` is out: its `readOnly` kills `pointer-events`
(the patient page needs a tooltip), selection is uncontrolled, FDI 51–85 does
not exist in it, and status is carried by colour alone.
