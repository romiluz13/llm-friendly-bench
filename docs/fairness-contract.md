# Build-Bench Fairness Contract

This document defines the rules that keep Build-Bench credible when the authors have a MongoDB interest to defend. It is the Equal-Effort Opponent (EEO) contract that every external lane designer must sign before contributing a lane design.

## Why this exists

Vendor-run benchmarks get credibility backlash when the vendor designs the opponent's lane (tuned-vs-out-of-box bias). The database industry's history is clear: OnGres/EDB vs MongoDB, TimescaleDB vs vanilla Postgres, ScyllaDB vs Cassandra — all criticized for comparing a highly-tuned product against an out-of-the-box opponent. The strongest defense is Equal-Effort Opponent design: each side's expert tunes their own lane to its ceiling, blind to the opponent.

## Lane ownership

| Lane | Designed by | Blind to |
| ------ | ------------- | ---------- |
| `mongo` | Benchmark authors | All opponent lanes |
| `postgres-norm` | External Postgres engineer | The MongoDB lane and all other lanes |
| `postgres-jsonb` | External Postgres engineer (same or different) | All other lanes |
| `sqlite` | External SQLite engineer | All other lanes |
| `prisma-on-postgres` | External ORM specialist | All other lanes |

The authors own ONLY the MongoDB lane. Every other lane is designed by an external engineer with no MongoDB affiliation.

## The contract every lane designer signs

By contributing a lane design to Build-Bench, you agree to:

### 1. Equal effort

- You receive the same task specs, the same acceptance contract, and the same resource budget (time + model access) as every other lane designer.
- You tune your lane to its idiomatic ceiling — the design a senior engineer would actually reach for in production.
- You do NOT deliberately weaken your lane. If you believe a design choice is idiomatic, you make it, even if it might score well.

### 2. Blindness

- You cannot see any other lane's design — not the MongoDB lane, not any other opponent lane.
- You design from the task spec and your own expertise, not by reacting to the opponent.
- If you accidentally see another lane's design, you report it immediately. The lane may need to be redesigned or independently re-verified.

### 3. Documented rationale

For every design choice you make, you document:

- **What** you chose (e.g., "normalized into 8 tables", "JSONB with GIN index", "embedded array")
- **Why** you chose it (the idiomatic reasoning — why a senior engineer for this DB would reach for this design)
- **What you rejected** and why (e.g., "considered a single-table design but rejected because it violates normalization best practice for this DB")

This rationale is published as part of the evidence. It lets any reviewer audit whether your design is a credible representative of your DB's best practice.

### 4. No strawman

- You must NOT design a deliberately weak lane to make the opponent look good.
- If you are the Postgres engineer, you must design the best Postgres design you can — the one you would defend in a code review at your company.
- The red-team phase (below) is specifically designed to catch strawman designs — and if the red-team finds one, the lane is rejected and must be redesigned.

### 5. Acceptance contract

- Your lane must pass the same no-agent contract proof as every other lane: the stub solution fails `npm test` (contract is non-trivial) and your reference solution passes (contract is satisfiable).
- Negative controls must fail (copy-the-answer/copy-the-pattern must not pass).
- If your reference solution cannot pass, the task spec is unsatisfiable for your DB — report it, and the task spec will be revised, not your lane weakened.

## Red-team phase

After all lane designs are submitted, and BEFORE any agent runs:

1. Each lane designer audits one opponent lane for strawman designs, missing indexes, unidiomatic choices, or configuration bias.
2. Findings are filed as GitHub issues on this repo.
3. The lane owner must fix the finding or formally defend the choice in the issue.
4. Iterate until no structural "free win" remains.
5. The red-team log (all findings + resolutions) is published as evidence.

The red-team is logged at `benchmark/red-team/<phase>/` and is part of the public evidence bundle.

## Pre-registration

After the red-team phase converges, and BEFORE any agent runs:

1. The full protocol is frozen: task set, lane designs, metrics, analysis plan, and pre-registered hypotheses (H1-H4).
2. Everything is timestamped and archived as an immutable git tag (`buildbench-preregistered-<phase>`) plus a SHA manifest of all frozen artifacts.
3. After registration, the task set and lane designs CANNOT be changed — no adding/removing tasks because early results look bad.
4. If a task or lane is discovered to be broken after registration, it is marked as broken and excluded from the final report — not silently fixed.

## Pre-registered hypotheses

- **H1:** MongoDB requires less agent work (`tokensRead`) than any relational lane, within-agent.
- **H2:** The relational penalty grows with schema normalization depth (postgres-norm > postgres-jsonb > mongo).
- **H3:** ORM abstraction (Prisma) recovers some but not all of the relational penalty.
- **H4 (pre-registered null):** SQLite may differ on the operational axis but not predictably on the schema axis.

Each hypothesis will be marked confirmed, refuted, or inconclusive in the final report — based on the data, regardless of whether it favors MongoDB.

## Onboarding process for external engineers

### Step 1: Recruit

The benchmark authors recruit an external engineer for each non-MongoDB lane. The engineer should:

- Be a recognized practitioner of that DB (not a MongoDB employee or affiliate).
- Have production experience designing schemas and building features against that DB.
- Be willing to document their reasoning and subject their design to red-team review.

### Step 2: Onboard

1. The engineer is given this fairness contract to read and sign (by contributing, they agree).
2. The engineer is given the task specs and acceptance contracts — but NO access to other lane designs.
3. The engineer is given the same resource budget: a time allocation (e.g., 4 hours per task type) and model access (the same pinned cheap-tier models: Claude Sonnet 4.6, Codex gpt-5.4-mini).

### Step 3: Design

1. The engineer designs their lane for each task type: schema, migration, reference solution.
2. The engineer documents the rationale for every design choice (what, why, what was rejected).
3. The engineer verifies their reference solution passes the acceptance contract against the live DB.

### Step 4: Red-team

1. After all lanes are submitted, each engineer is assigned one opponent lane to audit.
2. The engineer files findings as GitHub issues.
3. Lane owners fix or defend.
4. Iterate until convergence.

### Step 5: Pre-register

1. The final lane designs are frozen and timestamped.
2. No changes after pre-registration.

## What this benchmark will NOT claim

- Not production performance — build-time work only.
- Not cross-agent absolute comparison — within-agent only.
- Not "MongoDB is always better" — task-type breakdown may show relational wins on specific task types. Report honestly.
- No claim until the EEO independent fairness review signs off.

## Amendment

This contract may be amended before pre-registration. After pre-registration, it is frozen along with the protocol.
