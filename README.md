# 🌴 Caribbean Countdowns

Countdown timers to festival application deadlines across the Caribbean and French Guiana — with NGO support, sustainability scoring and a Caribbean natural ecosystem quiz.

**Live site → [caribbean.countdowns.co](https://caribbean.countdowns.co)**

[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/countdowns-co/caribbean-countdowns/badge)](https://scorecard.dev/viewer/?uri=github.com/countdowns-co/caribbean-countdowns)
[![CII Best Practices](https://www.bestpractices.dev/projects/12911/badge)](https://www.bestpractices.dev/projects/12911)
[![Deploy CC](https://github.com/countdowns-co/caribbean-countdowns/actions/workflows/deploy.yml/badge.svg)](https://github.com/countdowns-co/caribbean-countdowns/actions/workflows/deploy.yml)
[![WCAG 2.1 AA](https://img.shields.io/badge/%E2%99%BF%20WCAG%202.1-AA-166534)](https://caribbean.countdowns.co/accessibility-statement/)

---

## 🎉 What it does

- ⏳ Tracks deadlines for Caribbean events across years
- 🌐 4 languages: English, French, Kréyol haïtien, Spanish
- 🌿 Eco-evaluator — sustainability self-assessment tool for festival organisers
- 🤝 NGO spotlight — community progress tracker for the [NGO community](https://caribbean.countdowns.co/ngo/)
- 📝 Suggest a festival — 12-step submission wizard
- 🛡️ [Security posture](https://caribbean.countdowns.co/security/) — OpenSSF Scorecard, CII Best Practices, and privacy compliance tracked publicly, updated as the project evolves
- ♿ [Accessibility statement](https://caribbean.countdowns.co/accessibility-statement/) — WCAG 2.1 AA conformance status, automated audit evidence, and known limitations tracked publicly
- 🔒 Privacy-first visit counter — first-party only, no third-party analytics or tracking scripts

## 🔧 How it's built

Fully static site — no server, no database, no runtime. Built at deploy time, served from the edge. Data is pulled from private storage at build time and never committed to the repository.

We are happy to share technical details with anyone curious about the approach — open an issue or reach out directly.

## 🏗 Architecture

The site follows a static-first, separation-of-concerns design:

**Build pipeline** — Source code and festival data are kept separate. Data is fetched from private storage at build time, merged with templates, and output as a fully static site. No data is committed to the repository.

**Hosting and delivery** — The built site is served as static files through a CDN with security headers, TLS, and edge caching. No application server runs between deploys.

**Community & data layer** — Stateful interactions (community progress tracking, event submissions, and other features as they're added) are handled by small, single-purpose serverless functions rather than a persistent backend — each one reads/writes a scoped store and exposes a narrow JSON endpoint to the browser. This layer is designed to grow: new stateful features get their own function rather than accumulating into a monolith.

**CI/CD** — Every push triggers an automated pipeline: type checking, linting, dependency audit, build, and deploy, built entirely from GitHub's own official Actions rather than custom deploy scripts — less to maintain, less to audit, and immediately recognizable to anyone who's worked with GitHub Actions before. All changes to `main` go through a pull request with mandatory review.

**Key design principles:** no client-side framework, no persistent server process, secrets never enter the repository, data separated from code.

## 💚 Open source

This project is and will stay public. Keeping the code open is not just a technical choice — it is a commitment to transparency and collaboration.

We believe that a website about Caribbean culture and environmental impact is more credible when its own infrastructure is open by default. Community members can verify how the site works, suggest improvements, report issues or fork it to build something new.

If you want to contribute data, translations or code — open an issue or a pull request.

## 🌱 Sustainability

We believe that open source is itself a sustainability practice. Shared code reduces duplicated effort across the ecosystem — every fork that reuses this avoids someone rebuilding it from scratch.

The site is designed to minimise compute: fully static, edge-served, no server running between deploys. The [sustainability page](https://caribbean.countdowns.co/sustainability/) and eco-evaluator tool are more meaningful because the project applies the same principles to itself.

## 📄 Licence

MIT
