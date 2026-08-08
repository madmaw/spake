import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "src/App";
import { initSpeech } from "src/speech/speech";
import "src/global.css";

initSpeech();

const container = document.getElementById("root");
if (container == null) {
    throw new Error("missing #root element");
}
createRoot(container).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
