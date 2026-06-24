# AST-Bench V3 — Live-DB, De-Leaked, 3-Lane Benchmark (Design)

**Date:** 2026-06-24
**Status:** Awaiting final GO before execution
**Supersedes the public claim contract of:** V2 (file-backed, 2-lane, answer-key-leaked)

## Goal

The most realistic, senior-Postgres-engineer-proof benchmark of how database
design affects AI coding-agent effort — built so a non-technical CEO sees the
page and concludes, on their own, *"MongoDB is the cost-efficient choice for
working with coding agents,"* AND that conclusion survives an adversarial
Postgres expert.

Two north-star acceptance tests:
1. **CEO test:** a non-developer reads the page and says the sentence above
   without prompting.
2. **Adversary test:** a senior Postgres engineer cannot find a false claim or
   an unfair setup that invalidates the headline.

## What changes vs V2 (and why)

The 2026-06-24 adversarial review (verified against code, not docs) found three
real defects. V3 fixes all three:

| V2 defect (confirmed in code) | V3 fix |
|---|---|
| **Not live-DB-backed.** `npm test` ran `node tests/acceptance.test.mjs` on `tables.json`; no DB client anywhere. Page said "live local database" (false). | Runs execute against **live Docker MongoDB (:27018) + Postgres (:5433)**. Agent connects with a real driver, reads context, writes results. Test **queries the live DB** to verify. |
| **Answer too close to the fixture.** Accepted solution did `status: request.expected_outcome`, `body: request.customer_message` — copied answer-key fields. Measured wiring, not reasoning. | **De-leak:** remove answer fields from fixtures. Agent must **derive** status, owner routing, risk signals, message, next step from raw facts. **Negative controls** added: non-qualifying accounts whose correct answer differs. Test recomputes the expected answer from raw facts. |
| **"You didn't let me be Postgres."** Only normalized rows; no JSONB/tuned option. Page called it "best-practice" without review. | **Third lane:** `postgres-jsonb` — a tuned single-table JSONB design shaped like the Mongo document. The fair fight. |

## Experimental design

- **Business outcome (1, shared):** `strategic-account-rescue` (unchanged
  intent: combine account/contract/support/invoice/usage/shipment/regulatory/
  audit context; route owners; produce customer-safe portal state + audit
  timeline).
- **Lanes (3):**
  - `mongo` — one document per account, native document model.
  - `postgres-norm` — idiomatic normalized relational model (the existing
    shape gradient lives here).
  - `postgres-jsonb` — tuned Postgres: a primary table with a `JSONB` column
    holding the same access-pattern-shaped payload as the Mongo document
    (one `GIN` index). The "best Postgres" counter-lane.
- **Shapes (3):** `shallow / moderate / deep` — relational depth. Applies to
  `postgres-norm`. `mongo` and `postgres-jsonb` are shape-invariant by nature
  (one document / one JSONB blob), run at all 3 shape slots for a symmetric
  grid and equal sample size, exactly as V2 already does for `mongo`.
- **Repeats:** 5 per cell. **Agents:** 2 (`claude-code`, `codex`).
- **Total:** 3 shapes × 3 lanes × 5 repeats × 2 agents = **90 runs**.

Plus a small **negative-control set** (see below) run once per lane per agent
to prove reasoning (not scored into the cost aggregate; reported as a
pass/fail integrity badge).

## Live-DB architecture

Reuse the proven V1 access pattern (`mongosh` for Mongo, `docker exec psql`
for Postgres) and the existing healthy containers. **No new infra.**

Per run:
1. **Isolated namespace** (no cross-run contamination across 90 runs):
   - Mongo: database `astbench_<shape>_<lane>_<agent>_r<repeat>`.
   - Postgres: schema `astbench_<shape>_<lane>_<agent>_r<repeat>` in
     `sql_hidden_cost`.
2. **Seed** the namespace from the deterministic fixture (DDL + inserts via
   `psql`; `insertMany` via `mongosh`).
3. **Inject connection config** into the agent workspace (`.env` /
   `db-config.json`): URI/host/port/namespace. Workspace gets `mongodb` / `pg`
   installed (`npm i` in the target before freeze).
4. **Agent task:** implement `src/workflow.mjs` that **connects to the live
   DB**, reads raw facts, derives the workflow, and **persists** results back
   to the live DB.
5. **Acceptance test** (`npm test`) connects to the live DB, reads persisted
   state, and asserts correctness by **recomputing the expected answer from
   the raw input facts** (canonical derivation module shared by the test).
6. **Capture:** `db-before` = seeded snapshot (dump), `db-after` = post-run
   dump, plus transcript/diff/tokens as today.
7. **Teardown:** drop the namespace after capture.

Fairness control: the raw facts are byte-identical across all 3 lanes (only
storage shape differs); the canonical derivation produces the same expected
answer in every lane. A MongoDB or normalized loss on any metric/shape stays
visible.

## De-leak + negative controls (the reasoning proof)

**Remove from fixtures:** `expected_outcome`, `next_step`, `customer_message`,
pre-baked `workflow_request_owner_groups`, pre-baked
`workflow_request_risk_signals`. These become things the agent must DERIVE.

**Canonical derivation (deterministic, computed from raw facts):**
- **Qualifies** iff `tier ∈ {strategic, enterprise}` AND at least one active
  risk among {delayed shipment, overdue high-value invoice, open regulatory
  flag, high-severity support case, usage cliff}.
- **status:** qualifies → the escalation-active string; else → the
  monitoring/no-escalation string (negative-control answer).
- **owner routing (derived from which risks fired, fixed priority):**
  regulatory→Legal, invoice/contract→Finance, shipment/usage→Customer Success,
  support→Support. Order fixed; non-qualifying → no owners.
- **risk signals:** computed by evaluating each domain against thresholds
  (invoice overdue & amount ≥ threshold; shipment past SLA; regulatory flag
  open; support severity ≥ high; usage drop ≥ threshold).
- **customer message:** agent-generated; test asserts non-empty, length
  threshold, and **contains no internal tokens** (account ids, internal status
  codes) — a "customer-safe" check, not a string match.
- **next step:** derived from top-priority owner.

**Negative controls (≥3 variants per lane):**
- Non-qualifying mid-tier account, no active risk → expected: no escalation,
  no owners.
- Strategic account, all risks cleared → expected: monitoring.
- Strategic account, single regulatory flag only → expected: escalation,
  Legal-only routing.
Acceptance **fails** if the agent emits the escalation answer for a
non-qualifying account (i.e., copying a status string can't pass).

## Scoring & claim

- **Within-agent only** (unchanged; cross-agent token counts never compared).
- Token metric = corrected `extractUsage` (Claude per-turn dedup sum; Codex
  `input_tokens` alone) — reuse, do not re-derive.
- **Primary pairwise comparisons** reported per agent:
  - `mongo` vs `postgres-norm` (the headline gap).
  - `mongo` vs `postgres-jsonb` (the fair fight; may be close — reported
    honestly either way).
- Depth trend for `postgres-norm` (honest, may be non-monotone).
- **Honest headline logic:** if `jsonb ≈ mongo`, the page says so plainly and
  pivots to the true, stronger message: *the document/access-pattern shape is
  what saves agent effort; MongoDB gives it by default, while matching it in
  Postgres means hand-building and maintaining a denormalized JSONB model and
  giving up the relational guarantees Postgres was chosen for.*

## UI / CEO framing (cost-led)

- **Headline pivots to money:** lead with cost, not "work."
- **Scaled projection:** "$X per task → $Y per 1,000 agent tasks → $Z/month"
  with **assumptions visible and adjustable on-screen** (tasks/month, blended
  token price), rendered **separate from measured per-task deltas** (existing
  gate already mandates this separation).
- Keep the plain-language primer, the 3-design depth story (now 3 lanes), the
  honest non-monotone disclosure, the evidence drawer, fail-closed behavior.
- Add a one-line, CEO-readable "bottom line" sentence the page earns from the
  data.

## Anti-cheat & integrity (preserve + extend)

- Keep `detectCheatSignals` (global injection), frozen-commit diff, hash
  re-verification, fail-closed page, no-overclaim gates.
- **New gate:** forbid live-DB-overclaim copy unless a run manifest proves
  `executionMode: "live-db"` (already added 2026-06-24; extend to require the
  mode field).
- **New gate:** negative-control set must be green for a lane before that
  lane's results render (a lane that only passes the positive case can't
  claim "reasoning").
- **New gate:** fixtures must NOT contain the removed answer-key fields
  (`expected_outcome` etc.) — prevents silent re-leak.

## Scope, cost, risk (stated for GO)

- **Cost:** ~90 agent runs + smoke + harness-build subagents ≈ **$200–300 in
  real tokens.** Overnight wall-clock with pacing gaps (Codex rate-limit
  cascade mitigation from V2).
- **Smoke gate before the big spend:** build harness → run **1 cell per lane
  per agent (6 runs, ~$15)** → verify live-DB de-leaked flow passes AND
  negative controls reject copying → only then launch the full 90.
- **Headline risk (must accept):** de-leak + JSONB lane may show JSONB-PG ties
  MongoDB. The honest result is then "shape wins, JSONB matches it at the cost
  of normalization," not a clean "MongoDB beats Postgres." This is more
  defensible but not the simple headline. Reported as the data lands.
- **Failure risk:** de-leak may cause some agent runs to genuinely fail
  (agent derives wrong). That's a real signal, not a bug — failures stay
  visible; we do not loosen the test to force passes.

## Out of scope (this round)

- Cursor as a third agent. More business outcomes (stays single-outcome).
- Auto-deploy of the new artifact: the rebuilt page carries NEW claims, so it
  gets a human look before going live (no outward publish without final GO).
