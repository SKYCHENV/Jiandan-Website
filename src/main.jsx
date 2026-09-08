import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const pathname = window.location.pathname;
const normalizedPath = pathname.replace(/\/+$/u, "") || "/";

async function bootstrap() {
  let root;
  if (normalizedPath === "/admin") {
    const {AdminApp} = await import("./AdminApp.jsx");
    root = <AdminApp />;
  } else if (normalizedPath === "/") {
    const {App} = await import("./App.jsx");
    root = <App />;
  } else {
    const {resolvePublicApp} = await import("./ContentPages.jsx");
    root = resolvePublicApp(pathname);
  }

  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      {root}
    </React.StrictMode>,
  );
}

bootstrap();
