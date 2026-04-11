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

export const getRequestBaseUrl = (req: IncomingMessage): string => {
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
  const hostHeader = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;

  const protocol = forwardedProto || "http";
  const host = forwardedHost || hostHeader || `127.0.0.1:${config.port}`;

  return `${protocol}://${host}`;
};
