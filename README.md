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

The admin credentials can be configured with `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` in `.env`. Defaults are:

```text
admin@example.com
admin123
```

## DockerHub

GitHub Actions publishes the web image on every push to `main` and on manual runs.

Configure these repository settings:

- Variable: `DOCKERHUB_USERNAME`
- Secret: `DOCKERHUB_TOKEN`

The workflow publishes two tags:

- `${DOCKERHUB_USERNAME}/work-from-home-web:latest`
- `${DOCKERHUB_USERNAME}/work-from-home-web:<package.json version>`

For example, with version `0.1.0`:

```text
your-user/work-from-home-web:latest
your-user/work-from-home-web:0.1.0
```

To deploy from DockerHub, set `WEB_IMAGE` in `.env`:

```env
WEB_IMAGE=your-user/work-from-home-web:latest
```

Then run:

```bash
docker compose pull
docker compose up -d
```

## Checks

```bash
bun run lint
bun run build
```
