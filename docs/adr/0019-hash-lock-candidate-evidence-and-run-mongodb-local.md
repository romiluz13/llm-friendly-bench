# Hash-lock candidate evidence and run MongoDB local

Local Proof Candidates must emit an Evidence Manifest that records the source and generated proof files with SHA-256 hashes. The gate checker validates those hashes, requires passing acceptance evidence, and blocks candidate or verified artifacts that make stronger claims than their evidence supports.

The first real database step is a MongoDB Local DB Replay. It seeds an isolated Docker MongoDB on `127.0.0.1:27018`, runs the Order Exception Workflow against real collections with `mongosh`, captures before/after portal state, and adds the captured proof to the Evidence Ledger. Postgres local remains a supported path through Docker, but the candidate does not depend on Postgres image availability.

The Postgres Local DB Replay is the symmetric path: seed the normalized schema through container-local `psql`, run SQL workflow mutations, capture before/after portal state, and add the proof file when it passes. A candidate can show both database-local replays as captured while still requiring live coding-agent traces, screenshots, and Independent Design Review before `verified`.
