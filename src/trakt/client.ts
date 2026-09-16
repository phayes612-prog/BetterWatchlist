import { config } from "../config";
import { SQLiteStore } from "../db/sqlite-store";
import { TTLCache } from "../lib/cache";
import type {
  TraktSeason,
  TraktWatchlistItem,
  TraktWatchedProgress,
} from "../types";
import { TraktAuthService } from "./auth";

const TRAKT_API_URL = "https://api.trakt.tv";
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const RETRY_DELAYS_MS = [350, 900];

type RequestOptions = {
  auth?: boolean;
  cacheKey?: string;
  ttlMs?: number;
};

export class TraktRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
    readonly payload: string,
  ) {
    super(message);
    this.name = "TraktRequestError";
  }

  get isRetryable(): boolean {
    return RETRYABLE_STATUS_CODES.has(this.status);
  }
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class TraktClient {
  constructor(
    private readonly authService: TraktAuthService,
    private readonly cache: TTLCache,
    private readonly store: SQLiteStore,
  ) {}

  getWatchlistShows(userId: string): Promise<TraktWatchlistItem[]> {
    return this.request<TraktWatchlistItem[]>(
      "/users/me/lists/00%20-%20TV%20Shows/items/shows?extended=full",
      userId,
      {
        auth: true,
        cacheKey: `trakt:${userId}:list:00-tv-shows`,
        ttlMs: config.watchlistCacheTtlMs,
      },
    );
  }

  getWatchedProgress(
    userId: string,
    showId: number,
  ): Promise<TraktWatchedProgress> {
    return this.request<TraktWatchedProgress>(
      `/shows/${showId}/progress/watched?hidden=false&specials=false&count_specials=false`,
      userId,
      {
        auth: true,
        cacheKey: `trakt:${userId}:progress:${showId}`,
        ttlMs: config.progressCacheTtlMs,
      },
    );
  }

  getShowSeasons(userId: string, showId: number): Promise<TraktSeason[]> {
    return this.request<TraktSeason[]>(
      `/shows/${showId}/seasons?extended=episodes,full`,
      userId,
      {
        auth: true,
        cacheKey: `trakt:${userId}:seasons:${showId}`,
        ttlMs: config.progressCacheTtlMs,
      },
    );
  }

  clearShowCache(userId: string, showId: number): void {
    this.cache.clear(`trakt:${userId}:progress:${showId}`);
    this.cache.clear(`trakt:${userId}:seasons:${showId}`);
  }

  private async request<T>(
    path: string,
    userId: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const execute = async (): Promise<T> => {
      const credentials = this.store.getTraktAppCredentials();

      if (!credentials) {
        throw new Error(
          "Trakt app is not configured yet. Open /auth/start and add client_id/client_secret.",
        );
      }

      const headers = new Headers({
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": credentials.clientId,
      });

      if (options.auth) {
        headers.set(
          "Authorization",
          `Bearer ${await this.authService.getValidAccessToken(userId)}`,
        );
      }

      let response = await fetch(`${TRAKT_API_URL}${path}`, {
        method: "GET",
        headers,
      });

      if (response.status === 401 && options.auth) {
        headers.set(
          "Authorization",
          `Bearer ${await this.authService.forceRefreshAccessToken(userId)}`,
        );

        response = await fetch(`${TRAKT_API_URL}${path}`, {
          method: "GET",
          headers,
        });
      }

      if (!response.ok) {
        const payload = await response.text();

        throw new TraktRequestError(
          `Trakt request failed (${response.status}): ${payload}`,
          response.status,
          path,
          payload,
        );
      }

      return (await response.json()) as T;
    };

    const executeWithRetry = async (): Promise<T> => {
      for (
        let attempt = 0;
        attempt <= RETRY_DELAYS_MS.length;
        attempt += 1
      ) {
        try {
          return await execute();
        } catch (error) {
          const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
          const isRetryable =
            error instanceof TraktRequestError
              ? error.isRetryable
              : error instanceof Error;

          if (isLastAttempt || !isRetryable) {
            throw error;
          }

          await sleep(RETRY_DELAYS_MS[attempt]);
        }
      }

      throw new Error("Unreachable retry state");
    };

    if (!options.cacheKey || !options.ttlMs) {
      return executeWithRetry();
    }

    const staleValue = this.cache.peek<T>(options.cacheKey);

    try {
      return await this.cache.remember(
        options.cacheKey,
        options.ttlMs,
        executeWithRetry,
      );
    } catch (error) {
      const isRecoverableFailure =
        error instanceof TraktRequestError
          ? error.isRetryable
          : error instanceof Error;

      if (staleValue && isRecoverableFailure) {
        return staleValue;
      }

      throw error;
    }
  }
}
