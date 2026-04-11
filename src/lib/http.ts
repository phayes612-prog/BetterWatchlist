import type { IncomingMessage, ServerResponse } from "node:http";

import { config } from "../config";

export const sendJson = (
  res: ServerResponse,
  statusCode: number,
  payload: unknown,
): void => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
};

export const sendText = (res: ServerResponse, statusCode: number, payload: string): void => {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(payload);
};

export const readJsonBody = async <T>(req: IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw) as T;
};

const firstForwardedValue = (value?: string): string | undefined => {
  return value?.split(",")[0]?.trim() || undefined;
};

const parseForwardedHeader = (
  value?: string,
): {
  proto?: string;
  host?: string;
} => {
  const first = firstForwardedValue(value);
  if (!first) {
    return {};
  }

  const parts = first.split(";").map((part) => part.trim());
  const result: { proto?: string; host?: string } = {};

  for (const part of parts) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || !rawValue) {
      continue;
    }

    const key = rawKey.trim().toLowerCase();
    const value = rawValue.trim().replace(/^"|"$/g, "");

    if (key === "proto") {
      result.proto = value;
    }

    if (key === "host") {
      result.host = value;
    }
  }

  return result;
};

export const getRequestBaseUrl = (req: IncomingMessage): string => {
  const forwarded = parseForwardedHeader(
    Array.isArray(req.headers.forwarded) ? req.headers.forwarded[0] : req.headers.forwarded,
  );
  const forwardedProto = firstForwardedValue(
    Array.isArray(req.headers["x-forwarded-proto"])
      ? req.headers["x-forwarded-proto"][0]
      : req.headers["x-forwarded-proto"],
  );
  const forwardedHost = firstForwardedValue(
    Array.isArray(req.headers["x-forwarded-host"])
      ? req.headers["x-forwarded-host"][0]
      : req.headers["x-forwarded-host"],
  );
  const forwardedPort = firstForwardedValue(
    Array.isArray(req.headers["x-forwarded-port"])
      ? req.headers["x-forwarded-port"][0]
      : req.headers["x-forwarded-port"],
  );
  const forwardedSsl = firstForwardedValue(
    Array.isArray(req.headers["x-forwarded-ssl"])
      ? req.headers["x-forwarded-ssl"][0]
      : req.headers["x-forwarded-ssl"],
  );
  const hostHeader = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;

  const protocol =
    forwardedProto || forwarded?.proto || (forwardedSsl === "on" ? "https" : undefined) || "http";

  let host = forwardedHost || forwarded?.host || hostHeader || `127.0.0.1:${config.port}`;

  if (forwardedPort && host && !host.includes(":")) {
    const shouldOmitPort =
      (protocol === "https" && forwardedPort === "443") ||
      (protocol === "http" && forwardedPort === "80");

    if (!shouldOmitPort) {
      host = `${host}:${forwardedPort}`;
    }
  }

  return `${protocol}://${host}`;
};
