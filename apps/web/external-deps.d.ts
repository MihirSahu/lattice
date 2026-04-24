declare module "@tanstack/react-query" {
  import type { ReactNode } from "react";

  export class QueryClient {
    constructor(options?: unknown);
    setQueryData(...args: unknown[]): void;
    invalidateQueries(...args: unknown[]): Promise<void>;
    removeQueries(...args: unknown[]): void;
  }

  export function QueryClientProvider(props: { client: QueryClient; children: ReactNode }): ReactNode;
  export function useQueryClient(): QueryClient;
  export function useQuery<TData = unknown>(options: unknown): {
    data: TData | undefined;
    error: unknown;
    isLoading: boolean;
    isError: boolean;
  };
  export function useMutation<TData = unknown, TError = Error, TVariables = void>(options: unknown): {
    mutate: (
      variables: TVariables,
      handlers?: {
        onSuccess?: (data: TData) => void;
        onError?: (error: TError) => void;
      }
    ) => void;
    isPending: boolean;
  };
}

declare module "better-sqlite3" {
  class Database {
    constructor(filename: string);
    exec(sql: string): this;
    pragma(value: string): unknown;
    transaction<T extends (...args: any[]) => any>(fn: T): T;
  }

  namespace Database {
    export interface Database {
      exec(sql: string): this;
      pragma(value: string): unknown;
      transaction<T extends (...args: any[]) => any>(fn: T): T;
    }
  }

  export default Database;
}

declare module "drizzle-orm" {
  export function and(...args: unknown[]): unknown;
  export function asc(value: unknown): unknown;
  export function desc(value: unknown): unknown;
  export function eq(left: unknown, right: unknown): unknown;
  export const sql: any;
}

declare module "drizzle-orm/better-sqlite3" {
  export type BetterSQLite3Database<TSchema = unknown> = any;
  export function drizzle(sqlite: unknown, options?: unknown): any;
}

declare module "drizzle-orm/sqlite-core" {
  export function sqliteTable(name: string, columns: unknown, extras?: unknown): any;
  export function text(name: string): any;
  export function index(name: string): any;
}

declare module "drizzle-kit" {
  export function defineConfig(config: unknown): unknown;
}
