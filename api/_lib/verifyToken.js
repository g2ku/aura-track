// Проверка Firebase ID-токена на голом node:crypto.
//
// Почему не firebase-admin/auth: на Vercel он падает ещё до работы —
// jwks-rsa зовёт jose через require(), а jose нынче только ESM.
// В ответ прилетает голый FUNCTION_INVOCATION_FAILED, без объяснений.
//
// Проверять тут нечего сложного: это обычный RS256-JWT, подписанный
// Google. Нужны подпись, срок и то, что токен выписан НАШЕМУ проекту —
// без последнего подошёл бы токен от любого чужого Firebase-приложения.

import { createPublicKey, createVerify } from "node:crypto";

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

// Ключи Google меняются раз в сутки и отдаются с Cache-Control.
// Тянуть их на каждый запрос — лишний поход в сеть на каждой странице.
let certsCache = { keys: null, until: 0 };

async function googleCerts(now = Date.now()) {
  if (certsCache.keys && now < certsCache.until) return certsCache.keys;
  const res = await fetch(CERTS_URL);
  if (!res.ok) throw new Error(`ключи Google недоступны (HTTP ${res.status})`);
  const keys = await res.json();
  const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") || "")?.[1]);
  certsCache = { keys, until: now + (Number.isFinite(maxAge) ? maxAge : 3600) * 1000 };
  return keys;
}

function decodeSegment(seg) {
  return Buffer.from(String(seg).replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

// projectId — из сервисного ключа. certs и now подставляются в тестах.
export async function verifyFirebaseToken(token, { projectId, certs, now = Date.now() } = {}) {
  if (!projectId) throw new Error("не знаю, какому проекту должен принадлежать токен");

  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("это не JWT");

  let header, payload;
  try {
    header = JSON.parse(decodeSegment(parts[0]).toString("utf8"));
    payload = JSON.parse(decodeSegment(parts[1]).toString("utf8"));
  } catch {
    throw new Error("токен не разбирается");
  }

  // alg из самого токена брать нельзя: подставив "none", подпись обошли бы.
  if (header.alg !== "RS256") throw new Error(`чужой алгоритм подписи: ${header.alg}`);
  if (!header.kid) throw new Error("в токене не указан ключ подписи");

  const keys = certs || (await googleCerts(now));
  const cert = keys[header.kid];
  if (!cert) throw new Error("токен подписан неизвестным ключом");

  const signed = createVerify("RSA-SHA256")
    .update(`${parts[0]}.${parts[1]}`)
    .verify(createPublicKey(cert), decodeSegment(parts[2]));
  if (!signed) throw new Error("подпись не сходится");

  const sec = Math.floor(now / 1000);
  if (!(payload.exp > sec)) throw new Error("токен истёк");
  // Небольшой запас на расхождение часов
  if (payload.iat > sec + 300) throw new Error("токен выписан будущим временем");

  // Ради этих двух строк всё и делается: без них подошёл бы токен,
  // выписанный любым посторонним Firebase-проектом.
  if (payload.aud !== projectId) throw new Error("токен выписан другому проекту");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error("токен выписан не Firebase");
  }
  if (!payload.sub) throw new Error("в токене нет пользователя");

  return { uid: payload.sub, email: payload.email || "" };
}

// Только для тестов: сбросить запомненные ключи Google.
export function _resetCerts() {
  certsCache = { keys: null, until: 0 };
}
