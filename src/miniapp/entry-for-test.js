// Точка сборки для теста: собирает экраны в один модуль, который можно
// отрендерить в node. В приложение не входит.
export { default as Give } from "./Give.jsx";
export { default as Warehouse } from "./Warehouse.jsx";
export { default as Today } from "./Today.jsx";
export { default as Feed } from "./Feed.jsx";
export { default as History } from "./History.jsx";
export { screenFor, tabsFor, ROLE_NAME } from "./roles.js";
export { api } from "./api.js";
export { num, dayRu, rangeRu, monthRu } from "./fmt.js";
