# Customer Demo Script: AST-Bench v2 Shape-Diversity MVP

## Opening

MongoDB's productivity message for the coding-agent era: when agents build ordinary application features, database overhead becomes token spend, elapsed time, retries, and human babysitting.

The v2 pilot sharpens this into a testable question: **does that overhead grow as the Postgres schema gets deeper?** One business outcome, three Postgres schema shapes (shallow → moderate → deep), two independent coding agents, 60 real measured runs. The marketing page shows the answer honestly — whichever way it lands.

Lead with one sentence: two independent agents (Codex and Claude Code) both did less database work on MongoDB. The v2 story is whether that gap widens as Postgres normalizes deeper.

---

## Live Flow

1. **Open the marketing page** at `http://127.0.0.1:4173/`.
2. **Lead with the agreement hero** — "both agents did less DB work on MongoDB." Agent agreement is the core claim: two independent instruments, same direction.
3. **Walk the twin-agent graphs (within-agent).** Read the current within-agent deltas live off the page — the real v2 numbers come from the 60-run batch and live in the bundle. Do not quote v1 figures. Point out: Codex-vs-Codex and Claude-vs-Claude are the only valid comparisons; cross-agent absolute numbers are not comparable because the two CLIs report tokens differently.
4. **Tell the 3-shape depth story.** The benchmark ran one shared outcome across three Postgres schema shapes:
   - *Shallow* — 8 tables, mostly denormalized.
   - *Moderate* — 12 tables, 1-to-many child tables.
   - *Deep* — 17 tables, full 3NF with a many-to-many junction; 10+ joins to reconstruct state.
   MongoDB stayed flat across all shapes. The page shows whether the gap grows with depth — report it as the page shows it, not as a pre-decided answer.
5. **Show the why-panel** — real trace heuristics from the captured agent transcripts. This is not model-level reasoning; it shows what the agents actually read and how many joins were involved.
6. **"Inspect the evidence"** — open this section only after the customer asks for it. Show: fail-closed acceptance tests, cheat detector (0 gamed runs), raw diffs vs frozen commit, token counts from real CLI transcripts, hash-verified evidence sources.

---

## Customer-Safe Caveats

- This is a **focused pilot**: one shared outcome, 3 schema shapes, 2 coding agents (Codex and Claude Code), 60 real runs.
- It is **not a guarantee of savings** on every workload.
- It does not claim every coding agent or every SQL system.
- Every Postgres shape is **idiomatic best-practice normalization** — the deep shape is what a competent DBA builds, not a strawman legacy schema.
- Cost is derived from real measured token counts and documented published-price assumptions, not a guaranteed savings model.
- Cross-agent absolute numbers (e.g., Codex total cost vs Claude Code total cost) are **not valid comparisons** — the two CLIs report tokens differently. Only within-agent comparisons are valid.
- **tokensRead** = `inputTokens + cachedInputTokens`. This is the context the agent had to process — real values from each CLI's usage events.

---

## Do Not Say First

- Do not lead with `60/450` or any run count.
- Do not lead with raw file paths, hashes, or command names.
- Do not call a focused pilot a world benchmark.
- Do not say "guaranteed savings."
- Do not compare Codex absolute numbers to Claude Code absolute numbers — only within-agent comparisons are valid.
- Do not assert the gap definitely grows with depth before showing the page — let the data speak.

---

## Skeptic Questions

**"Did you make Postgres bad on purpose?"**
No. There are three Postgres shapes and all are textbook best practice for their normalization level. The shallow shape has sensible denormalization. The moderate shape uses proper 1-to-many child tables. The deep shape is full 3NF with a real many-to-many junction — exactly what a competent DBA builds for this domain. An independent Postgres-fairness review is the documented next step to make this objection fully inspectable by a neutral party.

**"Is this just token math?"**
No. The proof tracks context tokens read (tokensRead = inputTokens + cachedInputTokens), elapsed time, changed files, diff size, retry signals, tests, DB proof, and review-cost assumptions.

**"Why only these two agents, and why within-agent comparisons only?"**
The benchmark compares databases, not agent products. Codex and Claude Code are two independent measuring instruments — both favor MongoDB, which is the claim. Cross-agent absolute comparisons are invalid because the two CLIs report tokens differently (Codex usage is cumulative including cache; Claude usage is final-turn, cache-dominated). Additional agents are future validation lanes.

**"Why three Postgres shapes and not just one?"**
To test whether the disadvantage is schema-depth-dependent. If the gap only appears at deep normalization, that tells a different story than if it appears even at shallow denormalization. The benchmark is designed to be falsifiable — if there is no depth trend, the page reports that honestly.

**"Can customers inspect the evidence?"**
Yes. The page links to raw traces, diffs, tests, DB proofs, and manifests. The cheat detector and fail-closed acceptance tests are part of the public harness.

---

## Internal Backlog — Not Demo Copy

- Conduct independent Postgres-fairness review (neutral third party confirms all three shapes are competent and non-adversarial) before any external publication.
- Obtain MongoDB brand/legal sign-off before calling this officially endorsed MongoDB material.
- Run the full 25 task × 2 database lane × 3 agent × 3 repeat matrix (450 runs) before calling AST-Bench a public benchmark.
- Add Cursor only after its lanes have verified artifacts.
- Add a stitched-stack lane (e.g., Postgres + Elastic + Pinecone) before making multi-system claims.
- Keep failed attempts, retries, timeouts, and mixed metrics visible in evidence.
