import { config } from "../config";
import { mapWithConcurrency } from "../lib/async";
import type {
  ActivityType,
  TraktSeason,
  TraktShow,
  TraktWatchlistItem,
  TraktWatchedProgress,
  WatchlistShowActivity,
} from "../types";
import { TraktClient, TraktRequestError } from "../trakt/client";

const CATALOG_ID = "trakt-watchlist-new-episodes";
const CATALOG_NAME = "BetterWatchlist";
const PAGE_SIZE = 100;
const LOG_THROTTLE_MS = 60 * 1000;
const recentWarnings = new Map<string, number>();

const toTimestamp = (value?: string | null): number => {
  if (!value) {
    return 0;
  }
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
};

const pickStremioId = (show: TraktShow): string | null => {
  if (show.ids.imdb) {
    return show.ids.imdb;
  }
  if (show.ids.tmdb) {
    return `tmdb:${show.ids.tmdb}`;
  }
  if (show.ids.tvdb) {
    return `tvdb:${show.ids.tvdb}`;
  }
  return null;
};

const buildPosterUrl = (stremioId: string): string =>
  `https://images.metahub.space/poster/medium/${encodeURIComponent(stremioId)}/img`;

const buildBackgroundUrl = (stremioId: string): string =>
  `https://images.metahub.space/background/medium/${encodeURIComponent(stremioId)}/img`;

const buildReleaseInfo = (show: TraktShow): string | undefined => {
  if (!show.year) {
    return undefined;
  }
  return show.status === "returning series" ? `${show.year}-` : String(show.year);
};

const buildRuntime = (runtime?: number | null): string | undefined => {
  return runtime ? `${runtime}m` : undefined;
};

const formatActivityDescription = (item: WatchlistShowActivity): string => {
  const lines = [
    `${item.unwatchedAiredCount} aired episode(s) still unwatched.`,
    `Activity: ${item.activityType} at ${item.activityAt}.`,
  ];

  if (item.lastWatchedAt) {
    lines.push(`Last watched: ${item.lastWatchedAt}.`);
  }
  if (item.latestNewEpisodeAt) {
    lines.push(`Latest new episode: ${item.latestNewEpisodeAt}.`);
  }

  return lines.join(" ");
};

const buildCompletedEpisodeSet = (progress: TraktWatchedProgress): Set<string> => {
  const completed = new Set<string>();

  for (const season of progress.seasons ?? []) {
    if (season.number === 0) {
      continue;
    }

    for (const episode of season.episodes ?? []) {
      if (episode.completed) {
        completed.add(`${season.number}:${episode.number}`);
      }
    }
  }

  return completed;
};

const getLatestUnwatchedAiredDate = (
  seasons: TraktSeason[],
  completedEpisodes: Set<string>,
  now: number,
): { count: number; latestAirDate?: string } => {
  let count = 0;
  let latestAirDate: string | undefined;
  let latestTimestamp = 0;

  for (const season of seasons ?? []) {
    // Ignore specials (season 0), otherwise already watched shows often look "unfinished".
    if (season.number === 0) {
      continue;
    }

    for (const episode of season.episodes ?? []) {
      const key = `${season.number}:${episode.number}`;
      const airedAt = episode.first_aired;
      const airedTimestamp = toTimestamp(airedAt);

      if (!airedAt || airedTimestamp === 0 || airedTimestamp > now) {
        continue;
      }

      if (completedEpisodes.has(key)) {
        continue;
      }

      count += 1;
      if (airedTimestamp > latestTimestamp) {
        latestTimestamp = airedTimestamp;
        latestAirDate = airedAt;
      }
    }
  }

  return { count, latestAirDate };
};

const computeActivity = (
  lastWatchedAt: string | null | undefined,
  latestNewEpisodeAt: string | null | undefined,
  watchlistAddedAt: string,
): { activityType: ActivityType; activityAt: string } => {
  if (lastWatchedAt && latestNewEpisodeAt && toTimestamp(latestNewEpisodeAt) > toTimestamp(lastWatchedAt)) {
    return {
      activityType: "new_episode",
      activityAt: latestNewEpisodeAt,
    };
  }

  if (lastWatchedAt) {
    return {
      activityType: "watched",
      activityAt: lastWatchedAt,
    };
  }

  return {
    activityType: "watchlist_added",
    activityAt: watchlistAddedAt,
  };
};

const logCatalogWarning = (key: string, message: string, error?: unknown): void => {
  const now = Date.now();
  const lastLoggedAt = recentWarnings.get(key) ?? 0;

  if (now - lastLoggedAt < LOG_THROTTLE_MS) {
    return;
  }

  recentWarnings.set(key, now);

  if (error) {
    console.warn(message, error);
    return;
  }

  console.warn(message);
};

const buildShowActivity = async (
  watchlistItem: TraktWatchlistItem,
  traktClient: TraktClient,
  userId: string,
  now: number,
): Promise<WatchlistShowActivity | null> => {
  const show = watchlistItem.show;
  const stremioId = pickStremioId(show);

  if (!stremioId) {
    return null;
  }

  let progress: TraktWatchedProgress;
  let seasons: TraktSeason[];

  try {
    [progress, seasons] = await Promise.all([
      traktClient.getWatchedProgress(userId, show.ids.trakt),
      traktClient.getShowSeasons(userId, show.ids.trakt),
    ]);
  } catch (error) {
    const key = error instanceof TraktRequestError ? `${error.path}:${error.status}` : `show:${show.ids.trakt}`;
    logCatalogWarning(
      key,
      `Skipping "${show.title}" because Trakt returned a temporary error while building the catalog.`,
      error,
    );
    return null;
  }

  const completedEpisodes = buildCompletedEpisodeSet(progress);
  const { count: unwatchedAiredCount, latestAirDate } = getLatestUnwatchedAiredDate(
    seasons,
    completedEpisodes,
    now,
  );

  if (unwatchedAiredCount < 1) {
    return null;
  }

  const lastWatchedAt = progress.last_watched_at ?? null;
  const latestNewEpisodeAt = latestAirDate ?? null;
  const watchlistAddedAt = watchlistItem.listed_at;
  const { activityType, activityAt } = computeActivity(
    lastWatchedAt,
    latestNewEpisodeAt,
    watchlistAddedAt,
  );

  return {
    stremioId,
    traktId: show.ids.trakt,
    title: show.title,
    year: show.year,
    overview: show.overview,
    genres: show.genres ?? [],
    imdbRating: show.rating ? show.rating.toFixed(1) : undefined,
    releaseInfo: buildReleaseInfo(show),
    runtime: buildRuntime(show.runtime),
    poster: buildPosterUrl(stremioId),
    background: buildBackgroundUrl(stremioId),
    lastWatchedAt,
    latestNewEpisodeAt,
    latestUnwatchedAirDate: latestNewEpisodeAt,
    watchlistAddedAt,
    unwatchedAiredCount,
    activityType,
    activityAt,
  };
};

const sortActivities = (items: WatchlistShowActivity[]): WatchlistShowActivity[] =>
  items.sort((left, right) => {
    const activityDelta = toTimestamp(right.activityAt) - toTimestamp(left.activityAt);
    if (activityDelta !== 0) {
      return activityDelta;
    }

    const unwatchedDelta = right.unwatchedAiredCount - left.unwatchedAiredCount;
    if (unwatchedDelta !== 0) {
      return unwatchedDelta;
    }

    const watchlistDelta = toTimestamp(right.watchlistAddedAt) - toTimestamp(left.watchlistAddedAt);
    if (watchlistDelta !== 0) {
      return watchlistDelta;
    }

    return left.title.localeCompare(right.title);
  });

export const watchlistEpisodesCatalog = {
  id: CATALOG_ID,
  name: CATALOG_NAME,
};

export const buildNewEpisodesCatalog = async (
  traktClient: TraktClient,
  userId: string,
  search?: string,
  skip = 0,
): Promise<{ metas: Array<Record<string, unknown>>; cacheMaxAge: number }> => {
  let watchlistItems: TraktWatchlistItem[];

  try {
    watchlistItems = await traktClient.getWatchlistShows(userId);
  } catch (error) {
    if (error instanceof TraktRequestError) {
      logCatalogWarning(
        `watchlist:${error.status}`,
        "Trakt watchlist endpoint is temporarily failing. Returning an empty catalog for now.",
        error,
      );
      return {
        metas: [],
        cacheMaxAge: 30,
      };
    }

    throw error;
  }

  const now = Date.now();

  const activities = await mapWithConcurrency(watchlistItems, 4, async (watchlistItem) =>
    buildShowActivity(watchlistItem, traktClient, userId, now),
  );

  const filtered = activities.filter((item): item is WatchlistShowActivity => Boolean(item));
  const searched = search
    ? filtered.filter((item) =>
        item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
      )
    : filtered;

  const sorted = sortActivities(searched);
  const paged = sorted.slice(skip, skip + PAGE_SIZE);

  return {
    metas: paged.map((item) => ({
      id: item.stremioId,
      type: "series",
      name: item.title,
      poster: item.poster,
      posterShape: "poster",
      background: item.background,
      description: formatActivityDescription(item),
      genres: item.genres,
      imdbRating: item.imdbRating,
      releaseInfo: item.releaseInfo,
      runtime: item.runtime,
    })),
    cacheMaxAge: config.catalogCacheMaxAgeSec,
  };
};
