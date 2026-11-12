import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { applyLang, browserLang, isLang } from "./i18n";
import { useUi } from "./store/ui";
// Fonts are bundled with the site, so visitors' browsers never contact a font CDN.
import "@fontsource-variable/fraunces/opsz.css";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "@fontsource-variable/manrope/wght.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/pages.css";

/** Redraws everything when the language changes, so every string is read again. */
function Root() {
  const version = useUi((s) => s.langVersion);
  return <App key={version} />;
}

// Language: ?lang=xx in the address, else the visitor's saved choice, else their browser's.
const asked = new URLSearchParams(window.location.search).get("lang");
if (isLang(asked)) useUi.setState({ lang: asked });
const start = useUi.getState().lang || browserLang();

// Load that language's words first, so the page never flashes in English.
applyLang(start).finally(() => {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <Root />
    </StrictMode>
  );
});

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
