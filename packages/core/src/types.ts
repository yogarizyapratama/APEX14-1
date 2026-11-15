import type { ApexRequestContext } from "@apex14/http";
import type { HttpMethod } from "@apex14/router";

export type Middleware = (
  ctx: ApexRequestContext,
  next: () => Promise<any>
) => any | Promise<any>;

export type Handler<TReturn = any> = (
  ctx: ApexRequestContext
) => TReturn | Promise<TReturn>;

export type MethodMap = {
  [K in HttpMethod]?: Handler;
};

export interface RouteOptions {
  summary?: string;
  description?: string;
  tags?: string[];
  guard?: string | string[];
  middleware?: Middleware[];
  body?: any;
  query?: any;
  params?: any;
  response?: any;
  aiTool?: boolean;
  [key: string]: any;
}

export interface ApexWebSocket {
  id: string;
  params: Record<string, string>;
  data: Record<string, any>;
  send(message: string | Uint8Array): void;
  close(code?: number, reason?: string): void;
  join(room: string): void;
  leave(room: string): void;
  publish(room: string, message: string | Uint8Array): void;
}

export interface WebSocketHandlers {
  open?: (ws: ApexWebSocket) => void | Promise<void>;
  message?: (ws: ApexWebSocket, message: any) => void | Promise<void>;
  close?: (ws: ApexWebSocket, code: number, reason: string) => void | Promise<void>;
  error?: (ws: ApexWebSocket, error: Error) => void | Promise<void>;
}

export interface TaskOptions {
  concurrency?: number;
  retries?: number;
  retryDelayMs?: number;
}

export interface TaskDispatcher<TData = any, TResult = any> {
  name: string;
  dispatch(data: TData): void;
  runNow(data: TData): Promise<TResult>;
}

export interface ScheduleOptions {
  name?: string;
  cron?: string;
  interval?: string | number;
}

export interface ScheduledJob {
  name: string;
  pattern: string;
  stop: () => void;
}

export type Guard = (ctx: ApexRequestContext) => boolean | Promise<boolean> | void | Promise<void>;

export interface SecurityConfig {
  jwt?: {
    secret: string;
    expiresIn?: string | number;
    issuer?: string;
    audience?: string;
    algorithms?: string[];
  };
  cors?: {
    origin?: string | string[] | boolean | ((origin: string) => boolean);
    methods?: string[];
    allowedHeaders?: string[];
    exposedHeaders?: string[];
    credentials?: boolean;
    maxAge?: number;
  };
  rateLimit?: {
    max: number;
    windowMs: number;
    keyGenerator?: (ctx: ApexRequestContext) => string;
  };
  headers?: Record<string, string>;
  [key: string]: any;
}
