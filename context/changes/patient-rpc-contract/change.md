---
change_id: patient-rpc-contract
title: Restrict the public patient RPC contract
status: impl_reviewed
created: 2026-09-08
updated: 2026-09-08
archived_at: null
---

## Notes

Remove the internal quote UUID from the anonymous patient RPC while preserving its approved-token and no-disclosure behaviour. Keep the hosted schema, generated types, application contract, SQL probe, and raw-response test synchronized.
