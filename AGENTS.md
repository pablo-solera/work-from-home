# AGENTS.md

Project-specific instructions for AI agents working on `work-from-home`.

## Scope

These rules apply only to this repository.

## Workflow

- Propose a short plan before implementing changes.
- Wait for user confirmation before editing files.
- Keep changes small, focused, and directly related to the request.
- Do not touch unrelated files or untracked files unless explicitly requested.
- Prefer the minimal correct implementation over broader refactors.

## Git

- Do not create commits unless the user explicitly asks.
- Do not push unless the user explicitly asks.
- Always use Conventional Commits.
- Before committing, inspect `git status`, `git diff`, and recent commit messages.
- Never commit secrets, `.env`, credentials, or generated local-only files.
- Do not amend commits unless the user explicitly asks.

## Stack

- Next.js 16 App Router.
- React 19.
- Tailwind CSS.
- Drizzle ORM.
- PostgreSQL.
- Docker and DockerHub.
- Bun.

<!-- BEGIN:nextjs-agent-rules -->
## Next.js

This is NOT the Next.js you know.

This version has breaking changes. APIs, conventions, and file structure may differ from training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing code that touches Next.js APIs, conventions, routing, server actions, caching, metadata, or deployment behavior. Heed deprecation notices.

- Respect App Router conventions.
- Prefer Server Components by default.
- Use Client Components only where interactivity or browser APIs are needed.
- Server Actions should live in appropriate server files.
- Files marked with `"use server"` must export only async functions.
<!-- END:nextjs-agent-rules -->

## Architecture

- `app/`: routes, pages, layouts, and route-scoped server actions.
- `components/`: UI components.
- `lib/`: auth, services, repositories, validation, and domain logic.
- `db/`: Drizzle schema and database connection.
- `scripts/`: operational scripts, including SQL setup scripts.
- Keep UI, actions, services, and repositories separated.
- Prefer repository functions for database access.
- Prefer service functions for business rules.

## UI

- Use Tailwind CSS.
- Do not add shadcn or other UI libraries unless explicitly requested.
- Keep visible UI copy in Spanish unless the user asks otherwise.
- Preserve the existing simple, functional visual style.

## Database

- Use Drizzle schema for application data modeling.
- SQL scripts are acceptable for deployment/setup tasks when simpler.
- Database migrations are hand-written SQL files under `drizzle/` and are applied with `psql` (or the integration-test runner). Do not use `drizzle-kit generate` or `drizzle-kit migrate`; the migration journal does not contain complete snapshots for the applied SQL history.
- Do not make destructive database changes without explicit confirmation.
- Do not suggest deleting Docker volumes unless the user accepts data loss.

## Docker And Deployment

- Do not put secrets in images or committed files.
- Use environment variables through `.env` or deployment configuration.
- The web image is published to DockerHub.
- `latest` may be overwritten on each push.
- Versioned Docker tags should come from `package.json`.
- Run `docker compose config` when changing Docker Compose files.

## Validation

- Run `bun run lint` after code changes when feasible.
- Run `bun run build` after functional or Next.js changes when feasible.
- Run `docker compose config` after Docker Compose changes.
- If validation cannot be run, explain why.

## Language

- Respond in Spanish for this project unless the user asks for another language.

## Safety

- Do not read, print, or commit secrets unless explicitly necessary and approved.
- Do not run destructive commands such as `git reset --hard`, broad deletes, or `docker compose down -v` without explicit confirmation.
- Preserve user changes and concurrent work.
