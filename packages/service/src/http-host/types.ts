// ---
// relationships:
//   implements: service-assembly
// ---
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Credentials, HttpHostConfiguration } from "../service-configuration/index.ts";
export type HttpListener = (request: IncomingMessage, response: ServerResponse) => void;
export interface HttpHostOptions {
  readonly configuration: HttpHostConfiguration;
  readonly credentials: Credentials;
  readonly onError: (
    error: Error,
    request: { readonly method: string; readonly path: string },
  ) => void;
}
export interface HttpHost {
  mount(pathPrefix: string, listener: HttpListener): void;
  mountOperator(pathPrefix: string, listener: HttpListener): void;
  listen(): Promise<{ readonly host: string; readonly port: number }>;
  address(): { readonly host: string; readonly port: number };
  close(): Promise<void>;
}
