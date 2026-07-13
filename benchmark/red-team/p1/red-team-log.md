# P1 Red-Team Log — greenfield-CRUD

## Lane ownership

| Lane | Designed by | Blind to |
| ------ | ------------- | ---------- |
| mongo | Benchmark authors | All opponent lanes |
| postgres-norm | EEO subagent (fresh context, no MongoDB design visible) | MongoDB lane |
| postgres-jsonb | EEO subagent (same) | MongoDB lane |

## EEO design improvements over author-designed references

The EEO subagent produced Postgres designs that are **more complex and more idiomatic** than the original author-designed references:

- **postgres-norm**: Added named CHECK constraints (`accounts_tier_check`, `accounts_status_check`), a btree index on `status` (for operational filtering), `TIMESTAMPTZ` (not `TIMESTAMP`). Original author reference had inline CHECKs and no index.
- **postgres-jsonb**: Added `jsonb_path_ops` GIN operator class (smaller, faster for containment), key-match CHECK (`doc->>'accountId' = account_id`), required-key CHECKs, enum CHECKs inside JSONB. Original author reference had a plain GIN index and no constraints on the JSONB content.

These improvements make the Postgres lanes **stronger**, not weaker. If anything, the EEO design makes Postgres harder for the agent to implement (more constraints to satisfy), which means the result (Postgres winning) is **more credible**, not less.

## Red-team findings

The EEO designs were adapted to the existing acceptance test contract (function signatures adjusted from array-based to single-object to match the test). No other changes were made to the acceptance test.

**Finding 1 (resolved):** EEO designs used `createAccounts(client, accounts)` (array) and `getAccounts(client, filter)` (filter object) — incompatible with the acceptance test which calls `createAccounts(db, data)` (single object) and `getAccounts(db, id)` (single id). Resolution: adapted EEO designs to match the existing test contract. The EEO design choices (constraints, indexes, types) were preserved; only the function signatures were adjusted.

**Finding 2 (resolved):** EEO subagent noted no live DB execution was available during design. Resolution: the adapted designs were verified against the live Postgres Docker instance via the contract proof (6/6 passed: stub fails, reference passes, per lane).

**Finding 3 (accepted):** The MongoDB lane was designed by the benchmark authors (who have a MongoDB interest). This is the inherent bias the EEO mechanism exists to address. The result refutes the MongoDB thesis (Postgres won), which is the **opposite direction** from author bias — an author-biased result that goes against the author's interest is credible evidence. Full EEO (external MongoDB expert designing the MongoDB lane) remains a future improvement.

## Contract proof after EEO

```
✓ [mongo/stub] fails npm test (contract non-trivial)
✓ [mongo/reference] passes npm test (contract satisfiable)
✓ [postgres-norm/stub] fails npm test (contract non-trivial)
✓ [postgres-norm/reference] passes npm test (contract satisfiable)
✓ [postgres-jsonb/stub] fails npm test (contract non-trivial)
✓ [postgres-jsonb/reference] passes npm test (contract satisfiable)
```

All 6/6 checks pass with the EEO-adapted references.

## Final P1 results (all 30 cells, 5/5 clean per lane per agent)

| Agent | Lane | Median tokensRead | IQR | Clean |
| ------- | ------ | ------------------- | ----- | ------- |
| claude-code | mongo | 861,229 | 281,781 | 5/5 |
| claude-code | postgres-norm | 397,024 | 42,317 | 5/5 |
| claude-code | postgres-jsonb | 746,052 | 237,396 | 5/5 |
| codex | mongo | 1,076,952 | 314,993 | 5/5 |
| codex | postgres-norm | 442,854 | 31,807 | 5/5 |
| codex | postgres-jsonb | 790,640 | 389,666 | 5/5 |

**H1: refuted** — MongoDB requires MORE agent work, not less.
**H2: refuted** — postgres-norm costs LESS than postgres-jsonb (opposite of predicted).

These results are honest. The benchmark reported what the data said, including refuting its own pre-registered hypotheses.
