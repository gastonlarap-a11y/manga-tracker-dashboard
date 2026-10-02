import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { Layout } from "./components/Layout";
import { DuplicatesView } from "./views/DuplicatesView";
import { ExtensionView } from "./views/ExtensionView";
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
    element: <Layout library={<LibraryView />} />,
    children: [
      // The library is rendered by Layout itself, which keeps it alive while
      // another page is shown; the route only has to exist.
      { index: true, element: null },
      { path: "manga/:id", element: <MangaDetailView /> },
      { path: "duplicates", element: <DuplicatesView /> },
      { path: "extension", element: <ExtensionView /> },
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
