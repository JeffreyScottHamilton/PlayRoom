// Type declarations for vite-library-scope.mjs, so vite.config.ts type-checks under tsc -b.

export interface ManifestLicense {
  type: string;
  source?: string;
}

export interface ManifestEntry {
  id?: string;
  license?: ManifestLicense;
  [key: string]: unknown;
}

export type LibraryScope = "all" | "open";

export function isOwnerAssertedEntry(game: ManifestEntry | null | undefined): boolean;

export function filterManifestByScope<T extends ManifestEntry>(games: readonly T[], scope: LibraryScope): T[];

export function isManifestId(id: string): boolean;

export interface LibraryScopePlugin {
  name: string;
  enforce: "pre";
  transform(code: string, id: string): { code: string; map: null } | null;
}

export function libraryScopePlugin(options: { scope: LibraryScope }): LibraryScopePlugin;
