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

type RequestOptions = {
  auth?: boolean;
  cacheKey?: string;
  ttlMs?: number;
};

export class TraktClient {
  constructor(
    private readonly authService: TraktAuthService,
    private readonly cache: TTLCache,
    private readonly store: SQLiteStore,
  ) {}

  getWatchlistShows(userId: string): Promise<TraktWatchlistItem[]> {
    return this.request<TraktWatchlistItem[]>(
      "/users/me/watchlist/shows?extended=full",
      userId,
      {
        auth: true,
        cacheKey: `trakt:${userId}:watchlist:shows`,
        ttlMs: config.watchlistCacheTtlMs,
      },
    );
  }

  getWatchedProgress(userId: string, showId: number): Promise<TraktWatchedProgress> {
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

  private async request<T>(path: string, userId: string, options: RequestOptions = {}): Promise<T> {
    const execute = async (): Promise<T> => {
      const credentials = this.store.getTraktAppCredentials();

      if (!credentials) {
        throw new Error("Trakt app is not configured yet. Open /auth/start and add client_id/client_secret.");
      }

      const headers = new Headers({
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": credentials.clientId,
      });

      if (options.auth) {
        headers.set("Authorization", `Bearer ${await this.authService.getValidAccessToken(userId)}`);
      }

      let response = await fetch(`${TRAKT_API_URL}${path}`, {
        method: "GET",
        headers,
      });

      if (response.status === 401 && options.auth) {
        headers.set("Authorization", `Bearer ${await this.authService.forceRefreshAccessToken(userId)}`);
        response = await fetch(`${TRAKT_API_URL}${path}`, {
          method: "GET",
          headers,
        });
      }

      if (!response.ok) {
        const payload = await response.text();
        throw new Error(`Trakt request failed (${response.status}): ${payload}`);
      }

      return (await response.json()) as T;
    };

    if (!options.cacheKey || !options.ttlMs) {
      return execute();
    }

    return this.cache.remember(options.cacheKey, options.ttlMs, execute);
  }
}
