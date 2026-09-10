// Точка сборки для теста: собирает экраны в один модуль, который можно
// отрендерить в node. В приложение не входит.
export { default as Give } from "./Give.jsx";
export { default as Warehouse } from "./Warehouse.jsx";
export { default as Today } from "./Today.jsx";
export { screenFor, ROLE_NAME } from "./roles.js";
