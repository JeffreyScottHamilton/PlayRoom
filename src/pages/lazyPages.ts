import { lazy } from "react";

// Route-level code splitting. Kept out of router.tsx so that file exports only the router.
export const HomePage = lazy(() => import("./HomePage"));
export const GamesPage = lazy(() => import("./GamesPage"));
export const GamePage = lazy(() => import("./GamePage"));
export const FavoritesPage = lazy(() => import("./FavoritesPage"));
export const NotFoundPage = lazy(() => import("./NotFoundPage"));
