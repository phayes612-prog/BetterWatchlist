import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { Database } from "bun:sqlite";

import { config } from "../config";
import type { PendingDeviceCode, StoredTraktTokens } from "../types";

type AuthSessionStatus = "pending" | "authorized";

export type AuthSessionRecord = {
  sessionId: string;
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  interval: number;
  createdAt: number;
  expiresAt: number;
  status: AuthSessionStatus;
  userId?: string | null;
  username?: string | null;
};

export type TraktUserRecord = {
  userId: string;
  username: string;
  tokens: StoredTraktTokens;
};

export class SQLiteStore {
  private readonly db: Database;

  constructor() {
    mkdirSync(dirname(config.databaseFile), { recursive: true });
    this.db = new Database(config.databaseFile, { create: true });
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS auth_sessions (
        session_id TEXT PRIMARY KEY,
        device_code TEXT NOT NULL,
        user_code TEXT NOT NULL,
        verification_url TEXT NOT NULL,
        interval_seconds INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        status TEXT NOT NULL,
        user_id TEXT,
        username TEXT
      );

      CREATE TABLE IF NOT EXISTS trakt_users (
        user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        scope TEXT NOT NULL,
        token_type TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  getTraktAppCredentials(): { clientId: string; clientSecret: string } | null {
    if (config.traktClientId && config.traktClientSecret) {
      return {
        clientId: config.traktClientId,
        clientSecret: config.traktClientSecret,
      };
    }

    const rows = this.db
      .query("SELECT key, value FROM app_config WHERE key IN ('trakt_client_id', 'trakt_client_secret')")
      .all() as Array<{ key: string; value: string }>;

    const map = new Map(rows.map((row) => [row.key, row.value]));
    const clientId = map.get("trakt_client_id");
    const clientSecret = map.get("trakt_client_secret");

    if (!clientId || !clientSecret) {
      return null;
    }

    return { clientId, clientSecret };
  }

  hasTraktAppCredentials(): boolean {
    return Boolean(this.getTraktAppCredentials());
  }

  saveTraktAppCredentials(clientId: string, clientSecret: string): void {
    const upsert = this.db.query("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)");
    upsert.run("trakt_client_id", clientId.trim());
    upsert.run("trakt_client_secret", clientSecret.trim());
  }

  saveAuthSession(sessionId: string, pending: PendingDeviceCode): void {
    this.db
      .query(`
        INSERT OR REPLACE INTO auth_sessions (
          session_id, device_code, user_code, verification_url, interval_seconds,
          created_at, expires_at, status, user_id, username
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NULL, NULL)
      `)
      .run(
        sessionId,
        pending.deviceCode,
        pending.userCode,
        pending.verificationUrl,
        pending.interval,
        pending.createdAt,
        pending.expiresAt,
      );
  }

  getAuthSession(sessionId: string): AuthSessionRecord | null {
    const row = this.db
      .query(`
        SELECT session_id, device_code, user_code, verification_url, interval_seconds,
               created_at, expires_at, status, user_id, username
        FROM auth_sessions
        WHERE session_id = ?
      `)
      .get(sessionId) as
      | {
          session_id: string;
          device_code: string;
          user_code: string;
          verification_url: string;
          interval_seconds: number;
          created_at: number;
          expires_at: number;
          status: AuthSessionStatus;
          user_id?: string | null;
          username?: string | null;
        }
      | null;

    if (!row) {
      return null;
    }

    return {
      sessionId: row.session_id,
      deviceCode: row.device_code,
      userCode: row.user_code,
      verificationUrl: row.verification_url,
      interval: row.interval_seconds,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      status: row.status,
      userId: row.user_id ?? null,
      username: row.username ?? null,
    };
  }

  markAuthSessionAuthorized(sessionId: string, userId: string, username: string): void {
    this.db
      .query(`
        UPDATE auth_sessions
        SET status = 'authorized', user_id = ?, username = ?
        WHERE session_id = ?
      `)
      .run(userId, username, sessionId);
  }

  deleteAuthSession(sessionId: string): void {
    this.db.query("DELETE FROM auth_sessions WHERE session_id = ?").run(sessionId);
  }

  saveUserTokens(userId: string, username: string, tokens: StoredTraktTokens): void {
    this.db
      .query(`
        INSERT INTO trakt_users (
          user_id, username, access_token, refresh_token,
          created_at, expires_at, scope, token_type, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          username = excluded.username,
          access_token = excluded.access_token,
          refresh_token = excluded.refresh_token,
          created_at = excluded.created_at,
          expires_at = excluded.expires_at,
          scope = excluded.scope,
          token_type = excluded.token_type,
          updated_at = excluded.updated_at
      `)
      .run(
        userId,
        username,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.createdAt,
        tokens.expiresAt,
        tokens.scope,
        tokens.tokenType,
        Date.now(),
      );
  }

  getUserTokens(userId: string): TraktUserRecord | null {
    const row = this.db
      .query(`
        SELECT user_id, username, access_token, refresh_token,
               created_at, expires_at, scope, token_type
        FROM trakt_users
        WHERE user_id = ?
      `)
      .get(userId) as
      | {
          user_id: string;
          username: string;
          access_token: string;
          refresh_token: string;
          created_at: number;
          expires_at: number;
          scope: string;
          token_type: string;
        }
      | null;

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      username: row.username,
      tokens: {
        accessToken: row.access_token,
        refreshToken: row.refresh_token,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        scope: row.scope,
        tokenType: row.token_type,
      },
    };
  }

  deleteUserTokens(userId: string): void {
    this.db.query("DELETE FROM trakt_users WHERE user_id = ?").run(userId);
  }
}
