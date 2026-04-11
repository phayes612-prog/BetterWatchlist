declare module "stremio-addon-sdk" {
  export class addonBuilder {
    constructor(manifest: unknown);
    defineCatalogHandler(
      handler: (args: {
        type: string;
        id: string;
        extra?: Record<string, string>;
        config?: unknown;
      }) => Promise<unknown> | unknown,
    ): this;
    getInterface(): {
      manifest: unknown;
      get: (
        resource: string,
        type: string,
        id: string,
        extra?: Record<string, string>,
        config?: unknown,
      ) => Promise<unknown>;
    };
  }

  export function getRouter(addonInterface: unknown): (
    req: import("node:http").IncomingMessage,
    res: import("node:http").ServerResponse,
    next?: () => void,
  ) => void;
}
