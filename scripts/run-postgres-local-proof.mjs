#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { generateFixtureArtifacts } from "./proof-fixtures.mjs";

const now = "2026-06-17T12:00:00.000Z";
const postgresContainer = process.env.POSTGRES_CONTAINER || "sql-hidden-cost-postgres";
const postgresUser = process.env.POSTGRES_USER || "lab";
const postgresDb = process.env.POSTGRES_DB || "sql_hidden_cost";
const outputDir = "data/generated/proof";
const runnerPath = "data/generated/postgres/run-proof.sql";
const outputPath = `${outputDir}/postgres-local-db-proof.json`;
const marker = "__POSTGRES_LOCAL_PROOF__";

const { fixture } = generateFixtureArtifacts();

mkdirSync(outputDir, { recursive: true });
mkdirSync("data/generated/postgres", { recursive: true });

run(process.execPath, ["scripts/seed-local-databases.mjs", "postgres"]);
writeFileSync(runnerPath, buildPostgresProofSql({ fixture, now, marker }));

const result = runCapture("docker", ["exec", "-i", postgresContainer, "psql", "-v", "ON_ERROR_STOP=1", "-U", postgresUser, "-d", postgresDb, "-At"], {
  input: readRunnerSql()
});
const proofLine = result.stdout.split(/\r?\n/).find((line) => line.startsWith(marker));
if (!proofLine) {
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  throw new Error("Postgres local proof did not emit a proof result");
}

const proof = JSON.parse(proofLine.slice(marker.length));
const assertions = assertPostgresLocalProof(proof);

writeFileSync(outputPath, `${JSON.stringify({
  status: "passed",
  generatedAt: now,
  postgresContainer,
  postgresDb,
  fixtureVersion: fixture.scenarioVersion,
  orderId: fixture.task.orderId,
  accountId: fixture.task.accountId,
  assertions,
  ...proof
}, null, 2)}\n`);

console.log(`Postgres local proof passed: ${outputPath}`);

function buildPostgresProofSql({ fixture, now, marker }) {
  const orderId = sqlString(fixture.task.orderId);
  const at = sqlString(now);
  const outputMarker = sqlString(marker);

  return `
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM orders o
    JOIN accounts a ON a.account_id = o.account_id
    JOIN account_contracts ac ON ac.account_id = a.account_id
    JOIN shipments s ON s.order_id = o.order_id
    WHERE o.order_id = ${orderId}
      AND o.current_status = 'delayed'
      AND o.value_cents >= 500000
      AND s.delayed = TRUE
      AND a.tier_id IN ('strategic', 'enterprise')
      AND ac.arr_cents >= 5000000
      AND EXISTS (
        SELECT 1 FROM support_cases sc
        WHERE sc.account_id = a.account_id
          AND sc.status <> 'closed'
      )
      AND EXISTS (
        SELECT 1 FROM invoices i
        WHERE i.account_id = a.account_id
          AND (i.status = 'past_due' OR i.risk IS NOT NULL)
      )
      AND EXISTS (
        SELECT 1 FROM usage_snapshots us
        WHERE us.account_id = a.account_id
          AND us.trend = 'down'
      )
      AND (
        EXISTS (
          SELECT 1 FROM shipment_regulatory_flags srf
          WHERE srf.shipment_id = s.shipment_id
            AND srf.flag = 'regulated-shipping'
        )
        OR EXISTS (
          SELECT 1 FROM compliance_reviews cr
          WHERE cr.account_id = a.account_id
            AND cr.status <> 'cleared'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Order does not qualify for the customer 360 escalation workflow';
  END IF;
END $$;

CREATE TEMP TABLE proof_before AS
${portalViewSql(orderId)};

UPDATE orders
SET current_status = 'customer_escalation_active'
WHERE order_id = ${orderId};

INSERT INTO customer_escalations (
  escalation_id,
  account_id,
  order_id,
  policy_id,
  status,
  customer_visible_title,
  customer_visible_status,
  next_step,
  customer_message,
  created_at
)
SELECT
  'esc-' || o.order_id,
  o.account_id,
  o.order_id,
  ep.policy_id,
  'active',
  ep.customer_visible_title,
  ep.customer_visible_status,
  ep.next_step,
  ep.customer_message,
  ${at}::timestamptz
FROM orders o
JOIN escalation_policies ep ON ep.policy_id = 'policy-strategic-customer-360-escalation'
WHERE o.order_id = ${orderId};

INSERT INTO escalation_risk_factors (escalation_id, factor_order, factor, detail)
VALUES
  ('esc-' || ${orderId}, 1, 'shipment delay', 'Delayed high-value shipment is still unresolved.'),
  ('esc-' || ${orderId}, 2, 'strategic account', 'Strategic tier account with enterprise-plus contract.'),
  ('esc-' || ${orderId}, 3, 'open support case', 'Open urgent or high-priority support case exists.'),
  ('esc-' || ${orderId}, 4, 'invoice risk', 'Past-due invoice or payment hold risk is active.'),
  ('esc-' || ${orderId}, 5, 'usage drop', 'Recent usage dropped from the previous seven-day window.'),
  ('esc-' || ${orderId}, 6, 'regulatory review', 'Regulated shipment or compliance review is still active.');

INSERT INTO escalation_tasks (
  task_id,
  escalation_id,
  account_id,
  order_id,
  owner_group,
  title,
  status,
  due_at
)
SELECT
  'task-' || o.order_id || '-' || regexp_replace(lower(eps.owner_group), '[^a-z0-9]+', '-', 'g'),
  'esc-' || o.order_id,
  o.account_id,
  o.order_id,
  eps.owner_group,
  CASE eps.owner_group
    WHEN 'Customer Success' THEN 'Coordinate executive recovery plan'
    WHEN 'Legal' THEN 'Review regulated shipment and disclosure language'
    WHEN 'Finance' THEN 'Resolve payment hold and invoice risk'
    WHEN 'Support' THEN 'Publish customer-safe support timeline'
    ELSE 'Follow up for ' || eps.owner_group
  END,
  'open',
  '2026-06-17T16:00:00.000Z'::timestamptz
FROM orders o
JOIN escalation_policy_steps eps ON eps.policy_id = 'policy-strategic-customer-360-escalation'
WHERE o.order_id = ${orderId}
ORDER BY eps.step_order;

INSERT INTO escalation_task_assignments (task_id, owner_group, assignee_name)
SELECT
  et.task_id,
  et.owner_group,
  COALESCE(atm.name, et.owner_group)
FROM escalation_tasks et
LEFT JOIN account_team_members atm
  ON atm.account_id = et.account_id
 AND atm.owner_group = et.owner_group
WHERE et.escalation_id = 'esc-' || ${orderId};

INSERT INTO customer_portal_messages (message_id, escalation_id, account_id, order_id, title, body, created_at)
SELECT
  'msg-' || o.order_id || '-escalation',
  'esc-' || o.order_id,
  o.account_id,
  o.order_id,
  ce.customer_visible_title,
  ce.customer_message,
  ${at}::timestamptz
FROM orders o
JOIN customer_escalations ce ON ce.order_id = o.order_id
WHERE o.order_id = ${orderId};

INSERT INTO executive_notifications (notification_id, escalation_id, owner_group, status, created_at)
SELECT
  'notify-' || ${orderId} || '-' || eps.step_order,
  'esc-' || ${orderId},
  eps.owner_group,
  'queued',
  ${at}::timestamptz
FROM escalation_policy_steps eps
WHERE eps.policy_id = 'policy-strategic-customer-360-escalation';

INSERT INTO legal_review_requests (request_id, escalation_id, status, created_at)
VALUES ('legal-' || ${orderId}, 'esc-' || ${orderId}, 'open', ${at}::timestamptz);

INSERT INTO finance_review_requests (request_id, escalation_id, status, created_at)
VALUES ('finance-' || ${orderId}, 'esc-' || ${orderId}, 'open', ${at}::timestamptz);

INSERT INTO order_status_history (history_id, order_id, status, customer_visible, occurred_at)
VALUES ('hist-' || ${orderId} || '-customer-escalation-active', ${orderId}, 'customer_escalation_active', TRUE, ${at}::timestamptz);

INSERT INTO audit_events (audit_id, subject_type, subject_id, actor, action, occurred_at, customer_visible)
VALUES ('audit-' || ${orderId} || '-customer-360-escalation', 'customer_escalation', 'esc-' || ${orderId}, 'proof-runner', 'route_customer_360_escalation', ${at}::timestamptz, TRUE);

INSERT INTO audit_subjects (audit_id, subject_type, subject_id)
VALUES
  ('audit-' || ${orderId} || '-customer-360-escalation', 'order', ${orderId}),
  ('audit-' || ${orderId} || '-customer-360-escalation', 'account', (SELECT account_id FROM orders WHERE order_id = ${orderId}));

CREATE TEMP TABLE proof_after AS
${portalViewSql(orderId)};

SELECT ${outputMarker} || json_build_object(
  'before', (SELECT row_to_json(proof_before) FROM proof_before),
  'after', (SELECT row_to_json(proof_after) FROM proof_after),
  'counts', json_build_object(
    'accounts', (SELECT count(*) FROM accounts),
    'orders', (SELECT count(*) FROM orders),
    'support_cases', (SELECT count(*) FROM support_cases),
    'invoices', (SELECT count(*) FROM invoices),
    'usage_snapshots', (SELECT count(*) FROM usage_snapshots),
    'compliance_reviews', (SELECT count(*) FROM compliance_reviews),
    'customer_escalations', (SELECT count(*) FROM customer_escalations),
    'escalation_risk_factors', (SELECT count(*) FROM escalation_risk_factors),
    'escalation_tasks', (SELECT count(*) FROM escalation_tasks),
    'customer_portal_messages', (SELECT count(*) FROM customer_portal_messages),
    'audit_events', (SELECT count(*) FROM audit_events)
  ),
  'updateResult', json_build_object(
    'matchedCount', 1,
    'modifiedCount', 1
  )
)::text;

COMMIT;
`;
}

function portalViewSql(orderId) {
  return `SELECT
  o.order_id AS "orderId",
  COALESCE(
    ce.customer_visible_title,
    CASE WHEN o.current_status = 'delayed' THEN 'Shipment delayed' ELSE 'Order in progress' END
  ) AS title,
  COALESCE(ce.customer_visible_status, o.current_status) AS status,
  COALESCE((
    SELECT string_agg(et.owner_group, ' + ' ORDER BY eps.step_order)
    FROM escalation_tasks et
    LEFT JOIN escalation_policy_steps eps
      ON eps.policy_id = ce.policy_id
     AND eps.owner_group = et.owner_group
    WHERE et.escalation_id = ce.escalation_id
  ), 'Unassigned') AS owner,
  COALESCE(ce.next_step, 'Contact support') AS "nextStep",
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM audit_events ae
      WHERE ae.customer_visible = TRUE
        AND (
          ae.subject_id = ce.escalation_id
          OR EXISTS (
            SELECT 1
            FROM audit_subjects aus
            WHERE aus.audit_id = ae.audit_id
              AND aus.subject_id = o.order_id
          )
        )
    ) THEN 'Audit visible'
    ELSE 'Not visible'
  END AS history,
  CASE
    WHEN ce.escalation_id IS NULL THEN 'Risk not scored'
    ELSE (
      SELECT count(*)::text || ' signals: ' || string_agg(erf.factor, ', ' ORDER BY erf.factor_order)
      FROM escalation_risk_factors erf
      WHERE erf.escalation_id = ce.escalation_id
    )
  END AS "riskSummary",
  COALESCE((
    SELECT count(*)::text || ' owner tasks'
    FROM escalation_tasks et
    WHERE et.escalation_id = ce.escalation_id
  ), '0 owner tasks') AS tasks,
  COALESCE(cpm.body, ce.customer_message, 'Contact support') AS "customerMessage"
FROM orders o
LEFT JOIN customer_escalations ce ON ce.order_id = o.order_id
LEFT JOIN customer_portal_messages cpm ON cpm.escalation_id = ce.escalation_id
WHERE o.order_id = ${orderId}`;
}

function assertPostgresLocalProof(proof) {
  const expected = [
    ["after.title", proof.after.title, "At-risk escalation active"],
    ["after.status", proof.after.status, "Executive escalation"],
    ["after.owner", proof.after.owner, "Customer Success + Legal + Finance + Support"],
    ["after.nextStep", proof.after.nextStep, "Executive recovery plan by 16:00"],
    ["after.history", proof.after.history, "Audit visible"],
    ["after.riskSummary", proof.after.riskSummary, "6 signals: shipment delay, strategic account, open support case, invoice risk, usage drop, regulatory review"],
    ["after.tasks", proof.after.tasks, "4 owner tasks"],
    ["after.customerMessage", proof.after.customerMessage, "We are coordinating executive recovery for your delayed shipment."],
    ["before.history", proof.before.history, "Not visible"],
    ["before.tasks", proof.before.tasks, "0 owner tasks"]
  ];
  const failures = expected.filter(([, actual, wanted]) => actual !== wanted);
  if (proof.updateResult.matchedCount !== 1 || proof.updateResult.modifiedCount !== 1) {
    failures.push(["updateResult", JSON.stringify(proof.updateResult), "one matched and modified row"]);
  }
  if (proof.counts.customer_escalations !== 1) {
    failures.push(["counts.customer_escalations", proof.counts.customer_escalations, 1]);
  }
  if (proof.counts.escalation_tasks !== 4) {
    failures.push(["counts.escalation_tasks", proof.counts.escalation_tasks, 4]);
  }
  if (proof.counts.audit_events !== 1) {
    failures.push(["counts.audit_events", proof.counts.audit_events, 1]);
  }
  if (failures.length) {
    for (const [field, actual, wanted] of failures) {
      console.error(`- ${field}: expected ${wanted}, got ${actual}`);
    }
    throw new Error("Postgres local proof failed acceptance");
  }
  return expected.map(([field, actual]) => `${field} = ${actual}`);
}

function readRunnerSql() {
  return buildPostgresProofSql({ fixture, now, marker });
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function run(command, args) {
  const result = runCapture(command, args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
}

function runCapture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: options.input ? ["pipe", "pipe", "pipe"] : "pipe",
    input: options.input,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`${command} ${args.join(" ")} failed`);
  }
  return result;
}
