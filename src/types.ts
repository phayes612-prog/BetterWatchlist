export type ActivityType = "watched" | "new_episode" | "watchlist_added";

export type TraktIds = {
  trakt: number;
  slug?: string;
  imdb?: string | null;
  tmdb?: number | null;
  tvdb?: number | null;
};

export type TraktShow = {
  title: string;
  year?: number | null;
  overview?: string | null;
  status?: string | null;
  genres?: string[];
  rating?: number | null;
  runtime?: number | null;
  country?: string | null;
  language?: string | null;
  aired_episodes?: number | null;
  first_aired?: string | null;
  ids: TraktIds;
};

export type TraktWatchlistItem = {
  listed_at: string;
  show: TraktShow;
};

export type TraktProgressEpisode = {
  number: number;
  completed: boolean;
  last_watched_at?: string | null;
};

export type TraktProgressSeason = {
  number: number;
  aired: number;
  completed: number;
  episodes: TraktProgressEpisode[];
};

export type TraktWatchedProgress = {
  aired: number;
  completed: number;
  last_watched_at?: string | null;
  reset_at?: string | null;
  seasons: TraktProgressSeason[];
};

export type TraktSeasonEpisode = {
  season: number;
  number: number;
  title?: string | null;
  first_aired?: string | null;
};

export type TraktSeason = {
  number: number;
  episodes: TraktSeasonEpisode[];
};

export type TraktDeviceCodeResponse = {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
};

export type TraktTokenResponse = {
  access_token: string;
  refresh_token: string;
  created_at: number;
  expires_in: number;
  scope: string;
  token_type: string;
};

export type StoredTraktTokens = {
  accessToken: string;
  refreshToken: string;
  createdAt: number;
  expiresAt: number;
  scope: string;
  tokenType: string;
};

export type PendingDeviceCode = {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  interval: number;
  expiresAt: number;
  createdAt: number;
};

export type TraktUserProfile = {
  userId: string;
  username: string;
};

export type WatchlistShowActivity = {
  stremioId: string;
  traktId: number;
  title: string;
  year?: number | null;
  overview?: string | null;
  genres: string[];
  imdbRating?: string;
  releaseInfo?: string;
  runtime?: string;
  poster: string;
  background?: string;
  lastWatchedAt?: string | null;
  latestNewEpisodeAt?: string | null;
  latestUnwatchedAirDate?: string | null;
  watchlistAddedAt: string;
  unwatchedAiredCount: number;
  activityType: ActivityType;
  activityAt: string;
};
