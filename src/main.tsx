import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { installEmbedLinkBridge } from "./lib/embed";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/library.css";
import "./styles/detail.css";
import "./styles/duplicates.css";
import "./styles/extension.css";

// Before render, so the very first click is already covered. A no-op unless
// this page is running inside the desktop app's window.
installEmbedLinkBridge();

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element in index.html");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
