import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { AdminApp } from "./AdminApp.jsx";
import "./styles.css";

const RootApp = window.location.pathname.replace(/\/+$/u, "") === "/admin" ? AdminApp : App;

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RootApp />
  </React.StrictMode>,
);
