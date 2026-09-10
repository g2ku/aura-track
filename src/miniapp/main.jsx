// Мини-приложение «Стаканы» — отдельная точка входа.
//
// Своя сборка намеренно: основной сайт весит 203 КБ до первого экрана
// (скрипт, Firebase, стили), а в webview телеграма на слабой связи это
// заметно. Здесь нужен React и три экрана, Firebase не нужен вовсе —
// вход через подпись Telegram.

import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

createRoot(document.getElementById("app")).render(<App tg={tg} />);
