# Customer Demo Script: AST-Bench Verified Replay

## Opening

MongoDB's old productivity message was about humans building faster with less database boilerplate. This proof updates that message for the coding-agent era: when agents build ordinary application features, database overhead becomes token spend, elapsed time, retries, review burden, and human babysitting.

Use the current app as a customer-facing verified replay, not as the completed world benchmark. The customer should hear one sentence first: same feature, same Codex run contract, same acceptance test; MongoDB made the AI read less, wait less, and clean up less in this captured run.

## Live Flow

1. Open the Lab Console at `http://127.0.0.1:4173/`.
2. Start with the measured answer. Do not begin with the future benchmark matrix.
3. Compare the lanes:
   - MongoDB: document-shaped workflow.
   - Postgres: clean normalized relational baseline.
4. Point to the four measured deltas:
   - Postgres required more estimated context.
   - Postgres took longer.
   - Postgres showed more cleanup signals.
   - MongoDB changed more code in this run, and that mixed metric is visible.
5. Click Play replay. Translate the replay as: prompt, context read, agent loop, code change, proof, receipt.
6. Open the Proof Packet only after the customer asks for evidence:
   - Fairness Contract is verified.
   - Independent Design Review is captured.
   - Raw Codex traces, diffs, tests, portal snapshots, and DB proofs are captured.

## Customer-Safe Caveats

- This is one verified Codex replay on generated Customer Order Lifecycle records seeded into real local MongoDB and Postgres services.
- It is not a guarantee of savings on every workload.
- It does not claim every coding agent or every SQL system.
- It compares MongoDB against a clean Postgres baseline, not a strawman legacy schema.
- Cost projection is an assumption-based model, not guaranteed savings.

## Do Not Say First

- Do not lead with `3/450`.
- Do not lead with Claude Code, Cursor, or future lanes.
- Do not lead with raw file paths, hashes, or command names.
- Do not call a single replay a world benchmark.
- Do not say guaranteed savings.

## Internal Backlog, Not Demo Copy

- Run the full 25 task x 2 database lane x 3 agent x 3 repeat matrix before calling AST-Bench a public benchmark.
- Add Claude Code and Cursor only after each lane has verified artifacts.
- Add a stitched-stack lane, such as Postgres plus Elastic plus Pinecone, before making multi-system claims.
- Add enterprise stress tiers with hundreds or thousands of schema objects after the seed replay stays understandable.
- Keep failed attempts, retries, timeouts, and mixed metrics visible in evidence.

## Skeptic Questions

**"Did you make Postgres bad on purpose?"**
No. The Postgres target is normalized with explicit tables and foreign keys for account, order, shipment, approval, audit, SLA, inventory, and portal visibility concerns. The Independent Design Review exists specifically to make this objection inspectable.

**"Is this just token math?"**
No. The proof tracks transcript estimate, elapsed time, changed files, diff size, retries, tests, screenshots, DB proof, and review-cost assumptions.

**"Why Codex only?"**
Seller V1 holds one agent constant so the proof compares database overhead, not agent products. Claude Code and Cursor are future validation lanes and should get their own verified replays before any claim is made.

**"Can customers inspect the evidence?"**
Yes. The replay links to raw traces, diffs, tests, screenshots, DB proofs, and manifests.
