# EEO Postgres Design — Greenfield-CRUD `accounts` Resource

Equal-Effort Opponent lane design for the AST-Bench greenfield-CRUD task.
Two Postgres lanes: `postgres-norm` (normalized relational) and `postgres-jsonb` (JSONB document).
Each lane ships a `schema.mjs` (`ensureSchema`) and `accounts.mjs` (CRUD handlers).

The `db.mjs` connection helper is provided by the benchmark harness — a `pg.Client` with
`search_path` already set to the run schema. Handlers receive that client and must use
parameterized queries (`$1`, `$2`, …). The acceptance test calls the handlers **and** queries
the live DB directly, so row shape and constraint enforcement must match exactly.

---

## Lane 1: `postgres-norm` — Normalized Relational Design

### File: `postgres-norm/schema.mjs`

```javascript
// schema.mjs — postgres-norm lane
// Normalized relational design for the `accounts` resource.
// Snake_case columns; handlers map camelCase <-> snake_case.

/**
 * Create the accounts table if it does not already exist.
 *
 * Design:
 *  - account_id TEXT PRIMARY KEY      — natural business key, caller-supplied.
 *  - name TEXT NOT NULL               — required display name.
 *  - tier TEXT NOT NULL CHECK(...)    — enum enforced at the DB level (TEXT+CHECK,
 *                                       not native ENUM, for evolvability).
 *  - status TEXT NOT NULL CHECK(...)  — same rationale as tier.
 *  - created_at TIMESTAMPTZ NOT NULL  — required, stored in UTC for portability.
 *
 * Index: btree on (status) supports the most common operational filter
 *        (active/at-risk/churned rollups) without over-indexing.
 *
 * @param {import('pg').Client} client
 */
export async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      account_id  TEXT        PRIMARY KEY,
      name        TEXT        NOT NULL,
      tier        TEXT        NOT NULL,
      status      TEXT        NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL,
      CONSTRAINT accounts_tier_check
        CHECK (tier IN ('strategic', 'midmarket', 'standard')),
      CONSTRAINT accounts_status_check
        CHECK (status IN ('active', 'at-risk', 'churned'))
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_status
      ON accounts (status);
  `);
}
```

### File: `postgres-norm/accounts.mjs`

```javascript
// accounts.mjs — postgres-norm lane
// CRUD handlers for the accounts resource.
// The DB stores snake_case columns; the API contract uses camelCase.
// Every query is parameterized ($1, $2, …) — no string interpolation.

/**
 * Insert one or more account rows.
 * @param {import('pg').Client} client
 * @param {Array<{accountId:string,name:string,tier:string,status:string,createdAt:string|Date}>} accounts
 * @returns {Promise<Array<{accountId:string,name:string,tier:string,status:string,createdAt:string}>>}
 */
export async function createAccounts(client, accounts) {
  const rows = [];
  for (const a of accounts) {
    const result = await client.query(
      `INSERT INTO accounts (account_id, name, tier, status, created_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING account_id, name, tier, status, created_at`,
      [a.accountId, a.name, a.tier, a.status, a.createdAt]
    );
    rows.push(rowToCamel(result.rows[0]));
  }
  return rows;
}

/**
 * Fetch accounts matching optional filters.
 * Pass an empty filter object to return all rows.
 * @param {import('pg').Client} client
 * @param {object} [filter] — { tier?, status? } equality filters
 * @returns {Promise<Array<{accountId:string,name:string,tier:string,status:string,createdAt:string}>>}
 */
export async function getAccounts(client, filter = {}) {
  const conditions = [];
  const values = [];
  if (filter.tier) {
    values.push(filter.tier);
    conditions.push(`tier = $${values.length}`);
  }
  if (filter.status) {
    values.push(filter.status);
    conditions.push(`status = $${values.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const result = await client.query(
    `SELECT account_id, name, tier, status, created_at
     FROM accounts
     ${where}
     ORDER BY account_id`,
    values
  );
  return result.rows.map(rowToCamel);
}

/**
 * Patch one account by account_id.
 * Only the provided fields are updated (partial update).
 * @param {import('pg').Client} client
 * @param {string} accountId
 * @param {object} updates — { name?, tier?, status? }
 * @returns {Promise<{accountId:string,name:string,tier:string,status:string,createdAt:string}|null>}
 */
export async function updateAccounts(client, accountId, updates) {
  const sets = [];
  const values = [];
  if (updates.name !== undefined) {
    values.push(updates.name);
    sets.push(`name = $${values.length}`);
  }
  if (updates.tier !== undefined) {
    values.push(updates.tier);
    sets.push(`tier = $${values.length}`);
  }
  if (updates.status !== undefined) {
    values.push(updates.status);
    sets.push(`status = $${values.length}`);
  }
  if (!sets.length) {
    // Nothing to update — return current row.
    const result = await client.query(
      `SELECT account_id, name, tier, status, created_at
       FROM accounts WHERE account_id = $1`,
      [accountId]
    );
    return result.rows.length ? rowToCamel(result.rows[0]) : null;
  }
  values.push(accountId);
  const result = await client.query(
    `UPDATE accounts SET ${sets.join(", ")}
     WHERE account_id = $${values.length}
     RETURNING account_id, name, tier, status, created_at`,
    values
  );
  return result.rows.length ? rowToCamel(result.rows[0]) : null;
}

/**
 * Delete one account by account_id.
 * @param {import('pg').Client} client
 * @param {string} accountId
 * @returns {Promise<boolean>} true if a row was deleted
 */
export async function deleteAccounts(client, accountId) {
  const result = await client.query(
    `DELETE FROM accounts WHERE account_id = $1`,
    [accountId]
  );
  return result.rowCount > 0;
}

/* ---- helpers ---- */

function rowToCamel(row) {
  return {
    accountId: row.account_id,
    name: row.name,
    tier: row.tier,
    status: row.status,
    createdAt: row.created_at,
  };
}
```

---

## Lane 2: `postgres-jsonb` — JSONB Document Design

### File: `postgres-jsonb/schema.mjs`

```javascript
// schema.mjs — postgres-jsonb lane
// Document-style design: account_id is the PK column; the full document
// (including accountId, name, tier, status, createdAt) lives in a JSONB `doc` column.

/**
 * Create the accounts table if it does not already exist.
 *
 * Design:
 *  - account_id TEXT PRIMARY KEY   — the document key, stored as a real column
 *                                     so it can be referenced in WHERE / JOIN / FK.
 *  - doc JSONB NOT NULL            — the full account document.
 *
 * Integrity:
 *  - CHECK that doc->>'accountId' matches the PK column (defense against drift).
 *  - CHECK that required keys exist (name, tier, status, createdAt).
 *  - CHECK that tier and status values are within the allowed enum set.
 *  This is the JSONB equivalent of the normalized lane's column constraints —
 *  without it, JSONB silently accepts malformed documents.
 *
 * Index:
 *  - GIN on doc USING jsonb_path_ops — smallest, fastest GIN variant for
 *    containment queries (WHERE doc @> '{"status":"active"}').  We use
 *    jsonb_path_ops over the default jsonb_ops because the doc is small and
 *    we query by containment, not key-existence.
 *
 * @param {import('pg').Client} client
 */
export async function ensureSchema(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      account_id TEXT   PRIMARY KEY,
      doc        JSONB  NOT NULL,
      CONSTRAINT accounts_doc_key_match
        CHECK (doc->>'accountId' = account_id),
      CONSTRAINT accounts_doc_has_name
        CHECK (doc ? 'name' AND (doc->>'name') IS NOT NULL),
      CONSTRAINT accounts_doc_has_tier
        CHECK (doc ? 'tier' AND (doc->>'tier') IS NOT NULL),
      CONSTRAINT accounts_doc_has_status
        CHECK (doc ? 'status' AND (doc->>'status') IS NOT NULL),
      CONSTRAINT accounts_doc_has_created_at
        CHECK (doc ? 'createdAt' AND (doc->>'createdAt') IS NOT NULL),
      CONSTRAINT accounts_doc_tier_check
        CHECK (doc->>'tier' IN ('strategic', 'midmarket', 'standard')),
      CONSTRAINT accounts_doc_status_check
        CHECK (doc->>'status' IN ('active', 'at-risk', 'churned'))
    );

    CREATE INDEX IF NOT EXISTS idx_accounts_doc_gin
      ON accounts USING GIN (doc jsonb_path_ops);
  `);
}
```

### File: `postgres-jsonb/accounts.mjs`

```javascript
// accounts.mjs — postgres-jsonb lane
// CRUD handlers for the accounts resource.
// The full document (camelCase keys) is stored in the JSONB `doc` column.
// account_id is mirrored as the PK column for fast lookups and joins.
// Every query is parameterized ($1, $2, …) — no string interpolation.

/**
 * Insert one or more account documents.
 * @param {import('pg').Client} client
 * @param {Array<{accountId:string,name:string,tier:string,status:string,createdAt:string|Date}>} accounts
 * @returns {Promise<Array<{accountId:string,name:string,tier:string,status:string,createdAt:string}>>}
 */
export async function createAccounts(client, accounts) {
  const rows = [];
  for (const a of accounts) {
    const doc = {
      accountId: a.accountId,
      name: a.name,
      tier: a.tier,
      status: a.status,
      createdAt: a.createdAt,
    };
    const result = await client.query(
      `INSERT INTO accounts (account_id, doc)
       VALUES ($1, $2)
       RETURNING doc`,
      [a.accountId, JSON.stringify(doc)]
    );
    rows.push(result.rows[0].doc);
  }
  return rows;
}

/**
 * Fetch accounts matching optional filters.
 * Pass an empty filter object to return all rows.
 * Filters are applied via JSONB containment (@>) which leverages the GIN index.
 * @param {import('pg').Client} client
 * @param {object} [filter] — { tier?, status? }
 * @returns {Promise<Array<{accountId:string,name:string,tier:string,status:string,createdAt:string}>>}
 */
export async function getAccounts(client, filter = {}) {
  const contains = {};
  if (filter.tier) contains.tier = filter.tier;
  if (filter.status) contains.status = filter.status;
  const keys = Object.keys(contains);
  if (!keys.length) {
    const result = await client.query(
      `SELECT doc FROM accounts ORDER BY account_id`
    );
    return result.rows.map((r) => r.doc);
  }
  // Build a JSONB containment object: {"tier":"...","status":"..."}
  const result = await client.query(
    `SELECT doc FROM accounts WHERE doc @> $1 ORDER BY account_id`,
    [JSON.stringify(contains)]
  );
  return result.rows.map((r) => r.doc);
}

/**
 * Patch one account document by account_id.
 * Merges the provided fields into the existing doc (partial update).
 * @param {import('pg').Client} client
 * @param {string} accountId
 * @param {object} updates — { name?, tier?, status? }
 * @returns {Promise<{accountId:string,name:string,tier:string,status:string,createdAt:string}|null>}
 */
export async function updateAccounts(client, accountId, updates) {
  // Merge updates into the existing document.
  // We use the || operator to shallow-merge the patch into doc.
  const patch = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.tier !== undefined) patch.tier = updates.tier;
  if (updates.status !== undefined) patch.status = updates.status;

  if (!Object.keys(patch).length) {
    const result = await client.query(
      `SELECT doc FROM accounts WHERE account_id = $1`,
      [accountId]
    );
    return result.rows.length ? result.rows[0].doc : null;
  }

  const result = await client.query(
    `UPDATE accounts SET doc = doc || $2
     WHERE account_id = $1
     RETURNING doc`,
    [accountId, JSON.stringify(patch)]
  );
  return result.rows.length ? result.rows[0].doc : null;
}

/**
 * Delete one account by account_id.
 * @param {import('pg').Client} client
 * @param {string} accountId
 * @returns {Promise<boolean>} true if a row was deleted
 */
export async function deleteAccounts(client, accountId) {
  const result = await client.query(
    `DELETE FROM accounts WHERE account_id = $1`,
    [accountId]
  );
  return result.rowCount > 0;
}
```

---

## Rationale & Design Decisions (EEO Documentation)

### Shared decisions (both lanes)

| Decision | Choice | Rejected alternative | Why |
| --- | --- | --- | --- |
| Enum enforcement | `TEXT + CHECK constraint` | Native `CREATE TYPE ... AS ENUM` | Native ENUMs cannot drop values and are harder to evolve. TEXT+CHECK is the 2025 industry consensus for application-level statuses — ORM-friendly, portable, and trivially alterable. (Sources: easegis.jp, medium.com) |
| Timestamp type | `TIMESTAMPTZ` | `TIMESTAMP` (without tz) | TIMESTAMPTZ stores UTC and is the Postgres community recommendation for any timestamp that may cross timezones. |
| Primary key | `account_id TEXT` (caller-supplied natural key) | `SERIAL`/`UUID` surrogate | The resource contract specifies `accountId` as a required string field and the test supplies it. A natural PK avoids a redundant surrogate and matches the JSONB lane's key column exactly, keeping the two lanes comparable. |
| Query safety | Parameterized `$1, $2` everywhere | String interpolation | Non-negotiable — prevents SQL injection and lets Postgres cache query plans. |
| `IF NOT EXISTS` / `IF NOT EXISTS` index | Idempotent `ensureSchema` | Bare `CREATE TABLE` | The acceptance harness may call `ensureSchema` more than once; idempotency prevents errors. |

### `postgres-norm` specific

| Decision | Choice | Why |
| --- | --- | --- |
| Column naming | `snake_case` (`account_id`, `created_at`) | Postgres convention; the task explicitly requires it. Handlers map to/from camelCase at the boundary so the test-facing API is camelCase. |
| Index | B-Tree on `(status)` | `status` is the most common operational filter (active/at-risk/churned rollups). A single B-Tree is cheap and supports equality + range. We deliberately did **not** index `tier` — it is low-cardinality and rarely the sole filter; over-indexing would add write cost for negligible read benefit. |
| Partial update | Dynamic `SET` clause built from provided fields | Avoids overwriting fields the caller did not send. Each field is still parameterized. |
| Return shape | `RETURNING *` projected to camelCase | The test checks returned objects and also queries the DB directly; returning the full row lets the test assert both paths. |
| Rejected: separate lookup tables for tier/status | — | A lookup table + FK is over-engineering for a 3-value enum in a greenfield CRUD task. CHECK constraints give the same integrity guarantee with zero join overhead. |

### `postgres-jsonb` specific

| Decision | Choice | Why |
| --- | --- | --- |
| Table shape | `account_id TEXT PK + doc JSONB` | Exactly as the task specifies. The PK column gives O(1) lookup by key and enables future FK references; the doc holds the full camelCase document. |
| Key mirror constraint | `CHECK (doc->>'accountId' = account_id)` | Prevents document/PK drift — the single most common JSONB integrity bug. Without it, `doc.accountId` could disagree with the PK column silently. |
| Required-field + enum CHECK constraints | 6 CHECK constraints on `doc` | JSONB has no schema by default. The research is unanimous: "integrity is handled by application code" is the JSONB weakness. We push the **same** integrity guarantees the normalized lane has down into the DB so the acceptance test's direct DB queries enforce correctness. This is the strongest defensible JSONB design, not a strawman. |
| GIN index operator class | `jsonb_path_ops` | `jsonb_path_ops` produces a 2–3× smaller and faster GIN index than the default `jsonb_ops`, at the cost of supporting only containment (`@>`) queries. Since our read path filters by containment (`doc @> '{"status":"active"}'`), this is the optimal tradeoff. We rejected `jsonb_ops` because we never need key-existence (`?`) queries, and the default class would waste index space. (Sources: medium.com, pganalyze.com) |
| Update strategy | `doc \|\| $2` (JSONB merge) | The ` | | ` operator shallow-merges a patch into the existing document in a single statement — the idiomatic JSONB partial-update pattern. We rejected per-field `jsonb_set` chains because they are verbose, error-prone with path quoting, and the merge operator is cleaner for whole-document patches. |
| Rejected: expression index on `doc->>'status'` | — | A B-Tree expression index on `(doc->>'status')` would be faster for that single equality filter, but it duplicates the GIN's coverage and adds write amplification. For a 5-field document the GIN with `jsonb_path_ops` is the right single-index choice. If status-filtered queries dominated traffic, a partial expression index would be the next addition. |
| Rejected: generated column for `status` | — | PG12+ generated columns can promote a JSONB field to a real column for indexing. Over-engineering for a greenfield CRUD task with a small document; the GIN already covers containment lookups. |

### What an LLM-friendly benchmark measures here

The two lanes expose the core "agent schema tax" tension without either being a strawman:

- **postgres-norm** forces the agent to understand column naming conventions, write
  camelCase↔snake_case mapping boilerplate, and reason about CHECK constraints as column
  decorators. Every field is a first-class column — explicit but verbose.
- **postgres-jsonb** lets the agent store the document as-is (no mapping), but requires it
  to reason about JSONB operators (`@>`, `||`), GIN operator classes, and CHECK constraints
  that reach *into* the JSON with `->>`/`?` operators. The integrity constraints are
  strictly more complex to express than the normalized lane's column-level CHECKs.

Both designs are production-defensible. The benchmark measures which shape an AI coding agent
can implement correctly with less context, fewer retries, and less review burden.

---

## Sources

- Kept: [PostgreSQL JSONB Index Optimization](https://medium.com/@Rohan_Dutt/10-jsonb-index-optimization-techniques-for-high-performance-postgresql-workloads-cc35691a6052) — GIN `jsonb_path_ops` vs `jsonb_ops` size/performance data.
- Kept: [pganalyze — 5mins Postgres JSONB TOAST](https://pganalyze.com/blog/5mins-postgres-jsonb-toast) — TOAST threshold and write-amplification guidance.
- Kept: [PostgreSQL Design at Scale: Normalization vs JSONB](https://dev.to/abdullahmubin/postgresql-design-at-scale-normalization-vs-jsonb-a-real-world-guide-21k9) — integrity, statistics, and hybrid-strategy tradeoffs.
- Kept: [Heap — When to Avoid JSONB](https://www.heap.io/blog/when-to-avoid-jsonb-in-a-postgresql-schema) — query-planner statistics gap for JSONB fields.
- Kept: [Enum vs Lookup vs Domain design guide](https://query-go.easegis.jp/guide/design-enum-vs-lookup/) — CHECK-on-TEXT vs native ENUM vs Domain comparison.
- Kept: [node-postgres queries docs](https://node-postgres.com/features/queries) — parameterized query syntax and type-serialization rules.
- Dropped: Generic Node.js vs Bun vs Deno runtime benchmark articles — not relevant to schema design.

## Gaps

- No live DB execution was available in this research pass (Docker Postgres not started). The SQL is standard DDL/DML that runs on Postgres 12+; the `jsonb_path_ops` operator class and `||` merge operator are stable across all supported versions.
- The exact `db.mjs` helper signature was not located in the repo; the handlers assume the documented contract (`pg.Client` with `search_path` set, functions receive `client`). If the helper passes a `Pool` instead of `Client`, the query API is identical and no changes are needed.

---

## Supervisor coordination

No decision was needed. The task was fully specified; the designs are complete and
production-defensible. Returning the artifact directly.