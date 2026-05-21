# ADR-0001: Two-Axis Rating Mechanic for Ideas

## Status
Accepted — 2026-05-21

## Context
Employees need a way to express support and signal value on Ideas year-round. Four options were prototyped:

- **A** — Single upvote (thumbs up + count)
- **B** — Fixed reaction set (emoji icons with per-reaction counts)
- **C** — Upvote count + reactions combined
- **D** — Two independent axes: Business Impact (1–5 stars) + Effort Required (Low / Medium / High)

The application serves non-technical employees and aims to encourage year-round engagement. Simple upvotes produce a popularity ranking but give no signal about feasibility. Reactions add nuance but are ambiguous. A two-axis rating surfaces both the perceived value and the cost of an idea — the two things a company actually needs to prioritise work.

## Decision
Employees rate Ideas on two independent axes:

- **Business Impact** — a 1–5 star rating, aggregated into a visible average and vote count
- **Effort Required** — a three-option vote: Low / Medium / High, shown as a distribution

Both ratings are optional and independent. An employee can rate one without the other. Selecting the same value a second time removes the rating (toggle behaviour).

This design was chosen after a live prototype comparison (Variations A–D). Variation D was selected.

## Consequences
- Ideas can be sorted and filtered by average Impact score and dominant Effort level, enabling a natural prioritisation view.
- The rating model is more complex than a single upvote but was judged worth the trade-off given the prioritisation value it provides.
- A simple upvote ("I support this") is not captured separately — Impact rating ≥ 1 star serves as the implicit endorsement signal.
- Changing the rating axes later (e.g. adding a third axis) would require migrating existing rating data and re-educating users.
