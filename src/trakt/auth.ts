import type {
  PendingDeviceCode,
  StoredTraktTokens,
  TraktDeviceCodeResponse,
  TraktTokenResponse,
  TraktUserProfile,
} from "../types";
import { SQLiteStore } from "../db/sqlite-store";

const TRAKT_API_URL = "https://api.trakt.tv";

const parseTokenPayload = (payload: TraktTokenResponse): StoredTraktTokens => ({
  accessToken: payload.access_token,
  refreshToken: payload.refresh_token,
  createdAt: payload.created_at * 1000,
  expiresAt: (payload.created_at + payload.expires_in) * 1000,
  scope: payload.scope,
  tokenType: payload.token_type,
});

export class TraktAuthService {
  constructor(private readonly store: SQLiteStore) {}

  private async getRequiredCredentials(): Promise<{ clientId: string; clientSecret: string }> {
    const credentials = this.store.getTraktAppCredentials();

    if (!credentials) {
      throw new Error("Trakt app is not configured yet. Open /auth/start and add client_id/client_secret.");
    }

    return credentials;
  }

  async getValidAccessToken(userId: string): Promise<string> {
    const user = this.store.getUserTokens(userId);
    const tokens = user?.tokens;

    if (!tokens) {
      throw new Error(`Trakt user ${userId} is not authorized.`);
    }

    const refreshWindowMs = 60 * 1000;
    if (tokens.expiresAt > Date.now() + refreshWindowMs) {
      return tokens.accessToken;
    }

    const refreshed = await this.refreshTokens(userId, tokens.refreshToken, user.username);
    return refreshed.accessToken;
  }

  async forceRefreshAccessToken(userId: string): Promise<string> {
    const user = this.store.getUserTokens(userId);
    const refreshToken = user?.tokens.refreshToken;

    if (!refreshToken) {
      throw new Error(`Trakt refresh token is missing for user ${userId}.`);
    }

    const refreshed = await this.refreshTokens(userId, refreshToken, user.username);
    return refreshed.accessToken;
  }

  async startDeviceFlow(): Promise<PendingDeviceCode & { sessionId: string }> {
    const credentials = await this.getRequiredCredentials();
    const response = await fetch(`${TRAKT_API_URL}/oauth/device/code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: credentials.clientId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start Trakt device flow: ${response.status} ${response.statusText}`);
    }

    const payload = (await response.json()) as TraktDeviceCodeResponse;
    const sessionId = crypto.randomUUID();
    const pendingDeviceCode: PendingDeviceCode & { sessionId: string } = {
      sessionId,
      deviceCode: payload.device_code,
      userCode: payload.user_code,
      verificationUrl: payload.verification_url,
      interval: payload.interval,
      createdAt: Date.now(),
      expiresAt: Date.now() + payload.expires_in * 1000,
    };

    this.store.saveAuthSession(sessionId, pendingDeviceCode);
    return pendingDeviceCode;
  }

  async pollDeviceFlow(sessionId: string): Promise<{
    status: "pending" | "authorized";
    tokens?: StoredTraktTokens;
    userId?: string;
    username?: string;
  }> {
    const credentials = await this.getRequiredCredentials();
    const pending = this.store.getAuthSession(sessionId);

    if (!pending) {
      throw new Error("No Trakt auth session found. Start authorization again.");
    }

    if (pending.expiresAt <= Date.now()) {
      this.store.deleteAuthSession(sessionId);
      throw new Error("Stored device code expired. Open /auth/start again.");
    }

    if (pending.status === "authorized" && pending.userId && pending.username) {
      return {
        status: "authorized",
        userId: pending.userId,
        username: pending.username,
      };
    }

    const response = await fetch(`${TRAKT_API_URL}/oauth/device/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: pending.deviceCode,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
      }),
    });

    if (response.status === 400) {
      const payload = (await response.json()) as { error?: string };

      if (payload.error === "authorization_pending" || payload.error === "slow_down") {
        return { status: "pending" };
      }

      if (payload.error === "expired_token") {
        this.store.deleteAuthSession(sessionId);
        throw new Error("Device code expired. Open /auth/start again.");
      }

      if (payload.error === "access_denied") {
        this.store.deleteAuthSession(sessionId);
        throw new Error("Trakt authorization was denied.");
      }

      throw new Error(`Failed to finish Trakt device flow: ${payload.error ?? "unknown_error"}`);
    }

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Failed to finish Trakt device flow: ${response.status} ${payload}`);
    }

    const payload = (await response.json()) as TraktTokenResponse;
    const tokens = parseTokenPayload(payload);
    const profile = await this.fetchCurrentUser(tokens.accessToken);
    this.store.saveUserTokens(profile.userId, profile.username, tokens);
    this.store.markAuthSessionAuthorized(sessionId, profile.userId, profile.username);

    return {
      status: "authorized",
      tokens,
      userId: profile.userId,
      username: profile.username,
    };
  }

  async getStatus(sessionId: string): Promise<
    | { status: "idle" }
    | {
        status: "pending";
        sessionId: string;
        userCode: string;
        verificationUrl: string;
        expiresAt: number;
      }
    | {
        status: "authorized";
        sessionId: string;
        userId: string;
        username: string;
      }
  > {
    const session = this.store.getAuthSession(sessionId);

    if (!session) {
      return { status: "idle" };
    }

    if (session.expiresAt <= Date.now() && session.status === "pending") {
      this.store.deleteAuthSession(sessionId);
      return { status: "idle" };
    }

    if (session.status === "authorized" && session.userId && session.username) {
      return {
        status: "authorized",
        sessionId,
        userId: session.userId,
        username: session.username,
      };
    }

    return {
      status: "pending",
      sessionId,
      userCode: session.userCode,
      verificationUrl: session.verificationUrl,
      expiresAt: session.expiresAt,
    };
  }

  private async refreshTokens(
    userId: string,
    refreshToken: string,
    username: string,
  ): Promise<StoredTraktTokens> {
    const credentials = await this.getRequiredCredentials();
    const response = await fetch(`${TRAKT_API_URL}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
        client_id: credentials.clientId,
        client_secret: credentials.clientSecret,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      this.store.deleteUserTokens(userId);
      const payload = await response.text();
      throw new Error(`Failed to refresh Trakt token: ${response.status} ${payload}`);
    }

    const payload = (await response.json()) as TraktTokenResponse;
    this.store.saveUserTokens(userId, username, parseTokenPayload(payload));
    return parseTokenPayload(payload);
  }

  private async fetchCurrentUser(accessToken: string): Promise<TraktUserProfile> {
    const credentials = await this.getRequiredCredentials();
    const response = await fetch(`${TRAKT_API_URL}/users/settings`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "trakt-api-version": "2",
        "trakt-api-key": credentials.clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const payload = await response.text();
      throw new Error(`Failed to fetch Trakt user profile: ${response.status} ${payload}`);
    }

    const payload = (await response.json()) as {
      user?: {
        username?: string;
        ids?: {
          slug?: string;
          trakt?: number;
        };
      };
      username?: string;
      ids?: {
        slug?: string;
        trakt?: number;
      };
    };

    const user = payload.user ?? payload;
    const userId = user.ids?.slug ?? (user.ids?.trakt ? String(user.ids.trakt) : undefined) ?? user.username;
    const username = user.username ?? userId;

    if (!userId || !username) {
      throw new Error("Trakt user profile is missing a stable identifier.");
    }

    return { userId, username };
  }
}
