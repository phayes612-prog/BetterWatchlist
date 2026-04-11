import { createRequire } from "node:module";

import { buildNewEpisodesCatalog, watchlistEpisodesCatalog } from "./catalogs/new-episodes";
import { TraktClient, TraktRequestError } from "./trakt/client";

const require = createRequire(import.meta.url);
const { addonBuilder } = require("stremio-addon-sdk") as typeof import("stremio-addon-sdk");
const LOG_THROTTLE_MS = 60 * 1000;
const recentErrors = new Map<string, number>();

const logCatalogError = (key: string, message: string, error?: unknown): void => {
  const now = Date.now();
  const lastLoggedAt = recentErrors.get(key) ?? 0;

  if (now - lastLoggedAt < LOG_THROTTLE_MS) {
    return;
  }

  recentErrors.set(key, now);

  if (error) {
    console.error(message, error);
    return;
  }

  console.error(message);
};

export const buildAddonInterface = (traktClient: TraktClient) => {
  const builder = new addonBuilder({
    id: "local.better-watchlist",
    version: "0.1.0",
    name: "Better Watchlist",
    description:
      "Shows watchlist series that already have aired but unwatched episodes. Each Trakt user installs their own configured manifest.",
    resources: [],
    types: ["series"],
    idPrefixes: ["tt", "tmdb:", "tvdb:"],
    behaviorHints: {
      configurable: true,
      configurationRequired: true,
    },
    config: [
      {
        key: "userId",
        type: "text",
        title: "Trakt User ID",
        required: true,
      },
    ],
    catalogs: [
      {
        type: "series",
        id: watchlistEpisodesCatalog.id,
        name: watchlistEpisodesCatalog.name,
        extraSupported: ["search", "skip"],
      },
    ],
  });

  builder.defineCatalogHandler(async (args) => {
    if (args.type !== "series" || args.id !== watchlistEpisodesCatalog.id) {
      return { metas: [] };
    }

    try {
      const userId =
        typeof args.config === "object" &&
        args.config !== null &&
        "userId" in args.config &&
        typeof (args.config as { userId?: unknown }).userId === "string"
          ? (args.config as { userId: string }).userId
          : "";

      if (!userId) {
        return {
          metas: [],
          cacheMaxAge: 30,
        };
      }

      const skip = Number(args.extra?.skip ?? "0");
      return await buildNewEpisodesCatalog(
        traktClient,
        userId,
        args.extra?.search,
        Number.isNaN(skip) ? 0 : skip,
      );
    } catch (error) {
      if (error instanceof TraktRequestError) {
        logCatalogError(
          `catalog:${error.path}:${error.status}`,
          `Catalog handler hit a temporary Trakt error (${error.status}) on ${error.path}.`,
          error,
        );
      } else {
        logCatalogError("catalog:unknown", "Catalog handler failed:", error);
      }

      return {
        metas: [],
        cacheMaxAge: 30,
      };
    }
  });

  return builder.getInterface();
};
