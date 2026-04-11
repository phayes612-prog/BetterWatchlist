import { config as loadDotEnv } from "dotenv";
import { resolve } from "node:path";

loadDotEnv();

const parsePort = (value: string | undefined): number => {
  if (!value) {
    throw new Error("PORT is required. Set it in .env.");
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PORT value: ${value}`);
  }
  return parsed;
};

const port = parsePort(process.env.PORT);

export const config = {
  traktClientId: process.env.TRAKT_CLIENT_ID ?? "",
  traktClientSecret: process.env.TRAKT_CLIENT_SECRET ?? "",
  port,
  progressCacheTtlMs: 5 * 60 * 1000,
  watchlistCacheTtlMs: 15 * 1000,
  catalogCacheMaxAgeSec: 5,
  databaseFile: resolve(process.cwd(), "data", "better-watchlist.sqlite"),
};

export const validateConfig = (): void => {
  return;
};
