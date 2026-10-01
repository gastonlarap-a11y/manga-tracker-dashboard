import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Layout } from "./components/Layout";
import { DuplicatesView } from "./views/DuplicatesView";
import { LibraryView } from "./views/LibraryView";
import { MangaDetailView } from "./views/MangaDetailView";

/**
 * A data router, not <BrowserRouter>: `viewTransition` on a link — what morphs
 * a cover from the grid into its page — and `<ScrollRestoration>` exist only in
 * this mode. RouterProvider comes from react-router/dom because that is the one
 * that provides the view-transition context.
 */
const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <LibraryView /> },
      { path: "manga/:id", element: <MangaDetailView /> },
      { path: "duplicates", element: <DuplicatesView /> },
      {
        path: "*",
        element: <p className="status">Página no encontrada.</p>,
      },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
