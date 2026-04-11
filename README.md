# BetterWatchlist

A self-hosted Stremio addon built with Bun that shows series from a user's Trakt watchlist only when they have aired but unwatched episodes.

## What it does

- Reads shows from a user's Trakt watchlist
- Checks watched progress per show
- Ignores specials (`season 0`)
- Includes only shows with at least one aired, unwatched episode
- Sorts by the latest relevant activity:
  - last watched
  - latest new unwatched aired episode
  - watchlist added date

## Stack

- Bun
- TypeScript
- `stremio-addon-sdk`
- Trakt API
- SQLite for local persistence
- Docker / Docker Compose for self-hosting

## How auth works

There are two different things:

1. Trakt app keys
- `client_id`
- `client_secret`

These belong to you as the addon owner/developer.
You save them once on the server.

2. Trakt user authorization

Each user authorizes their own Trakt account through the configure page.
After that, the addon generates a personal manifest URL like:

```text
https://your-domain.com/u/<trakt-user-id>/manifest.json
```

That personal manifest is what the user installs in Stremio.

## Persistence

This project stores data in SQLite at:

```text
/app/data/better-watchlist.sqlite
```

With Docker Compose, `./data` on the host is mounted into `/app/data` in the container, so the database survives rebuilds and restarts.

## Environment

Create `.env`:

```env
PORT=6001
```

## Local development

Install dependencies:

```bash
bun install
```

Run in dev mode:

```bash
bun run dev
```

Run once:

```bash
bun run start
```

Type-check:

```bash
bun run check
```

## Docker

Build:

```bash
docker compose build
```

Build and start:

```bash
docker compose up -d --build
```

Stop:

```bash
docker compose down
```

The SQLite database is persisted in:

```text
./data
```

## nginx reverse proxy

If you run the addon locally and expose it behind nginx, use headers like these:

```nginx
location / {
    proxy_pass http://127.0.0.1:6001;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

The addon uses these headers to build the correct public manifest URLs.

## Trakt setup

Create a Trakt API application and get:

- `client_id`
- `client_secret`

Then:

1. Open the addon configure page:

```text
http://127.0.0.1:6001/configure
```

2. Save your Trakt app keys once
3. Click `Start Trakt Authorization`
4. Open `https://trakt.tv/activate`
5. Enter the code shown on the page
6. Approve access
7. Click `Check Authorization`
8. Copy the personal manifest URL
9. Install it in Stremio via `Addons -> Install from URL`

## Default endpoints

- `/configure` - configuration and auth page
- `/manifest.json` - base manifest
- `/u/<userId>/manifest.json` - personal manifest for a Trakt user
- `/health` - health check

## Notes

- The addon is multi-user
- Tokens are stored per Trakt user in SQLite
- Trakt app keys are stored once for the server
- Watchlist updates are lightly cached, so new items should appear quickly without restarting the server
- Specials are ignored to avoid false positives for already watched shows
