import { Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import {
  FavoritesPage,
  GamePage,
  GamesPage,
  HomePage,
  NotFoundPage,
} from "./pages/lazyPages";

function page(node: ReactNode) {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" aria-busy="true" />}>
      {node}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: page(<HomePage />) },
      { path: "/games", element: page(<GamesPage />) },
      { path: "/games/:id", element: page(<GamePage />) },
      { path: "/categories", element: <Navigate to="/games#categories" replace /> },
      { path: "/favorites", element: page(<FavoritesPage />) },
      { path: "*", element: page(<NotFoundPage />) },
    ],
  },
]);
