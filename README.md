# Work From Home

Next.js app for managing work-from-home days.

## Local Development

```bash
bun install
bun run dev
```

Open `http://localhost:3000`.

## Docker

Copy the environment template and update secrets before deploying:

```bash
cp .env.example .env
```

Run the app and Postgres locally:

```bash
bun run docker:up
```

Stop the stack:

```bash
bun run docker:down
```

Create the database tables and a test admin after the stack is running:

```bash
bun run docker:setup-db
```

You can also run the SQL directly:

```bash
docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f -' < scripts/setup-database.sql
```

The application accepts Active Directory users and, when explicitly enabled,
the three test users configured by `TEST_ACCOUNTS_*`. Test users are seeded
with:

```bash
bun run db:seed
```

Their shared local password is read from `TEST_ACCOUNTS_PASSWORD`; it is never
stored in the database. Set `TEST_ACCOUNTS_ENABLED=false` to disable them.

## DockerHub

GitHub Actions runs lint and coverage on pull requests and on pushes to `main` and
`develop`. Docker images are published only when a version tag is pushed from a
commit that belongs to `main`.

Configure these repository settings:

- Variable: `DOCKERHUB_USERNAME`
- Secret: `DOCKERHUB_TOKEN`

The release workflow expects the version in `package.json` to match the Git tag.
For example, `package.json` version `2.8.0` must be released as `v2.8.0`.

Create and push a release tag from `main`:

```bash
git checkout main
git pull
git tag -a v2.8.0 -m "v2.8.0"
git push origin v2.8.0
```

The workflow publishes two tags:

- `${DOCKERHUB_USERNAME}/work-from-home-web:latest`
- `${DOCKERHUB_USERNAME}/work-from-home-web:v<package.json version>`

For example, with version `2.8.0`:

```text
your-user/work-from-home-web:latest
your-user/work-from-home-web:v2.8.0
```

The default `docker-compose.yml` uses `pablosla/work-from-home-web:latest`.
To deploy the latest published image, run:

```bash
docker compose pull
docker compose up -d
```

## Checks

```bash
bun run lint
bun run build
```
