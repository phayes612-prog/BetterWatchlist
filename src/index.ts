import { createServer } from "node:http";
import { createRequire } from "node:module";

import { config, validateConfig } from "./config";
import { SQLiteStore } from "./db/sqlite-store";
import { getRequestBaseUrl, readJsonBody, sendJson, sendText } from "./lib/http";
import { buildAddonInterface } from "./stremio";
import { renderAuthPage } from "./ui/auth-page";
import { TraktAuthService } from "./trakt/auth";
import { TraktClient } from "./trakt/client";
import { TTLCache } from "./lib/cache";

const require = createRequire(import.meta.url);
const { getRouter } = require("stremio-addon-sdk") as typeof import("stremio-addon-sdk");

validateConfig();

const cache = new TTLCache();
const store = new SQLiteStore();
const authService = new TraktAuthService(store);
const traktClient = new TraktClient(authService, cache, store);
const addonInterface = buildAddonInterface(traktClient);
const addonRouter = getRouter(addonInterface);

const getPublicUrls = (baseUrl: string) => ({
  manifest: `${baseUrl}/manifest.json`,
  configure: `${baseUrl}/configure`,
  authPoll: `${baseUrl}/api/auth/poll`,
  authStatus: `${baseUrl}/api/auth/status`,
});

const buildUserManifestUrl = (baseUrl: string, userId: string): string =>
  `${baseUrl}/u/${encodeURIComponent(userId)}/manifest.json`;

const maybeRewriteUserScopedAddonRequest = (requestUrl: URL): string | null => {
  const match = requestUrl.pathname.match(/^\/u\/([^/]+)(\/.*)$/);
  if (!match) {
    return null;
  }

  const userId = decodeURIComponent(match[1]);
  const suffix = match[2];
  const configPrefix = encodeURIComponent(JSON.stringify({ userId }));

  return `/${configPrefix}${suffix}${requestUrl.search}`;
};

const server = createServer(async (req, res) => {
  try {
    const baseUrl = getRequestBaseUrl(req);
    const publicUrls = getPublicUrls(baseUrl);
    const requestUrl = new URL(req.url ?? "/", baseUrl);

    if (requestUrl.pathname === "/") {
      return sendJson(res, 200, {
        name: "Better Watchlist",
        manifestUrl: publicUrls.manifest,
        configureUrl: publicUrls.configure,
        nextSteps: [
          "Open /configure and connect a Trakt account.",
          "Use the returned /u/<userId>/manifest.json URL to install the addon in Stremio.",
        ],
        urls: publicUrls,
      });
    }

    if (requestUrl.pathname === "/auth/start" || requestUrl.pathname === "/configure") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(renderAuthPage({ baseUrl }));
      return;
    }

    if (requestUrl.pathname === "/health") {
      return sendJson(res, 200, { ok: true });
    }

    if (requestUrl.pathname === "/api/auth/status") {
      const sessionId = requestUrl.searchParams.get("sessionId") ?? "";
      if (!sessionId) {
        return sendJson(res, 200, { status: "idle" });
      }

      const authStatus = await authService.getStatus(sessionId);
      if (authStatus.status === "authorized") {
        return sendJson(res, 200, {
          ...authStatus,
          manifestUrl: buildUserManifestUrl(baseUrl, authStatus.userId),
        });
      }

      return sendJson(res, 200, authStatus);
    }

    if (requestUrl.pathname === "/api/setup/status") {
      return sendJson(res, 200, {
        traktAppConfigured: store.hasTraktAppCredentials(),
      });
    }

    if (requestUrl.pathname === "/api/setup/trakt-app" && req.method === "POST") {
      const body = await readJsonBody<{ clientId?: string; clientSecret?: string }>(req);
      const clientId = body.clientId?.trim() ?? "";
      const clientSecret = body.clientSecret?.trim() ?? "";

      if (!clientId || !clientSecret) {
        return sendJson(res, 400, {
          error: "clientId and clientSecret are required.",
        });
      }

      store.saveTraktAppCredentials(clientId, clientSecret);
      return sendJson(res, 200, {
        ok: true,
      });
    }

    if (requestUrl.pathname === "/api/auth/start") {
      const pending = await authService.startDeviceFlow();
      return sendJson(res, 200, {
        session_id: pending.sessionId,
        message: "Open verification_url, enter user_code, then poll /api/auth/poll with sessionId.",
        verification_url: pending.verificationUrl,
        user_code: pending.userCode,
        interval_seconds: pending.interval,
        expires_at: new Date(pending.expiresAt).toISOString(),
        poll_url: `${publicUrls.authPoll}?sessionId=${encodeURIComponent(pending.sessionId)}`,
      });
    }

    if (requestUrl.pathname === "/api/auth/poll") {
      const sessionId = requestUrl.searchParams.get("sessionId") ?? "";
      if (!sessionId) {
        return sendJson(res, 400, { error: "sessionId is required." });
      }

      const result = await authService.pollDeviceFlow(sessionId);
      if (result.status === "authorized" && result.userId) {
        return sendJson(res, 200, {
          ...result,
          manifestUrl: buildUserManifestUrl(baseUrl, result.userId),
        });
      }

      return sendJson(res, 200, result);
    }

    const originalUrl = req.url ?? "/";
    const rewrittenAddonUrl = maybeRewriteUserScopedAddonRequest(requestUrl);
    if (rewrittenAddonUrl) {
      req.url = rewrittenAddonUrl;
      addonRouter(req, res, () => {
        sendText(res, 404, "Not found");
      });
      req.url = originalUrl;
      return;
    }

    addonRouter(req, res, () => {
      sendText(res, 404, "Not found");
    });
  } catch (error) {
    console.error("HTTP request failed:", error);
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

server.listen(config.port, () => {
  console.log(`Better Watchlist listening on http://127.0.0.1:${config.port}`);
  console.log(`Configure page: http://127.0.0.1:${config.port}/configure`);
});
