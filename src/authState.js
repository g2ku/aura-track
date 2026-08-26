// authState — решения про роль пользователя, без React и без Firebase.
//
// Вынесено отдельно ровно затем, чтобы это можно было прогнать тестом:
// на этих строчках держится, что увидит человек, зашедший на сайт, и
// дважды подряд здесь уже ломалось молча.

// Что делать с ответом Firestore про профиль. Вынесено из хука отдельно,
// потому что вся авторизация сайта держится на трёх строчках ниже и
// проверять их надо поведением, а не глазами.
//
//   профиль есть              → это он, кладём в кэш, экран готов
//   профиля нет, ответ с сервера → профиля правда нет, экран готов
//   профиля нет, ответ из кэша   → мы просто ещё не знаем: держим загрузку
//                                  и НИЧЕГО не пишем в localStorage
export function resolveMetaSnapshot(fbUser, meta, fromCache) {
  if (meta) {
    return { auth: { ...meta, email: fbUser.email }, cache: true, settled: true };
  }
  // Роль здесь — заглушка. Записывать её в localStorage нельзя: она
  // переживёт перезагрузку и молча урежет права настоящему админу.
  const provisional = {
    uid: fbUser.uid,
    email: fbUser.email,
    displayName: fbUser.email?.split("@")[0] || "",
    role: "curator",
    branch: null,
    spotName: null,
    createdAt: Date.now(),
    provisional: true,
  };
  return { auth: provisional, cache: false, settled: !fromCache };
}

// Сколько ждём ответа сервера, прежде чем показать экран без роли.
// Без сети серверный ответ не придёт никогда, а вечный спиннер хуже
// урезанного экрана.
export const WAIT_FOR_SERVER_MS = 4000;
