# SupplyTrack

Трекер поставок и оплат для сети филиалов. Автономная браузерная версия — без Claude API, без бэкенд-сервера, всё работает через Firebase Firestore (бесплатный тариф) с real-time синхронизацией между пользователями.

## Возможности

- Загрузка накладных в форматах **.xlsx**, **.xls**, **.csv**, **.pdf** (текстовые)
- Автоматический эвристический парсер таблиц — без AI
- Карточки филиалов с долгом, прогрессом и историей оплат
- Статистика: разбивка по филиалам и товарам
- Общая база для 5-6 человек через Firebase Firestore (real-time)
- Авторизация без пароля: `admin` (полный доступ) и `user` (только просмотр)

## Структура

```
site-aura/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── README.md
├── public/
│   └── favicon.svg
└── src/
    ├── main.jsx          # точка входа
    ├── App.jsx           # главный компонент
    ├── auth.js           # логин admin/user
    ├── firebase.js       # Firestore
    ├── parser.js         # эвристический парсер
    ├── utils.js          # форматирование
    ├── styles.css        # стили
    └── components/
        ├── Upload.jsx
        ├── SheetSelect.jsx
        ├── Tracking.jsx
        ├── PaymentModal.jsx
        └── Stats.jsx
```

## Быстрый старт

### 1. Установка

```bash
npm install
```

### 2. Настройка Firebase (5-10 минут)

1. Зайдите на https://console.firebase.google.com и создайте новый проект.
2. В меню слева выберите **Firestore Database** → **Create database** → режим **Production** → регион europe-west / asia-southeast (ближайший).
3. В настройках проекта (⚙️ → Project settings) найдите **Your apps** → нажмите иконку `</>` → зарегистрируйте web-приложение.
4. Скопируйте конфиг (`firebaseConfig`) — 6 значений.
5. Создайте файл `.env.local` в корне проекта и заполните его по образцу `.env.example`:
   ```
   VITE_FIREBASE_API_KEY=AIza...
   VITE_FIREBASE_AUTH_DOMAIN=your-app.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-app
   VITE_FIREBASE_STORAGE_BUCKET=your-app.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
   VITE_FIREBASE_APP_ID=1:1234567890:web:abc123
   ```

### 3. Правила Firestore

В Firebase Console → Firestore → **Rules** вставьте (для MVP — открытый доступ; см. раздел «Безопасность»):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 4. Запуск

```bash
npm run dev      # dev-сервер на http://localhost:5173
npm run build    # production-сборка в dist/
npm run preview  # просмотр production-сборки
```

## Использование

1. Откройте приложение.
2. Введите логин:
   - `admin` — загрузка накладных, добавление оплат, сброс данных.
   - `user` — только просмотр долгов и статистики.
3. **admin**: загрузите файл с накладной → парсер автоматически разберёт таблицу → появятся карточки филиалов с долгом.
4. Кликните по карточке филиала → раскроется список товаров и история оплат → нажмите **Добавить оплату**.
5. В модалке отметьте конкретные товары или введите свою сумму → подтвердите.
6. Другие пользователи (включая `user`) увидят обновления в реальном времени.

## Деплой

После `npm run build` папку `dist/` можно загрузить на любой статический хостинг:

| Хостинг | Что делать |
|---------|-----------|
| **Netlify** | Зайдите на https://app.netlify.com/drop → перетащите папку `dist/` |
| **Vercel** | `npx vercel` в корне проекта (или через Git) |
| **GitHub Pages** | Включите Pages в настройках репо → укажите branch и папку `dist/` |
| **Cloudflare Pages** | Подключите репо → build command `npm run build`, output `dist/` |

⚠️ **Важно для SPA:** любой хостинг должен отдавать `index.html` для всех неизвестных путей (history API fallback). Vite + большинство современных хостингов делают это автоматически.

Если вы хотите использовать Firebase Hosting (бесплатно, отлично интегрируется с Firestore):

```bash
npm i -g firebase-tools
firebase login
firebase init hosting   # public dir = dist
npm run build
firebase deploy
```

## Безопасность (TODO перед продакшном)

Текущая конфигурация разрешает любые чтение и запись в Firestore. Это нормально для группы из 5-6 доверенных пользователей, но если хочется ограничить запись только `admin`:

**Вариант A — Firebase Auth + custom claims** (правильный путь):
1. Включите Firebase Authentication (email/password).
2. Создайте Cloud Function, которая при создании пользователя ставит ему custom claim `role: "admin"` или `role: "user"`.
3. Правила:
   ```
   match /documents/{docId} {
     allow read: if true;
     allow write: if request.auth.token.role == "admin";
   }
   ```

**Вариант B — проверка поля в документе** (проще):
В каждый документ писать `uploadedBy` и в правилах проверять через `getAfter()`. Это сложнее и менее надёжно.

**Вариант C — пароль в sessionStorage:**
Вместо логина без пароля — требовать пароль при входе, сверять с хешем в Firestore. Тоже не идеал, но лучше текущего.

⚠️ **Важно:** любое фронтенд-ограничение можно обойти через DevTools. Для реальной защиты нужен сервер или Firebase Auth + правила. Для группы доверенных лиц текущий вариант достаточен.

## Поддерживаемые форматы

- `.xlsx`, `.xls`, `.csv` — нативно через библиотеку `xlsx`
- `.pdf` — через `pdfjs-dist`, **только текстовые** (сканы и картинки не поддерживаются)

Если PDF отсканирован, нужно сначала прогнать его через OCR (например, через Adobe Acrobat или Google Drive) — после этого парсер сможет его прочитать.

## Как работает парсер

Эвристический алгоритм в `src/parser.js`:

1. Ищет строку-заголовок с филиалами — строка, где ≥2 идущих подряд ячейки содержат текст (не числа).
2. Индексы текстовых ячеек в этой строке = столбцы филиалов.
3. Первый столбец левее филиалов = названия товаров.
4. Ниже шапки собираются позиции: число в столбце филиала = сумма поставки.
5. Строка с «Общ» / «Итого» пропускается (считаем свои totals).
6. Дата ищется в любой ячейке документа в форматах `dd.mm.yyyy` или `«26 июня»`.

Если парсер ошибается — присылайте пример накладной, доработаю.

## Лицензия

Личное использование.