# Customer Demo Script: AST-Bench Focused Benchmark

## Opening

MongoDB's old productivity message was about humans building faster with less database boilerplate. This proof updates that message for the coding-agent era: when agents build ordinary application features, database overhead becomes token spend, elapsed time, retries, review burden, and human babysitting.

Use the current app as a customer-facing benchmark result, not as the completed world benchmark. The customer should hear one sentence first: same five tasks, two independent coding agents, both agents read less context, spent less, waited less, and retried less on MongoDB than on Postgres.

## Live Flow

1. Open the Lab Console at `http://127.0.0.1:4173/`.
2. Start with the measured answer. Do not begin with the future benchmark matrix.
3. Lead with agent agreement: Codex and Claude Code are independent measuring instruments, and both favor MongoDB on every metric.
4. Walk the within-agent deltas (Postgres vs. MongoDB, median across 3 repeats):
   - **Codex:** +15% tokens read, +15% cost, +18% time, +33 retry signals on Postgres.
   - **Claude Code:** +4% tokens read, +9% cost, +8% time, +16 retry signals on Postgres.
5. Explain the within-agent rule: the two CLIs report tokens differently, so cross-agent absolute numbers are not comparable. Only Codex-vs-Codex and Claude-vs-Claude are valid.
6. Point to the harness integrity note: the acceptance tests were fixed to fail-closed and a cheat detector verified all 60 runs are clean.
7. Open the Proof Packet only after the customer asks for evidence:
   - Fairness Contract is verified.
   - Independent Design Review is captured.
   - Raw agent traces, diffs, tests, portal snapshots, and DB proofs are captured.

## Customer-Safe Caveats

- This is a focused benchmark: 5 tasks, 2 coding agents (Codex and Claude Code), 60 real runs against local Docker MongoDB and Postgres.
- It is not a guarantee of savings on every workload.
- It does not claim every coding agent or every SQL system.
- It compares MongoDB against a clean Postgres baseline, not a strawman legacy schema.
- Cost is derived from real measured token counts and documented published-price assumptions, not a guaranteed savings model.
- Cross-agent absolute numbers (e.g., Codex total cost vs. Claude Code total cost) are not valid comparisons; the two CLIs report tokens differently.

## Do Not Say First

- Do not lead with `60/450`.
- Do not lead with raw file paths, hashes, or command names.
- Do not call a focused benchmark a world benchmark.
- Do not say guaranteed savings.
- Do not compare Codex absolute numbers to Claude Code absolute numbers — only within-agent comparisons are valid.

## Internal Backlog, Not Demo Copy

- Run the full 25 task × 2 database lane × 3 agent × 3 repeat matrix before calling AST-Bench a public benchmark.
- Add Cursor only after its lanes have verified artifacts.
- Add a stitched-stack lane, such as Postgres plus Elastic plus Pinecone, before making multi-system claims.
- Add enterprise stress tiers with hundreds or thousands of schema objects after the seed replay stays understandable.
- Keep failed attempts, retries, timeouts, and mixed metrics visible in evidence.

## Skeptic Questions

**"Did you make Postgres bad on purpose?"**
No. The Postgres target is normalized with explicit tables and foreign keys for account, order, shipment, approval, audit, SLA, inventory, and portal visibility concerns. The Independent Design Review exists specifically to make this objection inspectable.

**"Is this just token math?"**
No. The proof tracks context tokens read, elapsed time, changed files, diff size, retry signals, tests, screenshots, DB proof, and review-cost assumptions.

**"Why only these two agents, and why within-agent comparisons only?"**
The benchmark compares databases, not agent products. Codex and Claude Code are two independent measuring instruments — both favor MongoDB, which is the claim. Cross-agent absolute comparisons are invalid because the two CLIs report tokens differently (Codex usage is cumulative including cache; Claude usage is final-turn, cache-dominated). Cursor and other agents are future validation lanes and need their own verified runs before any claim is made on their behalf.

**"Can customers inspect the evidence?"**
Yes. The replay links to raw traces, diffs, tests, screenshots, DB proofs, and manifests. The cheat detector and fail-closed acceptance tests are also part of the public harness.
