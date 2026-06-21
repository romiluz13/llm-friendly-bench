# Design

## Overview

AST-Bench is a benchmark theater for technical proof. It should feel like a serious proof room, not a developer terminal and not a marketing page. The interface should combine an executive-readable story, a seller-friendly receipt, and raw evidence drilldown.

## Visual System

- Register: product.
- Theme: light forensic console used in customer meetings and developer review sessions.
- Color strategy: restrained neutral base with MongoDB green for verified state, blue for trace/navigation, amber for blocked work, red only for risk or overclaim warnings, and violet for agent/runtime metadata.
- Typography: system sans stack, fixed sizes, dense but readable labels.
- Radius: 6-8px for panels and buttons.
- Elevation: light shadows only for primary surfaces and transient feedback.

## Interaction

- Every button must acknowledge click state visibly.
- Evidence buttons update the stage, plain-language replay, selected claim, drawer title, source list, and action receipt.
- Replay controls animate state progression without blocking inspection.
- Task and agent cards are not decorative; they show status and open relevant evidence.
- Cost controls update projection immediately and clearly label seed-only assumptions.
- Raw commands may exist in evidence, but the primary view must translate them into business actions.

## Motion

- Motion conveys state: click acknowledgment, active step change, source focus, progress pulse.
- Use 150-250ms transitions for product feedback.
- Respect `prefers-reduced-motion`.

## Copy

- Use public proof language: benchmark contract, seed case, captured evidence, blocked V1 gate.
- Prefer plain phrases: "what the AI read", "what it changed", "what passed", "what it cost", "what is still not proven".
- Avoid internal seller terms, objection handling labels, and guaranteed savings language.
