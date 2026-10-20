import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <>
    <div className="aurora" aria-hidden="true">
      <i className="orb orb-1" /><i className="orb orb-2" /><i className="orb orb-3" /><i className="orb orb-4" />
    </div>
    <App />
  </>
);
