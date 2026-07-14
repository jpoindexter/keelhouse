import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-800.css";

import React from "react";
import ReactDOM from "react-dom/client";

const bootstrap = async () => {
  if (new URLSearchParams(window.location.search).get("qa") === "1") {
    const { setupBrowserQa } = await import("./browserQa");
    setupBrowserQa();
  }

  const { default: App } = await import("./App");
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
};

void bootstrap();
