# Future Agent Lanes

Seller V1 is verified for Codex only. Claude Code and Cursor must not be claimed until they produce their own Instrumented Agent Runs with the same contract.

## Required Contract

Each future lane must capture:

- same Scenario Fixture version
- same task prompt and acceptance contract
- agent name, version, and model metadata when available
- raw transcript or closest available trace
- command/test logs
- code diff
- before/after portal proof
- normalized metrics
- hash-locked evidence manifest

## Order

1. Claude Code
2. Cursor
3. Additional coding agents only after the first two are stable

## Claim Rule

The Lab Console may show a future lane as `planned` or `required`, but it must not show `captured` or `verified` until the lane passes the same gates as Codex.
