# Contributing

Thank you for your interest in contributing to Caribbean Countdowns. This document explains how the project works and what is expected from contributors.

## Ways to contribute

- **Report a bug** — open a GitHub issue describing what you observed and what you expected
- **Suggest a festival** — use the [suggest-event form](https://caribbean.countdowns.co/suggest-event/) on the live site
- **Propose a feature** — open an issue before writing code; discuss the approach first
- **Submit a pull request** — see the workflow below

## Branch protection and pull request requirement

All changes to `main` require a pull request. Direct pushes to `main` are blocked. Every PR must pass the `build` CI check before it can be merged.

Branch naming:

| Type | Pattern | Example |
|---|---|---|
| New event / data | `content/…` | `content/crop-over-2026` |
| New feature | `feat/…` | `feat/music-page` |
| Bug fix | `fix/…` | `fix/countdown-timezone` |
| Config / CI | `chore/…` | `chore/dependabot` |
| Docs | `docs/…` | `docs/architecture` |

## Tech stack

- **Astro** (static output) — pages in `src/pages/`, components in `src/components/`
- **JavaScript** — all scripts in `public/scripts/*.js` as classic (non-module) files
- **Data** — event JSON files live in a Cloudflare R2 bucket and are pulled into `src/data/` when the site is built (not stored in git)
- **Images** — WebP format, `public/images/`

## Coding standards

The project follows these style guides for its primary languages. Contributions must generally comply. ESLint automatically enforces compliance for JavaScript on every PR.

### JavaScript

Style guide: [MDN JavaScript guidelines](https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines/Writing_style_guide/Code_style_guide/JavaScript). Key rules enforced by ESLint (`eslint.config.js`):

- Strict equality (`===`) required — `==` is an error
- No undefined variables (`no-undef` error)
- No unused variables (`no-unused-vars` warning)
- Scripts go in `public/scripts/` — never inline in `.astro` files
- Script tags must use: `<script is:inline src="/scripts/x.js" defer></script>`
- Never use `onclick` attributes — use `addEventListener` from the external script file
- The CSP enforces `script-src 'self'` — inline scripts are blocked at the browser level

### HTML / Astro

Style guide: [Astro documentation](https://docs.astro.build/en/basics/astro-syntax/). Key rules:

- Semantic HTML elements (`<nav>`, `<main>`, `<article>`, `<section>`, `<footer>`)
- ARIA attributes where needed for interactive elements
- No hardcoded English-only strings in templates — use the `t-en`/`t-fr`/`t-kr`/`t-es` class pattern

### Languages

The site supports four languages: English (`t-en`), French (`t-fr`), Kréyol haïtien (`t-kr`), Spanish (`t-es`). Any user-facing text added to `.astro` pages must include all four language variants.

### Dependencies

- Adding a new npm dependency requires justification in the PR description
- New dependencies must pass `npm audit` at high severity level before merging

## Tests and CI

The CI pipeline (`build` job in `.github/workflows/deploy.yml`) runs on every pull request:

1. `npm run lint` (ESLint) — checks the JavaScript files in `public/scripts/`
2. `npm run test:workers` — runs the automated tests of every Cloudflare Worker (`workers/*/test.mjs`, `node:test`)
3. `npm audit` — high-severity vulnerabilities block the merge

On pushes to `main`, the daily schedule and manual runs, which have access to the event data, the job also pulls the data from R2, validates every JSON file, runs `npm run check` (`astro check`, types) and `npm run build`, then deploys.

`npm test` is the standard way to run the whole suite locally (type check, lint and Worker tests). It needs the event data in `src/data/`; without it the type check reports missing data files. The parts can be run on their own:

```bash
npm test                # type check + lint + Worker tests
npm run lint            # ESLint only
npm run test:workers    # Worker tests only (no data needed)
```

**Policy:** when major new functionality is added, tests for that functionality must be added to the automated test suite before the PR is merged.

## Code review

Every change reaches `main` through a pull request, and a maintainer reads the whole diff before merging. Nothing is merged automatically; Dependabot pull requests are reviewed the same way. The reviewer checks that:

- the change matches its description and does not mix unrelated work
- CI is green and tests exist for new functionality (see the policy above)
- the coding standards above are respected: no inline scripts, text in all four languages, semantic HTML
- any new dependency is justified and passes `npm audit`
- commits carry a DCO sign-off
- event data stays valid JSON and keeps premium-only fields out of public pages

## Security review

Changes that touch a Worker, the security headers or CSP, the CI/CD pipeline, authentication or anything that handles visitor input get a security review before merging. The reviewer checks input validation and size limits, that no secret or personal data is logged or stored, that error messages do not leak internals, and that access is limited to what is needed. Findings are fixed in the same pull request. The current security posture is described in [SECURITY.md](SECURITY.md).

## Good first issues

Small, self-contained tasks are labelled [`good first issue`](https://github.com/countdowns-co/caribbean-countdowns/labels/good%20first%20issue) in the issue tracker. Typical examples: a missing translation in one of the four languages, a typo or an unclear sentence, an accessibility fix on a single page, a small test for an existing Worker. Comment on the issue to say you are taking it; a maintainer answers and can point you to the right file. If an issue seems too big, ask before you start.

## Account security

Everyone with write access to this repository is expected to protect their GitHub account with two-factor authentication. GitHub supports authenticator apps (TOTP), security keys and passkeys; passkeys or security keys are preferred. Contributors who only open pull requests from a fork are encouraged to do the same.

## Sign-off (DCO)

By submitting a pull request you certify that you have the right to contribute the code under the project's MIT licence, and you agree to the [Developer Certificate of Origin](https://developercertificate.org). Add a sign-off line to your commits:

```
git commit -s -m "feat: add Crop Over festival"
```

This adds `Signed-off-by: Your Name <your@email.com>` to the commit message automatically.

## Security issues

Do not open a public issue for security vulnerabilities. Follow the process described in [SECURITY.md](SECURITY.md).
