declare module "fs" {
  export function readFileSync(path: string, encoding: string): string;
}

declare module "url" {
  export function fileURLToPath(url: string | URL): string;
}

declare module "path" {
  export function dirname(path: string): string;
  export function join(...paths: string[]): string;
}

declare const process: {
  env: Record<string, string | undefined>;
  exit(code?: number): never;
};

interface ImportMeta {
  url: string;
}
