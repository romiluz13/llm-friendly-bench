import { deepStrictEqual, strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { applyBenchmarkTask } from "../src/workflow.mjs";
import { buildPortalView } from "../src/portal-view.mjs";

const now = "2026-06-18T12:00:00.000Z";
const data = JSON.parse(readFileSync(new URL("../data/tables.json", import.meta.url), "utf8"));
const before = buildPortalView(structuredClone(data));
strictEqual(before.status, "Needs work", "Before state starts without the workflow");
strictEqual(before.history, "Not visible", "Before state has no customer-visible audit trail");
strictEqual(before.tasks, "0 owner tasks", "Before state has no owner tasks");

const runData = structuredClone(data);
const after = applyBenchmarkTask(runData, now);
const expectedStatus = "Duplicate cases merged into a master case with preserved timeline and SLA state.";
const expectedOwners = tables.workflow_request_owner_groups.sort((a, b) => a.group_order - b.group_order).map((item) => item.owner_group);
const expectedSignals = tables.workflow_request_risk_signals.sort((a, b) => a.signal_order - b.signal_order).map((item) => ({ name: item.signal_name, detail: item.detail }));

strictEqual(after.status, expectedStatus, "Customer-facing status");
strictEqual(after.owner, expectedOwners.join(" + "), "Owner routing");
strictEqual(after.nextStep.length > 8, true, "Next step exists");
strictEqual(after.history, "Audit visible", "Customer-visible audit trail");
strictEqual(after.customerMessage.length > 12, true, "Customer-safe message");
strictEqual(after.riskSummary, `${expectedSignals.length} signals: ${expectedSignals.map((item) => item.name).join(", ")}`, "Risk summary");
strictEqual(after.tasks, `${expectedOwners.length} owner tasks`, "Owner task count");
assertPersistedState(runData, expectedStatus, expectedOwners, expectedSignals);

console.log("AST-Bench acceptance passed: duplicate-case-merge/postgres");

function assertPersistedState(tables, expectedStatus, expectedOwners, expectedSignals) {
  
  const request = tables.workflow_requests[0];
  const state = tables.workflow_state.find((item) => item.request_id === request.request_id);
  strictEqual(Boolean(state), true, "Workflow state must be persisted");
  strictEqual(state.status, expectedStatus, "Persisted status");
  const tasks = tables.owner_tasks.filter((item) => item.request_id === request.request_id);
  strictEqual(tasks.length, expectedOwners.length, "Owner tasks persisted");
  deepStrictEqual(tasks.map((item) => item.owner_group), expectedOwners, "Task owner groups");
  strictEqual(tasks.every((item) => item.title && item.due_at && item.status === "open"), true, "Tasks have production fields");
  strictEqual(tables.customer_messages.some((item) => item.request_id === request.request_id && item.body), true, "Customer message persisted");
  strictEqual(tables.audit_events.some((item) => item.request_id === request.request_id && item.customer_visible), true, "Customer-visible audit event persisted");
}
