# Podyum 🎭

**A social fashion app for comparing outfits, discovering style inspiration, and joining themed challenges.**

Podyum is an in-development full-stack mobile application where users share outfit combinations, vote between two looks, and explore community preferences. It combines a React Native app with a modular NestJS backend.

> **Status:** Actively in development. Several backend workflows are implemented; mobile integrations are ongoing, and some screens still use demo data. This is not a production release.

## Features

- **Outfit comparisons:** A/B style polls, preference voting, results, and saved posts.
- **Social features:** Profiles, friends, comments, feeds, and post interactions.
- **Accounts:** Email registration, verification, login, token refresh, and profile setup APIs.
- **Media:** Local image upload, processing, avatar support, and access controls.
- **Challenges:** Backend support for timed fashion challenges and private QR-invite lobbies.
- **Engineering:** Modular APIs, input validation, moderation, API tests, and database tests.

The main social, profile, publishing, settings, notifications, and challenge screens use real APIs. Trends and product details also use the shared catalog and filtered trends API. Demo previews remain available; production-ready OAuth/email delivery and cloud media infrastructure are still in progress.

## Tech Stack

| Area | Technologies |
| --- | --- |
| Mobile | React Native, Expo, Expo Router, TypeScript |
| Backend | Node.js, NestJS, REST APIs, Socket.IO |
| Data | Prisma, PostgreSQL / Prisma Postgres for local development |
| Quality | TypeScript checks, linting, API and database tests |

## Project Structure

Current progress: [Backend implementation plan](backend/docs/backend-implementation-plan-2026-10-19.md) · [Mobile API integration](mobile/docs/connected-screens-integration.md) · [Filtered trends API](backend/docs/trends-api-development.md). As of October 20, maintenance, game timing, catalog tagging, trend projections, and the mobile trends integration are implemented.

```text
Podyum/
├── mobile/        # React Native / Expo mobile app
├── backend/       # NestJS API, database schema, services and tests
└── package.json   # Shared development commands
```

`backend/` and `mobile/` manage their own packages, lockfiles, dependencies, and TypeScript configuration. Mobile uses Expo Router with routes in `src/app`, feature screens in `features`, and shared components, hooks, clients, and theme modules.

Detailed documentation: [Mobile](mobile/README.md) · [Backend](backend/README.md) · [Architecture](backend/docs/architecture.md)

## Running Locally

**Requirements:** Node.js 24.11+ and npm.

```bash
npm run setup
```

Copy `backend/.env.example` to `backend/.env`, then review local configuration. Do not commit secrets.

```bash
npm run db:start
npm run db:generate
npm run db:deploy
```

Start the backend and mobile development servers in separate terminals:

```bash
npm run dev:backend
npm run dev:mobile
```

Optional web preview:

```bash
npm run web:mobile
```

Backend API documentation is available locally at `http://127.0.0.1:3000/v1/docs`.

## Tests & Checks

```bash
npm run typecheck
npm run lint:mobile
npm run test:api
npm run test:db
npm run test:smoke
```

Some test suites require a local database. The mobile build exports app bundles but does not create a store-ready APK or IPA.

---

*An ongoing software engineering project — features, integrations, and documentation continue to evolve.*
