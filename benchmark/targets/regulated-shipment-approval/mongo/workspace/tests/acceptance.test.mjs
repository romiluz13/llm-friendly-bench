import { deepStrictEqual, strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { applyBenchmarkTask } from "../src/workflow.mjs";
import { buildPortalView } from "../src/portal-view.mjs";

const now = "2026-06-18T12:00:00.000Z";
const data = JSON.parse(readFileSync(new URL("../data/collections.json", import.meta.url), "utf8"));
const before = buildPortalView(structuredClone(data));
strictEqual(before.status, "Needs work", "Before state starts without the workflow");
strictEqual(before.history, "Not visible", "Before state has no customer-visible audit trail");
strictEqual(before.tasks, "0 owner tasks", "Before state has no owner tasks");

const runData = structuredClone(data);
const after = applyBenchmarkTask(runData, now);
const expectedStatus = "Regulated shipment approval active with compliance owners and portal-safe status.";
const expectedOwners = data.workflow_requests[0].ownerGroups;
const expectedSignals = data.workflow_requests[0].riskSignals;

strictEqual(after.status, expectedStatus, "Customer-facing status");
strictEqual(after.owner, expectedOwners.join(" + "), "Owner routing");
strictEqual(after.nextStep.length > 8, true, "Next step exists");
strictEqual(after.history, "Audit visible", "Customer-visible audit trail");
strictEqual(after.customerMessage.length > 12, true, "Customer-safe message");
strictEqual(after.riskSummary, `${expectedSignals.length} signals: ${expectedSignals.map((item) => item.name).join(", ")}`, "Risk summary");
strictEqual(after.tasks, `${expectedOwners.length} owner tasks`, "Owner task count");
assertPersistedState(runData, expectedStatus, expectedOwners, expectedSignals);

console.log("AST-Bench acceptance passed: regulated-shipment-approval/mongo");

function assertPersistedState(db, expectedStatus, expectedOwners, expectedSignals) {
  
  const request = db.workflow_requests[0];
  const state = db.workflow_state.find((item) => item.requestId === request._id);
  strictEqual(Boolean(state), true, "Workflow state must be persisted");
  strictEqual(state.status, expectedStatus, "Persisted status");
  deepStrictEqual(state.riskSignals.map((item) => item.name), expectedSignals.map((item) => item.name), "Persisted risk signals");
  const tasks = db.owner_tasks.filter((item) => item.requestId === request._id);
  strictEqual(tasks.length, expectedOwners.length, "Owner tasks persisted");
  deepStrictEqual(tasks.map((item) => item.ownerGroup), expectedOwners, "Task owner groups");
  strictEqual(tasks.every((item) => item.title && item.dueAt && item.status === "open"), true, "Tasks have production fields");
  strictEqual(db.customer_messages.some((item) => item.requestId === request._id && item.body), true, "Customer message persisted");
  strictEqual(db.audit_events.some((item) => item.requestId === request._id && item.customerVisible), true, "Customer-visible audit event persisted");
}
