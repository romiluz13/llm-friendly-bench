# AST-Bench / Interactive Proof Lab PRD

## 2026-06-18 V1 Reframe

The product is now two linked surfaces:

- **AST-Bench**, the evidence engine and public benchmark contract.
- **Interactive Proof Lab**, the public benchmark theater that renders only generated evidence bundles.

The existing `order-exception-codex-v1-verified` replay remains valuable, but it is a **seed case study**. It must not be described as the final benchmark. Full public V1 requires 25 tasks, MongoDB and Postgres lanes, Codex/Claude Code/Cursor agents, three repeats, and 450 captured lane runs.

The public claim posture is benchmark-first. The page may say what the seed case measured, but it must not force a MongoDB victory narrative, hide mixed metrics, or imply guaranteed savings.

## Problem Statement

MongoDB needs a customer-sendable proof that its historic productivity message still matters in the coding-agent era.

The old message was that MongoDB lets teams build faster with fewer developers by removing database overhead and letting people focus on features instead of database boilerplate. The world has shifted: Coding Agents now write and modify large parts of application code. The new customer question is whether their agents spend expensive context, tokens, time, retries, and human supervision on product behavior or on database ceremony.

The Interactive Proof Lab must make this visible. It should show MongoDB sellers and customers that MongoDB removes database overhead for AI coding agents, helping teams build faster and more cost-effectively with less context, less supervision, and less database ceremony.

This cannot be an essay, deck, or static benchmark. It must be a working Seller Proof App with real traces, real numbers, inspectable evidence, and customer-safe proof.

The stronger V1 requirement is that a skeptical developer can inspect the benchmark contract, rerun a selected target locally, and see why the current seed is not yet the public V1 benchmark result.

## Solution

Build an Interactive Proof Lab that lets MongoDB sellers replay verified Coding Agent runs against two database-native versions of the same Customer Order Lifecycle application:

- a MongoDB Target App modeled with MongoDB best practices
- a clean Postgres Baseline modeled with relational best practices

The first replay shows an Instrumented Agent Run for a delayed high-value Order Exception Workflow. In AST-Bench V1, that replay becomes one seed cell inside a 25-task benchmark suite. The Lab Console presents the benchmark progress first, the seed receipt second, then the synchronized evidence, cost model, and Proof Packet.

The lab starts with pre-recorded verified replays, not live on-demand agent execution. Replays remain real because every result links to raw prompts, model/version metadata, tool calls, inspected context, token counts when available, retries, code diffs, data-model diffs, tests, screenshots, database snapshots, Fairness Contract, and Independent Design Review.

## User Stories

1. As a MongoDB seller, I want to send a customer a working proof lab link, so that I can show MongoDB's AI-era productivity advantage without relying on slides.
2. As a MongoDB seller, I want the first screen to be the Lab Console, so that the customer sees proof immediately instead of marketing copy.
3. As a customer executive, I want to see the customer-visible workflow outcome first, so that I understand the business value before inspecting technical traces.
4. As a customer engineering leader, I want to compare MongoDB and Postgres runs side by side, so that I can see whether the same request required different agent effort.
5. As a customer architect, I want the comparison to use a clean Postgres Baseline, so that I do not dismiss the result as a strawman.
6. As a customer architect, I want each database to use a database-native design, so that MongoDB is not forced into table parity and Postgres is not made intentionally weak.
7. As a skeptical customer, I want to see the Independent Design Review, so that I can judge whether both data models are credible.
8. As a skeptical customer, I want to see the Fairness Contract, so that I know the same task prompt, agent, model/version, scenario dataset, tests, and time budget were used.
9. As a seller, I want a concise headline metric, so that I can communicate the result quickly in a live meeting.
10. As a technical customer, I want to expand the headline metric into raw trace evidence, so that I can audit the claim.
11. As a customer finance leader, I want per-task model and human-review cost deltas, so that the proof connects to budget.
12. As a customer finance leader, I want configurable monthly or team-level Cost Projection, so that I can estimate the business impact under my own assumptions.
13. As a customer engineering manager, I want to see human babysitting indicators, so that I can understand supervision burden beyond token spend.
14. As a customer engineering manager, I want to see shipping efficiency, so that I can distinguish more generated code from more working software shipped.
15. As a customer security leader, I want governance and safety signals in the scorecard, so that agent adoption risk is visible.
16. As a customer developer, I want to inspect files and schema objects read by the agent, so that I can see where context was spent.
17. As a customer developer, I want to see tool calls and failed commands, so that I can understand how much agent work was wasted.
18. As a customer developer, I want to see retries and correction loops, so that I can understand where the agent struggled.
19. As a customer developer, I want to inspect the generated code diff, so that I can judge the actual implementation.
20. As a customer developer, I want to inspect the data-model diff, so that I can see database-specific changes.
21. As a customer developer, I want to inspect test results, so that I can verify the replay ended in working software.
22. As a customer developer, I want to inspect before and after UI screenshots, so that I can verify the customer portal changed correctly.
23. As a customer architect, I want to see change blast radius, so that I can understand how much of the application each database forced the agent to touch.
24. As a customer architect, I want to see integration friction, so that I can understand how much existing-system context the agent needed.
25. As a customer architect, I want to see quality confidence, so that the proof is not just a speed claim.
26. As a seller, I want the Proof Packet to be shareable, so that a customer can forward it internally after the meeting.
27. As a seller, I want the Proof Packet to include caveats, so that the proof feels honest and customer-safe.
28. As a seller, I want the app to use Forensic Mission Control design, so that it feels serious, inspectable, and executive-safe.
29. As a seller, I want the app to avoid a generic benchmark-dashboard feel, so that the Aha Moment is memorable.
30. As a product leader, I want Replay Artifacts to be file-backed in v1, so that verified runs can be versioned and reviewed before we add live execution.
31. As a product leader, I want the Proof Packet schema to be agent-neutral, so that Claude Code and Cursor can be added after the first Codex runs.
32. As a product leader, I want Codex held constant for the first verified runs, so that the initial proof compares database models rather than agent products.
33. As a product leader, I want Claude Code to be a required future validation lane, so that the proof does not depend only on Codex.
34. As a seller, I want the first scenario to be Customer Order Lifecycle, so that it is familiar across industries.
35. As a CRM-focused seller, I want a CRM Variant, so that account, contact, case, activity, and customer-history context can be part of the story.
36. As a customer, I want generated business records seeded into real local database services, so that the scenario feels production-like without exposing customer data.
37. As a customer, I want the first target app to be medium-realistic, so that the proof is credible without being overwhelmed by artificial scale.
38. As a seller, I want Enterprise SQL Sprawl to be a later mode, so that I can eventually show how the cost compounds in legacy estates.
39. As a developer advocate, I want the lab to preserve raw run artifacts, so that the claims can survive external scrutiny.
40. As a future implementation agent, I want the PRD to preserve domain language from the glossary, so that implementation does not drift into generic benchmark wording.

## Implementation Decisions

- The product is a Seller Proof App called the Interactive Proof Lab.
- The core message is: MongoDB removes database overhead for AI coding agents, helping teams build faster and more cost-effectively with less context, less supervision, and less database ceremony.
- The first customer-facing experience is the Lab Console, not a landing page.
- The Lab Console uses a Forensic Mission Control visual direction: serious, synchronized, evidence-led, and customer-safe.
- The replay uses Outcome-First Replay: show the customer-visible workflow outcome before exposing agent traces and context-cost evidence.
- The first scenario is Customer Order Lifecycle, with CRM Variant support as a first-class angle.
- The first replayed task is a delayed high-value Order Exception Workflow.
- The first comparison is MongoDB versus a clean Postgres Baseline.
- The broader narrative uses a SQL/Relational Frame while the proof run names Postgres as the concrete baseline.
- The first proof uses verified replays rather than live on-demand agent execution.
- AST-Bench V1 requires 25 tasks, two database lanes, three agent lanes, and three repeats.
- The public UI must label the current state `case-study` until every required lane run is captured.
- The current seed replay counts as two captured lane runs, not as a final benchmark result.
- Live agent execution is a later capability after the proof surface is stable.
- Replay Artifacts are local file-backed proof records in v1.
- The Lab App uses Next.js and TypeScript.
- The Lab App consumes Replay Artifacts and does not require a production database in v1.
- The benchmarked Target Apps are separate from the Lab App.
- The Target Apps are implemented as a MongoDB version and a Postgres version of the same product behavior.
- Both Target Apps use the same customer request, Scenario Dataset, acceptance tests, starting app functionality, and customer-visible UI outcome.
- The MongoDB target uses database-native MongoDB modeling.
- The Postgres target uses a clean, normalized relational design.
- The first Target Apps are Medium-Realistic Targets.
- The initial MongoDB target should have roughly 8-12 collections.
- The initial Postgres target should have roughly 25-40 clean normalized tables.
- The shared app surface should include roughly 5-7 screens, including customer portal, operations queue, order detail, account or CRM view, support case, and audit timeline.
- The initial Scenario Dataset should include generated business records for accounts, contacts, orders, line items, products, fulfillment events, payments, support cases, SLA timers, and audit events.
- Scenario Datasets are immutable and versioned.
- Both MongoDB and Postgres datasets are generated from the same canonical scenario definition, then seeded into real local services for proof runs.
- Every accepted proof run must produce a Proof Packet.
- Every Proof Packet includes the customer request, starting states, agent prompt, model/version, trace, code diff, data-model diff, test results, UI screenshots, comparison, proof status, caveats, Fairness Contract, and Independent Design Review.
- The Proof Packet includes a visible Independent Design Review section.
- The Independent Design Review includes MongoDB model rationale, Postgres schema rationale, access patterns covered, known trade-offs, reviewer or rubric used, and why the comparison is not a strawman.
- The MongoDB-side design review uses MongoDB schema-design principles, including modeling around access patterns and storing data accessed together together.
- The Postgres-side design review must use an equivalent Postgres best-practice rubric or reviewer.
- Every Proof Packet includes a visible Fairness Contract.
- The Fairness Contract states that the same task prompt, instrumented agent, model/version, time budget, starting app functionality, acceptance tests, and scenario dataset version were used.
- Verified Lab Console runs require a no-mock runtime data contract and fail closed rather than rendering unverified fallback proof.
- The Fairness Contract states that database-native data models are allowed because identical schemas would be less fair.
- Failed attempts must remain visible or count as retries.
- No hand edits after the agent run are allowed in accepted proof artifacts.
- The AI Buildability Scorecard is the customer-facing measurement layer.
- The scorecard dimensions are context cost, shipping efficiency, review burden, human babysitting, governance and safety, coordination cost, integration friction, quality confidence, change blast radius, and operational cost.
- The UI shows both per-task cost delta and Cost Projection.
- Cost Projection scales token, time, retry, and human-supervision deltas into monthly or team-level AI Development Cost.
- Cost Projection must expose assumptions and must not appear as guaranteed savings.
- The first Instrumented Agent Run uses Codex because this workspace can capture prompts, diffs, commands, tests, screenshots, timing, and run metadata directly.
- The Proof Packet schema must remain agent-neutral.
- Claude Code is a required future validation lane.
- Cursor and other Coding Agents are future validation lanes after the schema supports more than one agent.

## Testing Decisions

- Test the Lab App at the highest behavior seam: loading a Replay Artifact and rendering the Lab Console, Proof Packet, scorecard, cost projection, and trust sections correctly.
- Test Replay Artifact schema validation as a boundary seam so invalid or incomplete proof data cannot render as credible proof.
- Test the AI Buildability Scorecard calculation as a pure domain seam.
- Test Cost Projection as a pure domain seam with explicit assumptions.
- Test Proof Packet completeness as a domain seam: every required artifact must be present or the proof status must show incomplete.
- Test Fairness Contract visibility and content as customer-facing behavior.
- Test Independent Design Review visibility and content as customer-facing behavior.
- Test Outcome-First Replay ordering: customer-visible outcome appears before trace and metrics.
- Test that the UI does not present Cost Projection as guaranteed savings.
- Test that the UI labels the first run as Codex and does not imply all Coding Agents have been validated.
- Test that Postgres is labeled as the concrete baseline while the narrative can still use the SQL/Relational Frame.
- Test target-app acceptance through external behavior, not internal data-model shape.
- Test that MongoDB and Postgres target apps satisfy the same customer-visible acceptance criteria.
- Test dataset generation parity: both database datasets must derive from the same Scenario Dataset version.
- Test the no-mock runtime data contract: verified artifacts must expose captured runtime sources and must not render unverified fallback proof.
- Test database-native design review artifacts as required proof metadata before an Instrumented Agent Run can be marked verified.
- Visual verification is required for the Lab Console because the Aha Moment depends on layout, evidence hierarchy, and customer-safe polish.

## Out of Scope

- Live on-demand agent execution in v1.
- Real customer-derived data in v1.
- Enterprise SQL Sprawl in v1.
- Multi-agent proof claims in v1.
- Claiming Claude Code, Cursor, Copilot, or Windsurf results before their own Instrumented Agent Runs exist.
- Calling a single replay a benchmark.
- Calling AST-Bench `public-v1` before the 450 required lane runs pass.
- A generic marketing landing page before the Lab Console.
- A production database for the Lab App in v1.
- A public benchmark leaderboard.
- A claim that all SQL systems behave identically to Postgres.
- A claim that Cost Projection is guaranteed savings.
- A comparison where MongoDB and Postgres are forced into identical schemas.
- A comparison against intentionally bad Postgres.
- Production authentication, CRM integration, or seller-account management.

## Further Notes

- The strongest customer objection is that the MongoDB version was designed to make MongoDB win. The Independent Design Review and Fairness Contract exist to answer that objection directly.
- The strongest seller moment is not a chart. It is the Aha Moment where the customer sees the completed workflow, then sees the MongoDB lane needed less database overhead for the Coding Agent to get there.
- The PRD intentionally preserves MongoDB's historic productivity message while translating it for the coding-agent era.
- The old message was about humans building faster with less database boilerplate. The new message is about Coding Agents building faster and more cost-effectively with less database overhead, fewer wasted tokens, fewer retries, and less human babysitting.
- The first proof must be credible before it is broad. Breadth comes later through more scenarios, Enterprise SQL Sprawl, Claude Code validation, Cursor validation, and eventually live agent execution.
- This repo does not currently have an issue tracker configured, so this PRD is written as a durable repo document rather than published as an issue.
