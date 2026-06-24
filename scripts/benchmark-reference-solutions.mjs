// Reference (known-good) workflow.mjs bodies per lane, used ONLY to validate
// the harness end-to-end (before-state fails, reference passes) — never shown
// to agents. If these pass against the live DB and the empty stub fails, the
// acceptance contract is real.

export function referenceWorkflow(lane) {
  if (lane === "mongo") return MONGO_REF;
  return PG_REF; // norm + jsonb both read facts via tests/facts-style logic, persist to relational output tables
}

const MONGO_REF = `import { withDb } from "./db.mjs";
import { signalsOf, ownersOf, qualifies, RULES } from "./derive.mjs";

export async function run(now = "2026-06-18T12:00:00.000Z") {
  await withDb(async (db) => {
    const a = (await db.collection("accounts").find({}).toArray())[0];
    const facts = { account: { tier: a.tier }, invoices: a.invoices, shipments: a.shipments, regulatoryFlags: a.regulatoryFlags, supportCases: a.supportCases, usage: a.usage };
    const q = qualifies(facts, now);
    const signals = signalsOf(facts, now);
    const owners = q ? ownersOf(facts, now) : [];
    const status = q ? RULES.escalationStatus : RULES.monitorStatus;
    const requestId = a.request?.requestId || ("req-" + a._id);
    const riskSummary = signals.length + " signals: " + signals.join(", ");
    await db.collection("workflow_state").insertOne({ request_id: requestId, account_id: a._id, title: a.name, status, next_step: q ? (owners[0] + " recovery review by 16:00") : "Continue standard monitoring.", risk_summary: riskSummary });
    for (const o of owners) await db.collection("owner_tasks").insertOne({ request_id: requestId, account_id: a._id, owner_group: o, title: o + " recovery owner task", due_at: now, status: "open" });
    if (q) {
      await db.collection("customer_messages").insertOne({ request_id: requestId, account_id: a._id, body: "Our team has opened a priority recovery effort on your account and will follow up shortly." });
      await db.collection("audit_events").insertOne({ request_id: requestId, account_id: a._id, event: "escalation_opened", occurred_at: now, customer_visible: true });
    }
  });
}
if (import.meta.url === \`file://\${process.argv[1]}\`) run().then(() => console.log("ok")).catch((e) => { console.error(e); process.exit(1); });
`;

// Postgres reference: reads facts from whatever lane shape via raw SQL, but to
// stay lane-shape-agnostic it reuses the facts reader pattern. For norm/jsonb we
// read the same way the test's facts.mjs does, then persist to output tables.
const PG_REF = `import { withDb, cfg } from "./db.mjs";
import { signalsOf, ownersOf, qualifies, RULES } from "./derive.mjs";
import { readFactsFromDb } from "../tests/facts.mjs";

export async function run(now = "2026-06-18T12:00:00.000Z") {
  await withDb(async (c) => {
    const facts = await readFactsFromDb(c);
    const accountId = facts.account.accountId;
    const requestId = "req-" + accountId;
    const q = qualifies(facts, now);
    const signals = signalsOf(facts, now);
    const owners = q ? ownersOf(facts, now) : [];
    const status = q ? RULES.escalationStatus : RULES.monitorStatus;
    const riskSummary = signals.length + " signals: " + signals.join(", ");
    await c.query('INSERT INTO workflow_state (request_id, account_id, title, status, next_step, risk_summary) VALUES ($1,$2,$3,$4,$5,$6)', [requestId, accountId, facts.account.name || accountId, status, q ? (owners[0] + " recovery review by 16:00") : "Continue standard monitoring.", riskSummary]);
    for (const o of owners) await c.query('INSERT INTO owner_tasks (request_id, account_id, owner_group, title, due_at, status) VALUES ($1,$2,$3,$4,$5,$6)', [requestId, accountId, o, o + " recovery owner task", now, "open"]);
    if (q) {
      await c.query('INSERT INTO customer_messages (request_id, account_id, body) VALUES ($1,$2,$3)', [requestId, accountId, "Our team has opened a priority recovery effort on your account and will follow up shortly."]);
      await c.query('INSERT INTO audit_events (request_id, account_id, event, occurred_at, customer_visible) VALUES ($1,$2,$3,$4,$5)', [requestId, accountId, "escalation_opened", now, true]);
    }
  });
}
if (import.meta.url === \`file://\${process.argv[1]}\`) run().then(() => console.log("ok")).catch((e) => { console.error(e); process.exit(1); });
`;
