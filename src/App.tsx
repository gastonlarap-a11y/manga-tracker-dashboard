import { BrowserRouter, Route, Routes } from "react-router";
import { Layout } from "./components/Layout";
import { DuplicatesView } from "./views/DuplicatesView";
import { LibraryView } from "./views/LibraryView";
import { MangaDetailView } from "./views/MangaDetailView";

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<LibraryView />} />
          <Route path="/manga/:id" element={<MangaDetailView />} />
          <Route path="/duplicates" element={<DuplicatesView />} />
          <Route
            path="*"
            element={<p className="status">Página no encontrada.</p>}
          />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
