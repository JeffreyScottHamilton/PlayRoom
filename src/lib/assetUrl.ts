/**
 * Maps a BASE_URL such as "/" or "/PlayRoom/" to the prefix used for root-relative
 * asset paths: "" or "/PlayRoom" (no trailing slash).
 */
export function baseFromBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/**
 * Prefixes a root-relative path ("/games/x/thumb.webp") with the build base.
 * Absolute and protocol-relative URLs, and relative paths, are returned unchanged.
 */
export function withBase(baseUrl: string, path: string): string {
  if (!path.startsWith("/") || path.startsWith("//")) return path;
  return `${baseFromBaseUrl(baseUrl)}${path}`;
}

/** Use for every manifest asset (thumbnail, gameFile) and the Ruffle runtime URLs. */
export function assetUrl(path: string): string {
  return withBase(import.meta.env.BASE_URL, path);
}
