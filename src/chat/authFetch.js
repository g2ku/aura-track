// chat/authFetch.js — заголовки для своих ручек /api/*.
//
// Сервер пускает только по Firebase ID-токену. Токен берём у клиента
// Firebase лениво: модуль ассистента не должен тянуть Firebase при
// импорте — он проверяется в node без него.

export async function authHeaders() {
  const h = { "Content-Type": "application/json" };
  try {
    const { getIdToken } = await import("../firebase.js");
    const token = await getIdToken();
    if (token) h.Authorization = `Bearer ${token}`;
  } catch (_) { /* без входа сервер и так откажет */ }
  return h;
}
