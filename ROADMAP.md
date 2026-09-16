# Roadmap

This document outlines the planned technical direction for Caribbean Countdowns. Priorities may shift based on contributor interest and community feedback.

## Current state (v2026.05)

- Festival countdown timers for Caribbean and French Guiana events
- 4 languages: English, French, Kréyol haïtien, Spanish
- Eco-evaluator — sustainability self-assessment for festival organisers
- NGO spotlight — community progress tracker with gamification
- Suggest-a-festival wizard — 12-step submission form
- Fully static site: no server, no database, edge-served
- CI/CD pipeline with type checking, linting, dependency audit, and automated deploy
- OpenSSF Scorecard 8.9/10, OpenSSF Best Practices Silver badge
- Automated WCAG 2.1 AA audit (axe-core) passing with 0 violations across all 16 live pages

## Near term (next 3 months)

- **Festival data expansion** — ongoing additions for 2026 and early 2027 events
- **Missing event images** — Sandy Ground Village Festival, Éko Festival Péyi, Festival Lannuit, KRÉYÒL PRIDE
- **OpenSSF Best Practices gold level** — assess feasibility of the remaining criteria
- **Automated deploy trigger** — data update in private storage triggers build automatically, removing the manual step
- **Manual accessibility pass** — keyboard-only navigation and screen reader testing to complement the automated axe-core audit, which only catches a subset of WCAG issues

## Medium term (3–9 months)

- **Search and filter** — filter festivals by island, type, or month without a server
- **iCal export** — generate `.ics` files client-side for add-to-calendar functionality
- **Expanded NGO section** — additional partner organisations, additional data fields

## Long term

- **Multi-year archive** — static pages for past editions
- **Community submissions pipeline** — automated triage of suggest-event form responses
- **Additional maintainer** — onboard more maintainers to grow the contributor team

## Ecosystem positioning

Most existing festival platforms are Europe- or UK-centric, are consumer-listing sites or industry media, and are ad-supported and closed-source. Caribbean Countdowns has no direct equivalent: a Caribbean and French Guiana focus, deadline countdowns rather than attendee event listings, sustainability self-assessment tooling, an NGO/community layer, four languages including Kréyol haïtien, and a fully open, static, privacy-first architecture.

We review this landscape periodically to keep the project's scope deliberate. It informs:

- **Gaps worth closing** — island/type/month filtering and client-side iCal export (both already planned) are standard elsewhere; a pre-rendered festival map and richer per-festival practical data (price band, camping, transport, accessibility) are common and compatible with the static model.
- **Deliberate non-goals** — accounts, reviews/ratings and forums are central to some peers but conflict with the no-server, no-account scope; the NGO/community layer is our lighter alternative.
- **Visibility** — low-commitment outreach to festival organisers, festival-industry media, and industry gatherings, positioning the project as a case study in static, sustainable, open civic infrastructure, is the cheapest way to reach organisers and contributors.
- **Data collaboration** — cross-referencing with non-competing regional or thematic directories could widen Caribbean coverage for diaspora and travelling audiences without expanding the project's geographic scope.
- **Structural references** — established outdoor-arts charities offer a model for governance continuity and accessibility practice (see the planned WCAG 2.1 AA audit).

An annual open "state of Caribbean festivals" summary, drawn from the project's own dataset, is under consideration as a contribution back to this ecosystem.

## Out of scope

- User accounts or authentication
- Server-side rendering
- Events outside the Caribbean and French Guiana region

## Feedback

Open a GitHub issue to suggest additions or reprioritisations.
