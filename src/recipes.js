// Полный набор рецептов по техкартам Aura02 Coffee.
// Ключ — точное название товара в Poster.
// Значение — массив {ingredientId, qty} где ingredientId = id ингредиента.
//
// Ингредиенты нормализованы по единицам:
//   Кофе — граммы (1 шот ≈ 8г)
//   Молоко — мл (1мл ≈ 1г → для кг делим на 1000)
//   Сироп — мл
//   Сахар/шоколад/сливки/какао/матча — граммы
//   Вода — мл
//   Лёд — граммы
//   Пюре — граммы
//   Стакан — 1 шт

export const INGREDIENTS = [
  { id: "coffee_beans", name: "Зерно кофе", unit: "г" },
  { id: "milk", name: "Молоко", unit: "мл" },
  { id: "cups_350", name: "Стакан 350мл", unit: "шт" },
  { id: "cups_450", name: "Стакан 450мл", unit: "шт" },
  { id: "cups_plastic", name: "Стакан пластик 450", unit: "шт" },
  { id: "ice", name: "Лёд", unit: "г" },
  { id: "syrup", name: "Сироп", unit: "мл" },
  { id: "honey", name: "Мёд", unit: "г" },
  { id: "cream_33", name: "Сливки 33%", unit: "г" },
  { id: "chocolate", name: "Шоколад", unit: "г" },
  { id: "cocoa", name: "Какао", unit: "г" },
  { id: "matcha", name: "Матча", unit: "г" },
  { id: "ice_cream", name: "Мороженое", unit: "г" },
  { id: "sour_cream", name: "Сырная пена", unit: "г" },
  { id: "puree_citrus", name: "Пюре Цитрус", unit: "г" },
  { id: "puree_blueberry", name: "Пюре Голубика", unit: "г" },
  { id: "puree_raspberry", name: "Пюре Малина", unit: "г" },
  { id: "puree_passion_fruit", name: "Пюре Малина-Маракуйя", unit: "г" },
  { id: "puree_basil", name: "Пюре Базилик", unit: "г" },
  { id: "puree_currant", name: "Пюре Смородина-Розмарин", unit: "г" },
  { id: "puree_cherry_mint", name: "Пюре Вишня-Мята", unit: "г" },
  { id: "puree_apple", name: "Пюре Яблоко", unit: "г" },
  { id: "puree_lemon", name: "Пюре Лимон", unit: "г" },
  { id: "puree_kiwi", name: "Пюре Киви", unit: "г" },
  { id: "puree_strawberry", name: "Пюре Клубника", unit: "г" },
  { id: "puree_mango", name: "Пюре Манго", unit: "г" },
  { id: "puree_banana", name: "Пюре Банан", unit: "г" },
  { id: "lemon_slice", name: "Лимон слайс", unit: "г" },
  { id: "orange_slice", name: "Апельсин слайс", unit: "г" },
  { id: "mint", name: "Мята", unit: "г" },
  { id: "cinnamon", name: "Корица", unit: "г" },
  { id: "tonic", name: "Тоник", unit: "мл" },
  { id: "sparkling_water", name: "Газ. вода", unit: "мл" },
  { id: "water_hot", name: "Вода горячая", unit: "мл" },
  { id: "water_cold", name: "Вода холодная", unit: "мл" },
  { id: "oreo", name: "Печенье Орео", unit: "шт" },
  { id: "caramel_sauce", name: "Карамель топпинг", unit: "г" },
  { id: "chocolate_sauce", name: "Шоколадный топпинг", unit: "г" },
  { id: "strawberry_sauce", name: "Клубничный топпинг", unit: "г" },
  { id: "condensed_milk", name: "Сгущённое молоко", unit: "г" },
];

// Вспомогательные функции для рецептов
const S350 = (id, qty) => ({ ingredientId: id, qty, cup: "350" });
const S450 = (id, qty) => ({ ingredientId: id, qty, cup: "450" });
const SP = (id, qty) => ({ ingredientId: id, qty, cup: "all" });
const COFFEE_SHOT_1 = { ingredientId: "coffee_beans", qty: 8 };
const COFFEE_SHOT_2 = { ingredientId: "coffee_beans", qty: 16 };
const COFFEE_SHOT_3 = { ingredientId: "coffee_beans", qty: 24 };

export const RECIPES = {
  // ═══════════════════════════════════════════════════════
  // КОФЕЙНЫЕ НАПИТКИ — ГОРЯЧИЕ
  // ═══════════════════════════════════════════════════════

  "Американо 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "water_hot", qty: 150 },
    { ingredientId: "honey", qty: 15 },
    { ingredientId: "syrup", qty: 15 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],
  "Американо 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "coffee_beans", qty: 24 },
    { ingredientId: "water_hot", qty: 200 },
    { ingredientId: "honey", qty: 20 },
    { ingredientId: "syrup", qty: 20 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Латте 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 280 },
    { ingredientId: "honey", qty: 15 },
    { ingredientId: "syrup", qty: 15 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],
  "Латте 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 350 },
    { ingredientId: "honey", qty: 20 },
    { ingredientId: "syrup", qty: 20 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Капучино 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 250 },
    { ingredientId: "honey", qty: 15 },
    { ingredientId: "syrup", qty: 15 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],
  "Капучино 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "coffee_beans", qty: 24 },
    { ingredientId: "milk", qty: 300 },
    { ingredientId: "honey", qty: 20 },
    { ingredientId: "syrup", qty: 20 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Флэт уайт 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 200 },
    { ingredientId: "honey", qty: 15 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Раф 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "cream_33", qty: 50 },
    { ingredientId: "milk", qty: 220 },
    { ingredientId: "honey", qty: 20 },
    { ingredientId: "syrup", qty: 3 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],
  "Раф 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "cream_33", qty: 80 },
    { ingredientId: "milk", qty: 240 },
    { ingredientId: "honey", qty: 25 },
    { ingredientId: "syrup", qty: 5 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Мокко 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 250 },
    { ingredientId: "chocolate", qty: 20 },
    { ingredientId: "honey", qty: 15 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],
  "Мокко 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 300 },
    { ingredientId: "chocolate", qty: 30 },
    { ingredientId: "honey", qty: 20 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Горячий Бамбл 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 250 },
    { ingredientId: "orange_slice", qty: 1 },
    { ingredientId: "mint", qty: 1 },
  ],
  "Горячий Бамбл 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 350 },
    { ingredientId: "orange_slice", qty: 1 },
    { ingredientId: "mint", qty: 1 },
  ],

  "Горячий шоколад 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "chocolate", qty: 30 },
    { ingredientId: "milk", qty: 240 },
    { ingredientId: "cream_33", qty: 50 },
    { ingredientId: "cocoa", qty: 4 },
  ],
  "Горячий шоколад 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "chocolate", qty: 30 },
    { ingredientId: "milk", qty: 240 },
    { ingredientId: "cream_33", qty: 50 },
    { ingredientId: "cocoa", qty: 4 },
  ],

  // ═══════════════════════════════════════════════════════
  // КОФЕЙНЫЕ НАПИТКИ — ХОЛОДНЫЕ
  // ═══════════════════════════════════════════════════════

  "Айс Американо 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 100 },
    { ingredientId: "syrup", qty: 20 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Айс Латте 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 250 },
    { ingredientId: "syrup", qty: 20 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Айс Капучино 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 250 },
    { ingredientId: "syrup", qty: 20 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Фрапучино 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice_cream", qty: 100 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 120 },
    { ingredientId: "syrup", qty: 15 },
    { ingredientId: "cream_33", qty: 40 },
    // Сырная пена: молоко 20 + сливки 40 + ваниль 10 + соль 0.3
  ],

  "Гляссе 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice_cream", qty: 150 },
    { ingredientId: "milk", qty: 250 },
    { ingredientId: "syrup", qty: 20 },
    { ingredientId: "cinnamon", qty: 0.5 },
  ],

  "Эспрессо тоник 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "tonic", qty: 250 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "syrup", qty: 15 },
    { ingredientId: "mint", qty: 2 },
    { ingredientId: "lemon_slice", qty: 2 },
  ],

  "Бамбл 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "coffee_beans", qty: 16 },
    { ingredientId: "milk", qty: 250 },
    { ingredientId: "orange_slice", qty: 1 },
    { ingredientId: "syrup", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  // ═══════════════════════════════════════════════════════
  // ГОРЯЧИЕ ЧАИ
  // ═══════════════════════════════════════════════════════

  "Чай Тащенский 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "water_hot", qty: 250 },
    { ingredientId: "ice", qty: 10 },
    { ingredientId: "puree_blueberry", qty: 60 },
    { ingredientId: "puree_citrus", qty: 15 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],
  "Чай Тащенский 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 300 },
    { ingredientId: "ice", qty: 10 },
    { ingredientId: "puree_blueberry", qty: 80 },
    { ingredientId: "puree_citrus", qty: 20 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Чай Голубика - Лимон 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "water_hot", qty: 225 },
    { ingredientId: "puree_blueberry", qty: 60 },
    { ingredientId: "puree_citrus", qty: 15 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],
  "Чай Голубика - Лимон 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 300 },
    { ingredientId: "puree_blueberry", qty: 80 },
    { ingredientId: "puree_citrus", qty: 20 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Чай Вишня-мята 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "water_hot", qty: 300 },
    { ingredientId: "puree_cherry_mint", qty: 80 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],
  "Чай Вишня-мята 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 350 },
    { ingredientId: "puree_cherry_mint", qty: 100 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Чай Смородина-розмарин 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "water_hot", qty: 300 },
    { ingredientId: "puree_currant", qty: 80 },
    { ingredientId: "mint", qty: 2 },
  ],
  "Чай Смородина-розмарин 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 350 },
    { ingredientId: "puree_currant", qty: 100 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Чай Малина-грейпфрут 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "water_hot", qty: 250 },
    { ingredientId: "puree_raspberry", qty: 30 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],
  "Чай Малина-грейпфрут 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 300 },
    { ingredientId: "puree_raspberry", qty: 50 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Чай Облепиха - Яблоко 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "water_hot", qty: 250 },
    { ingredientId: "puree_blueberry", qty: 80 },
    { ingredientId: "puree_apple", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],
  "Чай Облепиха - Яблоко 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 320 },
    { ingredientId: "puree_blueberry", qty: 100 },
    { ingredientId: "puree_apple", qty: 20 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Чай Марокканский 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "water_hot", qty: 300 },
    { ingredientId: "honey", qty: 30 },
    { ingredientId: "cinnamon", qty: 0.5 },
    { ingredientId: "puree_citrus", qty: 15 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],
  "Чай Марокканский 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 400 },
    { ingredientId: "honey", qty: 40 },
    { ingredientId: "cinnamon", qty: 0.5 },
    { ingredientId: "puree_citrus", qty: 15 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "orange_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Чай Имбирь - Цитрус 350": [
    { ingredientId: "cups_350", qty: 1 },
    { ingredientId: "water_hot", qty: 250 },
    { ingredientId: "puree_citrus", qty: 15 },
    { ingredientId: "syrup", qty: 25 },
    { ingredientId: "puree_lemon", qty: 10 },
    { ingredientId: "cinnamon", qty: 0.5 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],
  "Чай Имбирь - Цитрус 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 300 },
    { ingredientId: "puree_citrus", qty: 15 },
    { ingredientId: "syrup", qty: 30 },
    { ingredientId: "puree_lemon", qty: 10 },
    { ingredientId: "cinnamon", qty: 0.5 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Чай Обычный 450": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "water_hot", qty: 350 },
  ],

  // ═══════════════════════════════════════════════════════
  // ХОЛОДНЫЕ ЧАИ (Айс Ти)
  // ═══════════════════════════════════════════════════════

  "Айс Ти Голубика-Лимон 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_blueberry", qty: 80 },
    { ingredientId: "puree_citrus", qty: 20 },
    { ingredientId: "water_cold", qty: 200 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Айс Ти Вишня-мята 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_cherry_mint", qty: 100 },
    { ingredientId: "water_cold", qty: 200 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Айс Ти Смородина-Розмарин 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_currant", qty: 100 },
    { ingredientId: "water_cold", qty: 220 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Айс Ти Малина-Грейпфрут 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_raspberry", qty: 50 },
    { ingredientId: "puree_lemon", qty: 50 },
    { ingredientId: "water_cold", qty: 220 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Айс Ти Облепиха-Яблоко 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_blueberry", qty: 100 },
    { ingredientId: "puree_apple", qty: 15 },
    { ingredientId: "water_cold", qty: 220 },
    { ingredientId: "mint", qty: 2 },
  ],

  // ═══════════════════════════════════════════════════════
  // ЛИМОНАДЫ
  // ═══════════════════════════════════════════════════════

  "Лимонад Базилик-Цитрус 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_basil", qty: 60 },
    { ingredientId: "puree_citrus", qty: 40 },
    { ingredientId: "sparkling_water", qty: 200 },
    { ingredientId: "mint", qty: 2 },
    { ingredientId: "lemon_slice", qty: 15 },
  ],

  "Лимонад Голубика-Лимон 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_blueberry", qty: 80 },
    { ingredientId: "puree_citrus", qty: 20 },
    { ingredientId: "sparkling_water", qty: 200 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Лимонад Классический 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_citrus", qty: 50 },
    { ingredientId: "syrup", qty: 50 },
    { ingredientId: "sparkling_water", qty: 200 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Лимонад Облепиха-Цитрус 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_blueberry", qty: 80 },
    { ingredientId: "puree_citrus", qty: 40 },
    { ingredientId: "sparkling_water", qty: 200 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Лимонад Малина-Маракуйя 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_passion_fruit", qty: 50 },
    { ingredientId: "puree_raspberry", qty: 25 },
    { ingredientId: "sparkling_water", qty: 200 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  "Лимонад Ледяная Вишня 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice", qty: 150 },
    { ingredientId: "puree_cherry_mint", qty: 120 },
    { ingredientId: "sparkling_water", qty: 150 },
    { ingredientId: "lemon_slice", qty: 15 },
    { ingredientId: "mint", qty: 2 },
  ],

  // ═══════════════════════════════════════════════════════
  // СМУЗИ
  // ═══════════════════════════════════════════════════════

  "Смузи Зелёный 350": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_basil", qty: 15 },
    { ingredientId: "puree_banana", qty: 70 },
    { ingredientId: "puree_apple", qty: 70 },
    { ingredientId: "water_cold", qty: 180 },
  ],
  "Смузи Зелёный 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_basil", qty: 25 },
    { ingredientId: "puree_banana", qty: 90 },
    { ingredientId: "puree_apple", qty: 90 },
    { ingredientId: "water_cold", qty: 200 },
  ],

  "Смузи Киви-Банан 350": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_kiwi", qty: 80 },
    { ingredientId: "puree_banana", qty: 80 },
    { ingredientId: "puree_strawberry", qty: 10 },
    { ingredientId: "water_cold", qty: 160 },
  ],
  "Смузи Киви-Банан 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_kiwi", qty: 100 },
    { ingredientId: "puree_banana", qty: 90 },
    { ingredientId: "puree_strawberry", qty: 20 },
    { ingredientId: "water_cold", qty: 180 },
  ],

  "Смузи Манго-Маракуйя 350": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_mango", qty: 50 },
    { ingredientId: "puree_passion_fruit", qty: 50 },
    { ingredientId: "puree_banana", qty: 50 },
    { ingredientId: "ice", qty: 70 },
    { ingredientId: "water_cold", qty: 160 },
  ],
  "Смузи Манго-Маракуйя 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_mango", qty: 75 },
    { ingredientId: "puree_passion_fruit", qty: 75 },
    { ingredientId: "puree_banana", qty: 50 },
    { ingredientId: "ice", qty: 70 },
    { ingredientId: "water_cold", qty: 180 },
  ],

  "Смузи Яблоко-Финик 350": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_apple", qty: 70 },
    { ingredientId: "puree_banana", qty: 70 },
    { ingredientId: "milk", qty: 180 },
  ],
  "Смузи Яблоко-Финик 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_apple", qty: 90 },
    { ingredientId: "puree_banana", qty: 90 },
    { ingredientId: "milk", qty: 200 },
  ],

  "Смузи Ягодный 350": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_strawberry", qty: 40 },
    { ingredientId: "puree_raspberry", qty: 25 },
    { ingredientId: "puree_blueberry", qty: 25 },
    { ingredientId: "puree_banana", qty: 70 },
    { ingredientId: "water_cold", qty: 160 },
  ],
  "Смузи Ягодный 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "puree_strawberry", qty: 50 },
    { ingredientId: "puree_raspberry", qty: 35 },
    { ingredientId: "puree_blueberry", qty: 35 },
    { ingredientId: "puree_banana", qty: 90 },
    { ingredientId: "water_cold", qty: 180 },
  ],

  // ═══════════════════════════════════════════════════════
  // МИЛКШЕЙКИ
  // ═══════════════════════════════════════════════════════

  "Милкшейк Банан-Карамель 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice_cream", qty: 120 },
    { ingredientId: "milk", qty: 150 },
    { ingredientId: "syrup", qty: 10 },
    { ingredientId: "puree_banana", qty: 40 },
    // Сырная пена: молоко 20 + сливки 40 + ваниль 10 + соль 0.3
  ],

  "Милкшейк Ванильный 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice_cream", qty: 120 },
    { ingredientId: "milk", qty: 150 },
    { ingredientId: "syrup", qty: 10 },
  ],

  "Милкшейк Клубничный 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice_cream", qty: 120 },
    { ingredientId: "milk", qty: 150 },
    { ingredientId: "syrup", qty: 10 },
    { ingredientId: "puree_strawberry", qty: 40 },
  ],

  "Милкшейк Шоколадный 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice_cream", qty: 120 },
    { ingredientId: "milk", qty: 150 },
    { ingredientId: "syrup", qty: 10 },
    { ingredientId: "chocolate", qty: 10 },
  ],

  "Милкшейк Oreo 450": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "ice_cream", qty: 120 },
    { ingredientId: "milk", qty: 150 },
    { ingredientId: "syrup", qty: 10 },
    { ingredientId: "oreo", qty: 4 },
  ],

  // ═══════════════════════════════════════════════════════
  // МАТЧА
  // ═══════════════════════════════════════════════════════

  "Матча Латте 0.5": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "matcha", qty: 4 },
    { ingredientId: "milk", qty: 330 },
  ],

  "Матча Раф 0.5": [
    { ingredientId: "cups_450", qty: 1 },
    { ingredientId: "matcha", qty: 4 },
    { ingredientId: "cream_33", qty: 80 },
    { ingredientId: "milk", qty: 240 },
  ],

  "Айс Матча Латте 0.5": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "matcha", qty: 4 },
    { ingredientId: "milk", qty: 250 },
  ],

  "Матча Фраппе 0.5": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "matcha", qty: 4 },
    { ingredientId: "ice_cream", qty: 100 },
    { ingredientId: "ice", qty: 110 },
    { ingredientId: "milk", qty: 120 },
    // Сырная пена: молоко 20 + сливки 40 + ваниль 10 + соль 0.3
  ],

  "Матча Тоник 0.5": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "matcha", qty: 4 },
    { ingredientId: "tonic", qty: 200 },
    { ingredientId: "ice", qty: 150 },
  ],

  "Матча Тропик 0.5": [
    { ingredientId: "cups_plastic", qty: 1 },
    { ingredientId: "matcha", qty: 4 },
    { ingredientId: "puree_mango", qty: 40 },
    { ingredientId: "milk", qty: 200 },
    { ingredientId: "ice", qty: 150 },
  ],
};
