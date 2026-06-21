import { deepStrictEqual, strictEqual } from "node:assert";

export function assertOrderExceptionAcceptance({ mongoPortal, postgresPortal, task }) {
  const expected = {
    title: "At-risk escalation active",
    status: "Executive escalation",
    owner: "Customer Success + Legal + Finance + Support",
    nextStep: "Executive recovery plan by 16:00",
    history: "Audit visible",
    riskSummary: "6 signals: shipment delay, strategic account, open support case, invoice risk, usage drop, regulatory review",
    tasks: "4 owner tasks",
    customerMessage: "We are coordinating executive recovery for your delayed shipment."
  };

  for (const [field, value] of Object.entries(expected)) {
    strictEqual(mongoPortal[field], value, `MongoDB portal ${field}`);
    strictEqual(postgresPortal[field], value, `Postgres portal ${field}`);
  }

  deepStrictEqual(
    projectComparablePortal(mongoPortal),
    projectComparablePortal(postgresPortal),
    "MongoDB and Postgres portals must expose the same customer-visible escalation outcome"
  );

  return {
    status: "passed",
    taskOrderId: task.orderId,
    taskAccountId: task.accountId,
    assertions: [
      "Customer portal title shows active at-risk escalation",
      "Current status is Executive escalation",
      "Customer Success, Legal, Finance, and Support are visible owners",
      "Next step is customer-visible and time-bound",
      "Risk summary includes shipment, account tier, support, invoice, usage, and regulatory signals",
      "Four internal owner tasks are created",
      "Audit history is visible",
      "MongoDB and Postgres portal projections match"
    ]
  };
}

function projectComparablePortal(portal) {
  return {
    title: portal.title,
    status: portal.status,
    owner: portal.owner,
    nextStep: portal.nextStep,
    history: portal.history,
    riskSummary: portal.riskSummary,
    tasks: portal.tasks,
    customerMessage: portal.customerMessage
  };
}
