# SQL Hidden Cost

This context names the business argument around how database model choice affects building software with AI.

## Language

**Building With AI**:
Building or changing ordinary software with coding agents such as Codex, Claude Code, Cursor, or similar tools. The application may be legacy, CRUD-heavy, operational, consumer, or enterprise; it does not need to contain an AI agent as a product feature.
_Avoid_: Building AI, AI-native app, agent runtime

**AST-Bench**:
Agent Schema Tax Benchmark. The benchmark engine that measures how database shape affects Coding Agent cost while building ordinary application software. Full V1 requires 25 tasks, MongoDB and Postgres lanes, Codex/Claude Code/Cursor agents, and three repeats per cell.
_Avoid_: Single replay, marketing benchmark, final proof without all run cells

**Agent Schema Tax**:
The extra context, tool work, elapsed time, retries, review burden, and supervision created when a Coding Agent must reconstruct product state from database shape before safely changing software.
_Avoid_: Query latency, hosting bill, generic developer productivity

**Coding Agent**:
A software-building AI tool such as Codex, Claude Code, Cursor, Copilot, or Windsurf that reads a codebase, edits files, runs tools, and verifies changes.
_Avoid_: Agent runtime, customer-facing AI agent

**Instrumented Agent Run**:
A verified coding-agent execution where prompt, model/version, tool calls, inspected context, token counts when available, retries, diffs, tests, screenshots, and metadata are captured.
_Avoid_: Agent benchmark, model comparison

**Verified Codex Replay**:
A Replay Artifact promoted from a Local Proof Candidate after real `codex exec` runs pass for both MongoDB and Postgres target workspaces, with raw traces, diffs, tests, portal snapshots, metrics, and design review captured.
_Avoid_: Final benchmark, candidate replay, local proof only, simulated agent run

**Building AI**:
Creating production AI systems whose core behavior depends on agents, memory, retrieval, embeddings, vector search, hybrid search, or graph-style reasoning.
_Avoid_: Building with AI, AI-assisted development

**Agent Runtime**:
An AI agent system running in production, including its memory, retrieval, tool state, embeddings, vector search, hybrid search, or graph-style reasoning data.
_Avoid_: Coding agent workflow, developer agent, app-building agent

**Seller Proof App**:
A working customer-facing application that MongoDB sellers can use live or send to customers to demonstrate proof, numbers, and workflows behind the database argument.
_Avoid_: Article, essay, slide deck, thought-leadership page

**Interactive Proof Lab**:
A Seller Proof App where a customer can run or replay realistic AI coding-agent tasks against MongoDB and SQL versions of the same application, then inspect the evidence behind the result.
_Avoid_: Static benchmark page, dashboard, whitepaper

**Customer Order Lifecycle**:
The customer-facing workflow that spans account context, order intent, line items, fulfillment, payment, exceptions, support interactions, and audit history.
_Avoid_: Quote-to-cash, ecommerce checkout, ERP demo

**CRM Variant**:
A Customer Order Lifecycle scenario where customer relationship context such as accounts, contacts, opportunities, cases, activities, preferences, and customer history drives the task.
_Avoid_: Separate CRM product, sales dashboard

**Order Exception Workflow**:
A Customer Order Lifecycle task where an order enters an abnormal customer-visible state that requires routing, ownership, status explanation, and audit history.
_Avoid_: Alert, notification, ticket

**Aha Moment**:
The customer-visible moment when the proof lab makes the MongoDB advantage obvious through a live trace, concrete numbers, and a successful task outcome.
_Avoid_: Marketing claim, summary statistic

**Proof Packet**:
The evidence bundle for one verified replay: customer request, starting states, agent prompt, model/version, trace, code diff, data-model diff, test results, UI screenshots, comparison, proof status, and caveats.
_Avoid_: Report, export, summary

**Proof Scorecard**:
The multi-metric comparison for one verified replay, covering context inspected, token cost, agent effort, change footprint, proof quality, and human trust.
_Avoid_: Token savings, benchmark score, leaderboard

**AI Buildability Scorecard**:
The customer-facing scorecard that measures how easy and cost-effective an application is to build with Coding Agents, including context cost, shipping efficiency, review burden, human babysitting, governance and safety, coordination cost, integration friction, quality confidence, change blast radius, and operational cost.
_Avoid_: Token savings, productivity chart, benchmark leaderboard

**Fairness Contract**:
The visible rules that keep a proof run credible: same task prompt, agent, model/version, time budget, starting functionality, acceptance tests, fixture version, and raw evidence links, while allowing database-native data models.
_Avoid_: Benchmark methodology, fine print

**Independent Design Review**:
A required pre-run review that verifies the MongoDB and Postgres target designs are each credible, database-native, and not shaped to predetermine the result.
_Avoid_: Internal approval, schema review

**Lab Console**:
The first screen of the Interactive Proof Lab where a seller or customer chooses a scenario, replays the MongoDB and SQL traces side by side, and opens the Proof Packet.
_Avoid_: Landing page, marketing homepage, dashboard

**Lab App**:
The web application that presents verified replays, Proof Scorecards, and Proof Packets to sellers and customers.
_Avoid_: Target app, benchmark app

**Target App**:
A scenario application built in both MongoDB and Postgres versions so an Instrumented Agent Run can perform the same customer request against each implementation.
_Avoid_: Lab app, demo shell

**Medium-Realistic Target**:
The first target-app scale: large enough to feel like a real customer application, but small enough to keep proof runs controllable and inspectable.
_Avoid_: Toy CRUD app, enterprise sprawl

**Enterprise SQL Sprawl**:
A later proof mode that represents large legacy relational estates with many tables, historical naming, partial documentation, and accumulated schema complexity.
_Avoid_: First baseline, strawman Postgres

**Replay Artifact**:
A file-backed proof record used by the Lab App to replay a verified run, including trace data, screenshots, diffs, metrics, metadata, and caveats.
_Avoid_: Mock response, static content

**Local Proof Candidate**:
A pre-verification proof record generated from the canonical Scenario Fixture, database-native projections, target adapters, and acceptance tests. It can prove the scenario mechanics and evidence shape, but it is not a verified Instrumented Agent Run until live agent trace, design review, screenshots, and diff evidence are captured.
_Avoid_: Verified replay, mock, final benchmark

**Target Adapter**:
The implementation seam that lets a proof scenario run against one database-native target shape, such as file-backed projections, local MongoDB, local Postgres, or a future deployed target. Target Adapters must preserve the same acceptance contract.
_Avoid_: Database client, connector, wrapper

**Database Projection**:
The database-specific projection generated from the canonical Scenario Fixture, such as MongoDB collections or Postgres tables. Projections are allowed to differ when they follow each database's native model.
_Avoid_: Duplicate fixture, mock schema, forced parity data

**Proof Gate**:
A validation rule that prevents a Replay Artifact from being promoted to verified unless required evidence is present, captured, and traceable.
_Avoid_: Test, checklist, manual review

**Evidence Ledger**:
The part of the Proof Packet that names each customer-facing claim and the artifact that supports it.
_Avoid_: Links, appendix, raw files

**Evidence Manifest**:
A generated SHA-256 manifest that locks source files, fixture projections, acceptance output, metrics, cost model, and optional local database proof files used by a Replay Artifact.
_Avoid_: Build log, file list, appendix

**MongoDB Local DB Replay**:
A proof step that seeds an isolated local MongoDB database from the Scenario Fixture, runs the Order Exception Workflow against real collections, and captures the before/after customer outcome as evidence.
_Avoid_: MongoDB mock, file-backed adapter run

**Forensic Mission Control**:
The visual and interaction direction for the Lab Console: serious, evidence-led, synchronized, and customer-safe, with proof traces presented like inspectable operational evidence.
_Avoid_: Benchmark dashboard, playful demo, AI vapor page

**Outcome-First Replay**:
A replay structure that shows the customer-visible workflow outcome before revealing the agent trace and context-cost evidence underneath it.
_Avoid_: Token-first benchmark, trace-only demo

**Scenario Dataset**:
An immutable generated business dataset and task definition that seeds both real local database services for a proof scenario.
_Avoid_: Mock data, demo data, customer data

**No-Mock Runtime Data Contract**:
A verified replay requirement that the seller console renders only captured traces, diffs, tests, screenshots, local database proof files, and hash-locked evidence. If verified evidence is missing, the console must fail closed rather than render an unverified fallback.
_Avoid_: Prototype fallback, illustrative metric, hand-filled proof row

**Database-Native Comparison**:
A proof design where MongoDB and SQL versions implement the same product behavior using the best-practice data model natural to each database.
_Avoid_: Identical schema comparison, forced parity, strawman comparison

**Postgres Baseline**:
The concrete SQL implementation used in proof runs as a credible representative relational baseline.
_Avoid_: Generic SQL lane, unnamed relational database

**SQL/Relational Frame**:
The broader category-level argument that normalized relational schemas can create hidden context work for coding agents.
_Avoid_: Postgres-only critique

**Hidden SQL Cost**:
The extra agent work caused by a relational data model when a coding agent must inspect schema, infer joins, understand migrations, modify related tables, and prove that a change is correct.
_Avoid_: Database hosting cost, query latency cost, cloud bill

**Agent Context Cost**:
The measurable context burden of an agent task: input tokens, output tokens, tool calls, inspected files or schema objects, retries, elapsed time, and proof attempts.
_Avoid_: Token cost

**AI Development Cost**:
The full cost of building with coding agents, including model tokens, tool loops, elapsed time, failed attempts, verification work, and human babysitting.
_Avoid_: LLM bill, infrastructure cost

**Cost Projection**:
A configurable estimate that scales one verified replay's token, time, retry, and human-supervision deltas into monthly or team-level AI Development Cost.
_Avoid_: ROI claim, guaranteed savings

**Agent Database Overhead**:
The database-related work that slows or increases the cost of Coding Agents, including schema discovery, joins, migrations, mapping code, boilerplate, retries, tests, and human supervision.
_Avoid_: Database overhead, developer overhead

**Core Message**:
MongoDB removes database overhead for AI coding agents, helping teams build faster and more cost-effectively with less context, less supervision, and less database ceremony.
_Avoid_: MongoDB is AI-buildable, MongoDB saves tokens

**Human Babysitting**:
The human attention required to steer, unblock, correct, or verify a coding agent when it struggles to understand or safely change an application.
_Avoid_: Developer productivity, review time
