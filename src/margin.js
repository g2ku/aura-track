// margin.js — калькулятор маржинальности: ингредиенты, рецепты, дашборд.
//
// Structure in Firestore `settings/margin`:
//   { ingredients: [{ id, name, unit, pricePerUnit }], recipes: [{ id, name, category, salePrice, items: [{ ingredientId, qty, unit }] }], updatedAt }

import { getDb } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

const SETTINGS_DOC = "settings/margin";

// ─── Дефолтные ингредиенты (без цен) ─────────────────────────────

const DEFAULT_INGREDIENTS = [
  // ── Основные жидкости ──
  { id: "ing_milk", name: "Молоко", unit: "л", pricePerUnit: 0 },
  { id: "ing_cream33", name: "Сливки 33%", unit: "г", pricePerUnit: 0 },
  { id: "ing_cream10", name: "Сливки 10%", unit: "г", pricePerUnit: 0 },
  { id: "ing_water", name: "Вода питьевая", unit: "л", pricePerUnit: 0 },
  { id: "ing_soda", name: "Газированная вода", unit: "л", pricePerUnit: 0 },
  { id: "ing_tonic", name: "Тоник", unit: "л", pricePerUnit: 0 },

  // ── Кофе и чай ──
  { id: "ing_coffee", name: "Кофе (шот)", unit: "шт", pricePerUnit: 0 },
  { id: "ing_tea_black", name: "Чай Чёрный (пакетик)", unit: "шт", pricePerUnit: 0 },
  { id: "ing_tea_green", name: "Чай Зелёный Сенча", unit: "г", pricePerUnit: 0 },
  { id: "ing_tea_assam", name: "Чай Ассам", unit: "г", pricePerUnit: 0 },
  { id: "ing_tea_bergamot", name: "Чай Бергамот", unit: "г", pricePerUnit: 0 },
  { id: "ing_matcha", name: "Матча Чистатэ", unit: "г", pricePerUnit: 0 },

  // ── Сиропы ──
  { id: "ing_syrup_vanilla", name: "Сироп Ваниль", unit: "г", pricePerUnit: 0 },
  { id: "ing_syrup_caramel", name: "Сироп Карамель", unit: "г", pricePerUnit: 0 },
  { id: "ing_syrup_strawberry", name: "Сироп Клубника", unit: "г", pricePerUnit: 0 },
  { id: "ing_syrup_chocolate", name: "Сироп Шоколад", unit: "г", pricePerUnit: 0 },
  { id: "ing_syrup_iris", name: "Сироп Айрис", unit: "г", pricePerUnit: 0 },
  { id: "ing_syrup_sugar", name: "Сахарный сироп", unit: "г", pricePerUnit: 0 },

  // ── Мёд и специи ──
  { id: "ing_honey", name: "Мёд", unit: "г", pricePerUnit: 0 },
  { id: "ing_cinnamon", name: "Корица", unit: "г", pricePerUnit: 0 },

  // ── Лёд ──
  { id: "ing_ice", name: "Лёд", unit: "г", pricePerUnit: 0 },

  // ── Шоколад и какао ──
  { id: "ing_choc_granules", name: "Шоколад гранулы", unit: "г", pricePerUnit: 0 },
  { id: "ing_cocoa", name: "Какао", unit: "г", pricePerUnit: 0 },
  { id: "ing_choc_paste", name: "Шоколад паста", unit: "г", pricePerUnit: 0 },

  // ── Мороженое ──
  { id: "ing_icecream_vanilla", name: "Мороженое Ванильное", unit: "г", pricePerUnit: 0 },
  { id: "ing_icecream_chocolate", name: "Мороженое Шоколадное", unit: "г", pricePerUnit: 0 },
  { id: "ing_icecream_strawberry", name: "Мороженое Клубничное", unit: "г", pricePerUnit: 0 },

  // ── Печенье ──
  { id: "ing_oreo", name: "Печенье Oreo", unit: "шт", pricePerUnit: 0 },

  // ── Эликсиры и заготовки ──
  { id: "ing_elixir_pistachio", name: "Эликсир Фисташка", unit: "мл", pricePerUnit: 0 },
  { id: "ing_elixir_raspberry", name: "Эликсир Малина", unit: "мл", pricePerUnit: 0 },
  { id: "ing_elixir_coconut", name: "Эликсир Кокос", unit: "мл", pricePerUnit: 0 },
  { id: "ing_prep_green", name: "Заготовка 02 Green", unit: "мл", pricePerUnit: 0 },
  { id: "ing_prep_raspberry", name: "Заготовка Малина", unit: "г", pricePerUnit: 0 },
  { id: "ing_prep_peach", name: "Заготовка Персик", unit: "г", pricePerUnit: 0 },
  { id: "ing_prep_citrus", name: "Заготовка Цитрус", unit: "мл", pricePerUnit: 0 },

  // ── Фрукты и ягоды ──
  { id: "ing_lemon", name: "Лимон", unit: "г", pricePerUnit: 0 },
  { id: "ing_lime", name: "Лайм", unit: "г", pricePerUnit: 0 },
  { id: "ing_orange", name: "Апельсин", unit: "шт", pricePerUnit: 0 },
  { id: "ing_cucumber", name: "Огурец", unit: "г", pricePerUnit: 0 },
  { id: "ing_mint", name: "Мята", unit: "г", pricePerUnit: 0 },
  { id: "ing_blueberry", name: "Голубика", unit: "г", pricePerUnit: 0 },
  { id: "ing_raspberry", name: "Малина ягода", unit: "г", pricePerUnit: 0 },
  { id: "ing_seabuckthorn", name: "Облепиха", unit: "г", pricePerUnit: 0 },
  { id: "ing_cherry_mint", name: "Вишня-мята", unit: "г", pricePerUnit: 0 },
  { id: "ing_currant_rosemary", name: "Смородина-розмарин", unit: "г", pricePerUnit: 0 },
  { id: "ing_kiwi", name: "Киви", unit: "г", pricePerUnit: 0 },
  { id: "ing_banana", name: "Банан", unit: "г", pricePerUnit: 0 },
  { id: "ing_apple", name: "Яблоко", unit: "г", pricePerUnit: 0 },
  { id: "ing_mango", name: "Манго", unit: "г", pricePerUnit: 0 },
  { id: "ing_ginger", name: "Имбирь", unit: "г", pricePerUnit: 0 },
  { id: "ing_pineapple_juice", name: "Ананасовый сок", unit: "мл", pricePerUnit: 0 },
  { id: "ing_grapefruit_juice", name: "Сок Грейпфрут", unit: "мл", pricePerUnit: 0 },
  { id: "ing_orange_juice", name: "Сок Апельсин", unit: "мл", pricePerUnit: 0 },

  // ── Готовые заготовки (смеси) ──
  { id: "ing_pre_sugar_syrup", name: "Сахарный сироп (заготовка)", unit: "г", pricePerUnit: 0 },
  { id: "ing_pre_citrus_mix", name: "Цитрус (заготовка)", unit: "г", pricePerUnit: 0 },
  { id: "ing_pre_basil", name: "Базилик (заготовка)", unit: "г", pricePerUnit: 0 },
  { id: "ing_prep_raspberry_mix", name: "Малина (заготовка)", unit: "г", pricePerUnit: 0 },
  { id: "ing_prep_raspberry_passion", name: "Малина-Маракуйя (заготовка)", unit: "г", pricePerUnit: 0 },
  { id: "ing_pre_seabuckthorn_mix", name: "Облепиха (заготовка)", unit: "г", pricePerUnit: 0 },
  { id: "ing_pre_blueberry_mix", name: "Голубика (заготовка)", unit: "г", pricePerUnit: 0 },
  { id: "ing_pre_currant_mint", name: "Смородина-Розмарин (заготовка)", unit: "г", pricePerUnit: 0 },
  { id: "ing_pre_cherry_mint_mix", name: "Вишня-Мята (заготовка)", unit: "г", pricePerUnit: 0 },

  // ── Декор ──
  { id: "ing_orange_slice", name: "Апельсин слайс", unit: "шт", pricePerUnit: 0 },
  { id: "ing_lemon_slice", name: "Лимон слайс", unit: "шт", pricePerUnit: 0 },
  { id: "ing_cucumber_slice", name: "Долька огурца", unit: "шт", pricePerUnit: 0 },
];

// ─── Дефолтные рецепты ────────────────────────────────────────────

const DEFAULT_RECIPES = [
  // ═══════════════════════════════════════════════════════════════════
  // КОФЕЙНЫЕ НАПИТКИ (горячие)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_americano_hot", name: "Американо", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_milk", qty: 85, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
      { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
    ],
  },
  {
    id: "rec_latte_hot", name: "Латте", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_milk", qty: 315, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
      { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
    ],
  },
  {
    id: "rec_cappuccino", name: "Капучино", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_milk", qty: 275, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
      { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
    ],
  },
  {
    id: "rec_flat_white", name: "Флэт Уайт", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 3, unit: "шт" },
      { ingredientId: "ing_milk", qty: 200, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
    ],
  },
  {
    id: "rec_raf", name: "Раф", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_cream33", qty: 65, unit: "г" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
      { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
    ],
  },
  {
    id: "rec_raf_orange", name: "Раф Апельсиновый", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_cream33", qty: 65, unit: "г" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
      { ingredientId: "ing_orange", qty: 4, unit: "шт" },
      { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
    ],
  },
  {
    id: "rec_mocha", name: "Мокко", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_milk", qty: 275, unit: "мл" },
      { ingredientId: "ing_choc_paste", qty: 25, unit: "г" },
      { ingredientId: "ing_cream10", qty: 15, unit: "г" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
      { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
    ],
  },
  {
    id: "rec_hot_bumble", name: "Горячий Бамбл", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_orange_juice", qty: 315, unit: "мл" },
      { ingredientId: "ing_orange_slice", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // КОФЕЙНЫЕ НАПИТКИ (холодные)
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_ice_americano", name: "Айс Американо", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_water", qty: 200, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" },
    ],
  },
  {
    id: "rec_ice_latte", name: "Айс Латте", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_milk", qty: 250, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
    ],
  },
  {
    id: "rec_ice_cappuccino", name: "Айс Капучино", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_milk", qty: 250, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 15, unit: "г" },
    ],
  },
  {
    id: "rec_frappuccino", name: "Фраппучино", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_icecream_vanilla", qty: 100, unit: "г" },
      { ingredientId: "ing_ice", qty: 110, unit: "г" },
      { ingredientId: "ing_milk", qty: 120, unit: "мл" },
      { ingredientId: "ing_honey", qty: 15, unit: "г" },
      { ingredientId: "ing_cinnamon", qty: 0.5, unit: "г" },
      // Сырная пенка
      { ingredientId: "ing_milk", qty: 20, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 40, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" },
      { ingredientId: "ing_honey", qty: 0.3, unit: "г" },
    ],
  },
  {
    id: "rec_glace", name: "Глиссе", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_icecream_vanilla", qty: 150, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 20, unit: "г" },
    ],
  },
  {
    id: "rec_espresso_tonic", name: "Эспрессо Тоник", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_tonic", qty: 250, unit: "мл" },
      { ingredientId: "ing_ice", qty: 15, unit: "г" },
      { ingredientId: "ing_mint", qty: 2, unit: "шт" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ГОРЯЧИЙ ШОКОЛАД / МОЛОЧНЫЕ КОКТЕЙЛИ
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_hot_chocolate", name: "Горячий Шоколад", category: "Десерт", salePrice: 0,
    items: [
      { ingredientId: "ing_choc_granules", qty: 30, unit: "г" },
      { ingredientId: "ing_cocoa", qty: 4, unit: "г" },
      { ingredientId: "ing_milk", qty: 315, unit: "мл" },
      { ingredientId: "ing_cream10", qty: 80, unit: "г" },
    ],
  },
  {
    id: "rec_milkshake_banana_caramel", name: "Милкшейк Банан-Карамель", category: "Милкшейк", salePrice: 0,
    items: [
      { ingredientId: "ing_icecream_vanilla", qty: 120, unit: "г" },
      { ingredientId: "ing_milk", qty: 150, unit: "мл" },
      { ingredientId: "ing_syrup_caramel", qty: 10, unit: "г" },
      { ingredientId: "ing_banana", qty: 40, unit: "г" },
      // Сырная пенка
      { ingredientId: "ing_milk", qty: 20, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 40, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" },
      { ingredientId: "ing_honey", qty: 0.3, unit: "г" },
    ],
  },
  {
    id: "rec_milkshake_vanilla", name: "Милкшейк Ванильный", category: "Милкшейк", salePrice: 0,
    items: [
      { ingredientId: "ing_icecream_vanilla", qty: 120, unit: "г" },
      { ingredientId: "ing_milk", qty: 150, unit: "мл" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" },
      // Сырная пенка
      { ingredientId: "ing_milk", qty: 20, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 40, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" },
      { ingredientId: "ing_honey", qty: 0.3, unit: "г" },
    ],
  },
  {
    id: "rec_milkshake_strawberry", name: "Милкшейк Клубничный", category: "Милкшейк", salePrice: 0,
    items: [
      { ingredientId: "ing_icecream_vanilla", qty: 120, unit: "г" },
      { ingredientId: "ing_milk", qty: 150, unit: "мл" },
      { ingredientId: "ing_syrup_strawberry", qty: 10, unit: "г" },
      { ingredientId: "ing_raspberry", qty: 40, unit: "г" },
      // Сырная пенка
      { ingredientId: "ing_milk", qty: 20, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 40, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" },
      { ingredientId: "ing_honey", qty: 0.3, unit: "г" },
    ],
  },
  {
    id: "rec_milkshake_chocolate", name: "Милкшейк Шоколадный", category: "Милкшейк", salePrice: 0,
    items: [
      { ingredientId: "ing_icecream_chocolate", qty: 120, unit: "г" },
      { ingredientId: "ing_milk", qty: 150, unit: "мл" },
      { ingredientId: "ing_syrup_chocolate", qty: 10, unit: "г" },
      { ingredientId: "ing_cocoa", qty: 4, unit: "г" },
      // Сырная пенка
      { ingredientId: "ing_milk", qty: 20, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 40, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" },
      { ingredientId: "ing_honey", qty: 0.3, unit: "г" },
    ],
  },
  {
    id: "rec_milkshake_oreo", name: "Милкшейк Oreo", category: "Милкшейк", salePrice: 0,
    items: [
      { ingredientId: "ing_icecream_vanilla", qty: 120, unit: "г" },
      { ingredientId: "ing_milk", qty: 150, unit: "мл" },
      { ingredientId: "ing_syrup_iris", qty: 10, unit: "г" },
      { ingredientId: "ing_oreo", qty: 4, unit: "шт" },
      // Сырная пенка
      { ingredientId: "ing_milk", qty: 20, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 40, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" },
      { ingredientId: "ing_honey", qty: 0.3, unit: "г" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // МАТЧА
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_matcha_latte", name: "Матча Латте", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_matcha", qty: 4, unit: "г" },
      { ingredientId: "ing_matcha", qty: 40, unit: "г" },
      { ingredientId: "ing_milk", qty: 330, unit: "мл" },
    ],
  },
  {
    id: "rec_matcha_latte_cold", name: "Айс Матча Латте", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_matcha", qty: 4, unit: "г" },
      { ingredientId: "ing_matcha", qty: 40, unit: "г" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_milk", qty: 250, unit: "мл" },
    ],
  },
  {
    id: "rec_matcha_frappe", name: "Матча Фрапе", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_icecream_vanilla", qty: 100, unit: "г" },
      { ingredientId: "ing_ice", qty: 110, unit: "г" },
      { ingredientId: "ing_milk", qty: 120, unit: "мл" },
      { ingredientId: "ing_matcha", qty: 4, unit: "г" },
      { ingredientId: "ing_matcha", qty: 40, unit: "г" },
      // Сырная пенка
      { ingredientId: "ing_milk", qty: 20, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 40, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 10, unit: "г" },
      { ingredientId: "ing_honey", qty: 0.3, unit: "г" },
    ],
  },
  {
    id: "rec_matcha_tonic", name: "Матча Тоник", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_matcha", qty: 4, unit: "г" },
      { ingredientId: "ing_matcha", qty: 40, unit: "г" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_tonic", qty: 250, unit: "мл" },
    ],
  },
  {
    id: "rec_matcha_trounik", name: "Матча Троник", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_matcha", qty: 4, unit: "г" },
      { ingredientId: "ing_matcha", qty: 40, unit: "г" },
      { ingredientId: "ing_pineapple_juice", qty: 200, unit: "мл" },
      { ingredientId: "ing_mango", qty: 40, unit: "г" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ЛЕТНИЙ СПЕШЛ
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_02_green", name: "02 Green", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_prep_green", qty: 100, unit: "мл" },
      { ingredientId: "ing_soda", qty: 200, unit: "мл" },
      { ingredientId: "ing_cucumber_slice", qty: 1, unit: "шт" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_02_peach_chill", name: "02 Peach Chill", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_prep_raspberry", qty: 40, unit: "г" },
      { ingredientId: "ing_prep_peach", qty: 60, unit: "г" },
      { ingredientId: "ing_tea_black", qty: 210, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_02_paris_story", name: "02 Paris Story", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_elixir_pistachio", qty: 10, unit: "мл" },
      { ingredientId: "ing_elixir_raspberry", qty: 10, unit: "мл" },
      { ingredientId: "ing_milk", qty: 135, unit: "мл" },
      { ingredientId: "ing_ice", qty: 110, unit: "г" },
      { ingredientId: "ing_icecream_vanilla", qty: 100, unit: "г" },
      { ingredientId: "ing_matcha", qty: 3.5, unit: "г" },
      { ingredientId: "ing_matcha", qty: 35, unit: "г" },
      // Пенка
      { ingredientId: "ing_milk", qty: 20, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 35, unit: "г" },
      { ingredientId: "ing_syrup_vanilla", qty: 8, unit: "г" },
      { ingredientId: "ing_honey", qty: 0.02, unit: "г" },
    ],
  },
  {
    id: "rec_02_matcha_cloud", name: "02 Matcha Cloud", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_matcha", qty: 2.5, unit: "г" },
      { ingredientId: "ing_matcha", qty: 15, unit: "г" },
      { ingredientId: "ing_syrup_sugar", qty: 25, unit: "мл" },
      { ingredientId: "ing_cream33", qty: 40, unit: "г" },
      { ingredientId: "ing_milk", qty: 50, unit: "мл" },
      { ingredientId: "ing_pineapple_juice", qty: 180, unit: "мл" },
      { ingredientId: "ing_elixir_coconut", qty: 12, unit: "мл" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
    ],
  },
  {
    id: "rec_02_coffee_cloud", name: "02 Coffee Cloud", category: "Кофе", salePrice: 0,
    items: [
      { ingredientId: "ing_prep_peach", qty: 50, unit: "г" },
      { ingredientId: "ing_elixir_coconut", qty: 12, unit: "мл" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_milk", qty: 160, unit: "мл" },
      // Пенка
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
      { ingredientId: "ing_cream33", qty: 50, unit: "г" },
      { ingredientId: "ing_milk", qty: 50, unit: "мл" },
    ],
  },
  {
    id: "rec_02_sunset_flow", name: "02 Sunset Flow", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_prep_raspberry", qty: 50, unit: "г" },
      { ingredientId: "ing_prep_peach", qty: 50, unit: "г" },
      { ingredientId: "ing_prep_citrus", qty: 12, unit: "мл" },
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_tonic", qty: 150, unit: "мл" },
      { ingredientId: "ing_coffee", qty: 2, unit: "шт" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ЛИМОНАДЫ
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_lemonade_basil_citrus", name: "Лимонад Базилик-Цитрус", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_basil", qty: 60, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 40, unit: "г" },
      { ingredientId: "ing_soda", qty: 200, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_lemon_slice", qty: 15, unit: "г" },
    ],
  },
  {
    id: "rec_lemonade_blueberry", name: "Лимонад Голубика-Лимон", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_blueberry_mix", qty: 80, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 20, unit: "г" },
      { ingredientId: "ing_soda", qty: 200, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_lemon_slice", qty: 15, unit: "г" },
    ],
  },
  {
    id: "rec_lemonade_classic", name: "Лимонад Классический", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 50, unit: "г" },
      { ingredientId: "ing_syrup_sugar", qty: 50, unit: "г" },
      { ingredientId: "ing_soda", qty: 200, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_lemon_slice", qty: 15, unit: "г" },
    ],
  },
  {
    id: "rec_lemonade_seabuckthorn", name: "Лимонад Облепиха-Цитрус", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_seabuckthorn_mix", qty: 80, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 20, unit: "г" },
      { ingredientId: "ing_soda", qty: 200, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1.5, unit: "шт" },
    ],
  },
  {
    id: "rec_lemonade_raspberry_passion", name: "Лимонад Малина-Маракуйя", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_prep_raspberry_passion", qty: 50, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 25, unit: "г" },
      { ingredientId: "ing_syrup_sugar", qty: 25, unit: "г" },
      { ingredientId: "ing_soda", qty: 200, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1.5, unit: "шт" },
    ],
  },
  {
    id: "rec_lemonade_cherry", name: "Лимонад Ледяная Вишня", category: "Лимонад", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_cherry_mint_mix", qty: 120, unit: "г" },
      { ingredientId: "ing_soda", qty: 150, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1.5, unit: "шт" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // СМУЗИ
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_smoothie_green", name: "Смузи Зелёный", category: "Смузи", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 15, unit: "г" },
      { ingredientId: "ing_banana", qty: 80, unit: "г" },
      { ingredientId: "ing_apple", qty: 80, unit: "г" },
      { ingredientId: "ing_kiwi", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_water", qty: 190, unit: "мл" },
    ],
  },
  {
    id: "rec_smoothie_kiwi_banana", name: "Смузи Киви-Банан", category: "Смузи", salePrice: 0,
    items: [
      { ingredientId: "ing_kiwi", qty: 85, unit: "г" },
      { ingredientId: "ing_banana", qty: 90, unit: "г" },
      { ingredientId: "ing_kiwi", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_water", qty: 170, unit: "мл" },
    ],
  },
  {
    id: "rec_smoothie_mango_passion", name: "Смузи Манго-Маракуйя", category: "Смузи", salePrice: 0,
    items: [
      { ingredientId: "ing_mango", qty: 62, unit: "г" },
      { ingredientId: "ing_raspberry", qty: 62, unit: "г" },
      { ingredientId: "ing_banana", qty: 80, unit: "г" },
      { ingredientId: "ing_kiwi", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_ice", qty: 60, unit: "г" },
      { ingredientId: "ing_water", qty: 170, unit: "мл" },
    ],
  },
  {
    id: "rec_smoothie_kiwi_strawberry", name: "Смузи Киви-Клубника", category: "Смузи", salePrice: 0,
    items: [
      { ingredientId: "ing_kiwi", qty: 80, unit: "г" },
      { ingredientId: "ing_raspberry", qty: 80, unit: "г" },
      { ingredientId: "ing_banana", qty: 80, unit: "г" },
      { ingredientId: "ing_kiwi", qty: 1.5, unit: "шт" },
      { ingredientId: "ing_water", qty: 170, unit: "мл" },
    ],
  },
  {
    id: "rec_smoothie_apple_dates", name: "Смузи Яблоко-Финик", category: "Смузи", salePrice: 0,
    items: [
      { ingredientId: "ing_kiwi", qty: 75, unit: "г" },
      { ingredientId: "ing_banana", qty: 80, unit: "г" },
      { ingredientId: "ing_apple", qty: 90, unit: "г" },
      { ingredientId: "ing_ice", qty: 52, unit: "г" },
      { ingredientId: "ing_milk", qty: 190, unit: "мл" },
    ],
  },
  {
    id: "rec_smoothie_berry", name: "Смузи Ягодный", category: "Смузи", salePrice: 0,
    items: [
      { ingredientId: "ing_pre_blueberry_mix", qty: 45, unit: "г" },
      { ingredientId: "ing_prep_raspberry", qty: 30, unit: "г" },
      { ingredientId: "ing_currant_rosemary", qty: 30, unit: "г" },
      { ingredientId: "ing_banana", qty: 80, unit: "г" },
      { ingredientId: "ing_kiwi", qty: 2.5, unit: "шт" },
      { ingredientId: "ing_water", qty: 170, unit: "мл" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ГОРЯЧИЕ ЧАИ
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_tea_tashkent", name: "Чай Ташкентский", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_green", qty: 12, unit: "г" },
      { ingredientId: "ing_tea_assam", qty: 5, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 12, unit: "г" },
      { ingredientId: "ing_honey", qty: 30, unit: "г" },
      { ingredientId: "ing_lemon_slice", qty: 15, unit: "г" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_tea_blueberry_lemon", name: "Чай Голубика-Лимон", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_green", qty: 10, unit: "г" },
      { ingredientId: "ing_pre_blueberry_mix", qty: 70, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 17, unit: "г" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_tea_cherry_mint", name: "Чай Вишня-мята", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_bergamot", qty: 5, unit: "г" },
      { ingredientId: "ing_pre_cherry_mint_mix", qty: 90, unit: "г" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_tea_currant_rosemary", name: "Чай Смородина-розмарин", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_bergamot", qty: 5, unit: "г" },
      { ingredientId: "ing_pre_currant_mint", qty: 90, unit: "г" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_tea_raspberry_grapefruit", name: "Чай Малина-грейпфрут", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_assam", qty: 5, unit: "г" },
      { ingredientId: "ing_prep_raspberry", qty: 50, unit: "г" },
      { ingredientId: "ing_grapefruit_juice", qty: 30, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_tea_seabuckthorn_apple", name: "Чай Облепиха-Яблоко", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_green", qty: 10, unit: "г" },
      { ingredientId: "ing_pre_seabuckthorn_mix", qty: 90, unit: "г" },
      { ingredientId: "ing_apple", qty: 17, unit: "г" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_tea_moroccan", name: "Чай Марокканский", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_bergamot", qty: 5, unit: "г" },
      { ingredientId: "ing_honey", qty: 35, unit: "г" },
      { ingredientId: "ing_cinnamon", qty: 0.75, unit: "г" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_tea_ginger_citrus", name: "Чай Имбирь-Цитрус", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_bergamot", qty: 5, unit: "г" },
      { ingredientId: "ing_ginger", qty: 17, unit: "г" },
      { ingredientId: "ing_syrup_sugar", qty: 29, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 12, unit: "г" },
      { ingredientId: "ing_cinnamon", qty: 0.75, unit: "г" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_tea_plain", name: "Чай Обычный", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_tea_black", qty: 1, unit: "шт" },
      { ingredientId: "ing_milk", qty: 100, unit: "мл" },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════
  // ХОЛОДНЫЕ ЧАИ
  // ═══════════════════════════════════════════════════════════════════

  {
    id: "rec_ice_tea_blueberry_lemon", name: "Айс Ти Голубика-Лимон", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_blueberry_mix", qty: 80, unit: "г" },
      { ingredientId: "ing_pre_citrus_mix", qty: 20, unit: "г" },
      { ingredientId: "ing_tea_green", qty: 200, unit: "мл" },
      { ingredientId: "ing_lemon_slice", qty: 15, unit: "г" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_ice_tea_cherry_mint", name: "Айс Ти Вишня-мята", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_cherry_mint_mix", qty: 100, unit: "г" },
      { ingredientId: "ing_tea_green", qty: 220, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_ice_tea_currant_rosemary", name: "Айс Ти Смородина-Розмарин", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_currant_mint", qty: 100, unit: "г" },
      { ingredientId: "ing_water", qty: 220, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_ice_tea_raspberry_grapefruit", name: "Айс Ти Малина-Грейпфрут", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_prep_raspberry", qty: 60, unit: "г" },
      { ingredientId: "ing_grapefruit_juice", qty: 40, unit: "мл" },
      { ingredientId: "ing_tea_assam", qty: 200, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
  {
    id: "rec_ice_tea_seabuckthorn_apple", name: "Айс Ти Облепиха-Яблоко", category: "Чай", salePrice: 0,
    items: [
      { ingredientId: "ing_ice", qty: 150, unit: "г" },
      { ingredientId: "ing_pre_seabuckthorn_mix", qty: 100, unit: "г" },
      { ingredientId: "ing_apple", qty: 17, unit: "г" },
      { ingredientId: "ing_water", qty: 220, unit: "мл" },
      { ingredientId: "ing_mint", qty: 1, unit: "шт" },
    ],
  },
];

// ─── Дополнительные единицы ────────────────────────────────────────

export const UNITS = ["кг", "г", "л", "мл", "шт"];

// ─── Категории ────────────────────────────────────────────────────

export const PRODUCT_CATEGORIES = [
  "Кофе",
  "Чай",
  "Лимонад",
  "Смузи",
  "Милкшейк",
  "Десерт",
  "Другое",
];

// ─── Загрузка / сохранение ─────────────────────────────────────────

let cached = null;

export async function loadMargin() {
  if (cached) return cached;
  try {
    const snap = await getDoc(doc(getDb(), SETTINGS_DOC));
    if (snap.exists()) {
      cached = snap.data();
      return cached;
    }
  } catch (e) {
    console.warn("[Margin] load error:", e);
  }
  // First load — populate with defaults
  const data = {
    ingredients: DEFAULT_INGREDIENTS,
    recipes: DEFAULT_RECIPES,
    updatedAt: Date.now(),
  };
  try {
    await setDoc(doc(getDb(), SETTINGS_DOC), data);
  } catch {}
  cached = data;
  return data;
}

export async function saveMargin(data) {
  const payload = { ...data, updatedAt: Date.now() };
  await setDoc(doc(getDb(), SETTINGS_DOC), payload);
  cached = payload;
  return payload;
}

export function clearMarginCache() {
  cached = null;
}

// ─── Расчёт стоимости рецепта ─────────────────────────────────────

export function calcRecipeCost(ingredients, recipe) {
  let total = 0;
  for (const item of recipe.items || []) {
    const ing = ingredients.find((i) => i.id === item.ingredientId);
    if (!ing) continue;
    total += convertToBaseAndCost(ing, item.qty, item.unit);
  }
  return total;
}

function convertToBaseAndCost(ingredient, qty, unit) {
  const ppu = ingredient.pricePerUnit || 0;
  const baseUnit = ingredient.unit || "шт";
  let baseQty = qty;
  if (unit === "г" && (baseUnit === "кг" || baseUnit === "л")) baseQty = qty / 1000;
  else if (unit === "кг" && (baseUnit === "г" || baseUnit === "мл")) baseQty = qty * 1000;
  else if (unit === "мл" && baseUnit === "л") baseQty = qty / 1000;
  else if (unit === "л" && (baseUnit === "мл" || baseUnit === "г")) baseQty = qty * 1000;
  return baseQty * ppu;
}

export function getIngredientCostPerUnit(ingredient, qty, unit) {
  return convertToBaseAndCost(ingredient, qty, unit);
}
