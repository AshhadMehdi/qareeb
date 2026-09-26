/**
 * Demo data for Abbottabad.
 *
 * Everything below is realistic on purpose: real neighbourhood names and
 * coordinates, PKR prices that match a 2026 karyana, riders parked near the
 * shops they serve, and two weeks of order history so the admin dashboard has
 * something to chart. `npm run db:seed` re-runs it; `npm run db:reset` wipes
 * first. Passwords come from DEMO_PASSWORD (default: password123).
 */
import { and, eq, sql } from 'drizzle-orm';
import { env } from '../env.js';
import { getDb } from '../db/client.js';
import {
  addresses,
  auditLogs,
  campaigns,
  deliveryZones,
  favorites,
  messages,
  notifications,
  orderEvents,
  orderItems,
  orders,
  paymentTransactions,
  products,
  promos,
  pushSubscriptions,
  realtimeEvents,
  refreshTokens,
  reviews,
  runnerProfiles,
  serviceAreas,
  settings,
  payoutRequests,
  shopRunners,
  shops,
  supportTickets,
  ticketMessages,
  users,
  type DeliveryAddressSnapshot,
  type OrderStatus,
  type PaymentMethod,
  type UserRole,
} from './schema.js';
import { hashPassword } from '../lib/auth.js';
import { defaultHours } from '../lib/geo.js';
import { newId, orderNumber, slugify } from '../lib/ids.js';
import { DEFAULT_SETTINGS } from '../lib/pricing.js';

/* -------------------------------------------------------------------------- */
/* Deterministic randomness                                                   */
/* -------------------------------------------------------------------------- */

let rngState = 20260923;
function random(): number {
  rngState = (rngState * 1103515245 + 12345) % 2147483648;
  return rngState / 2147483648;
}
const pick = <T,>(list: readonly T[]): T => list[Math.floor(random() * list.length)] as T;
const between = (min: number, max: number) => min + random() * (max - min);

const iso = (daysAgo: number, hour = 12, minute = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
};

/* -------------------------------------------------------------------------- */
/* Products                                                                   */
/* -------------------------------------------------------------------------- */

type SeedProduct = {
  name: string;
  category: string;
  unit: string;
  price: number;
  compareAt?: number;
  emoji: string;
  description?: string;
  stock?: number;
  featured?: boolean;
  /** dish photography served from the client's /images folder */
  image?: string;
};

type ProductTuple = [name: string, category: string, unit: string, price: number, emoji: string, extra?: Partial<SeedProduct>];

const toProducts = (tuples: ProductTuple[]): SeedProduct[] =>
  tuples.map(([name, category, unit, price, emoji, extra]) => ({ name, category, unit, price, emoji, ...extra }));

const KARYANA: SeedProduct[] = toProducts([
  ['Fresh Milk (Doodh)', 'Dairy & Eggs', '1 litre', 220, 'milk', { stock: 60, featured: true }],
  ['Dahi (Yoghurt)', 'Dairy & Eggs', '500 g', 180, 'yogurt', { stock: 40 }],
  ['Eggs (Anday)', 'Dairy & Eggs', 'dozen', 340, 'egg', { stock: 35, featured: true }],
  ['Chakki Atta', 'Flour & Rice', '5 kg', 1150, 'bread', { stock: 25 }],
  ['Basmati Rice (Sella)', 'Flour & Rice', '5 kg', 2450, 'rice', { stock: 18, compareAt: 2650 }],
  ['Sugar (Cheeni)', 'Cooking', '1 kg', 175, 'sugar', { stock: 80 }],
  ['Cooking Oil (Dalda)', 'Cooking', '1 litre', 620, 'oil', { stock: 30, featured: true }],
  ['Tapal Danedar Tea', 'Beverages', '250 g', 480, 'tea', { stock: 44 }],
  ['National Salt', 'Cooking', '800 g', 60, 'salt', { stock: 90 }],
  ['Red Chilli Powder', 'Cooking', '100 g', 120, 'chili', { stock: 55 }],
  ['Masoor Dal', 'Pulses', '1 kg', 380, 'legume', { stock: 32 }],
  ['Kabuli Chana', 'Pulses', '1 kg', 420, 'legume', { stock: 28 }],
  ['Dawn Bread Large', 'Bakery', 'large', 180, 'bread', { stock: 40 }],
  ['Lifebuoy Soap', 'Household', '1 bar', 130, 'soap', { stock: 70 }],
  ['Surf Excel Washing Powder', 'Household', '1 kg', 750, 'detergent', { stock: 26, compareAt: 820 }],
  ['Sunsilk Shampoo', 'Personal Care', '200 ml', 480, 'shampoo', { stock: 22 }],
]);

const SABZI: SeedProduct[] = toProducts([
  ['Potatoes (Aloo)', 'Roots', '1 kg', 90, 'potato', { stock: 120, featured: true }],
  ['Onions (Pyaz)', 'Roots', '1 kg', 120, 'onion', { stock: 110, featured: true }],
  ['Tomatoes (Tamatar)', 'Fresh', '1 kg', 140, 'tomato', { stock: 95 }],
  ['Lady Finger (Bhindi)', 'Fresh', '500 g', 160, 'cucumber', { stock: 40 }],
  ['Spinach (Palak)', 'Leafy', 'bundle', 60, 'leafy-green', { stock: 45 }],
  ['Carrots (Gajar)', 'Roots', '1 kg', 110, 'carrot', { stock: 50 }],
  ['Cucumber (Kheera)', 'Fresh', '1 kg', 130, 'cucumber', { stock: 48 }],
  ['Coriander (Dhania)', 'Leafy', 'bundle', 40, 'herb', { stock: 60 }],
  ['Green Chillies (Hari Mirch)', 'Fresh', '250 g', 70, 'chili', { stock: 55 }],
  ['Peas (Matar)', 'Fresh', '1 kg', 260, 'pea', { stock: 30 }],
  ['Cauliflower (Gobi)', 'Fresh', '1 kg', 190, 'broccoli', { stock: 22 }],
  ['Lemon (Nimbu)', 'Fresh', '250 g', 80, 'lemon', { stock: 44 }],
]);

const MEAT: SeedProduct[] = toProducts([
  ['Chicken Broiler (Whole)', 'Chicken', '1 kg', 620, 'chicken', { stock: 25, featured: true }],
  ['Chicken Breast Boneless', 'Chicken', '1 kg', 900, 'chicken', { stock: 15 }],
  ['Chicken Mince (Keema)', 'Chicken', '1 kg', 850, 'chicken', { stock: 12 }],
  ['Beef Chuck', 'Beef', '1 kg', 1250, 'beef', { stock: 18 }],
  ['Beef Mince', 'Beef', '1 kg', 1350, 'beef', { stock: 14 }],
  ['Mutton Leg', 'Mutton', '1 kg', 2200, 'meat', { stock: 8 }],
  ['Beef Seekh Kebab (ready)', 'Ready', '500 g', 900, 'kebab', { stock: 20, featured: true }],
  ['Chicken Tikka (ready)', 'Ready', '500 g', 780, 'poultry-leg', { stock: 16 }],
  ['Rahu Fish', 'Fish', '1 kg', 1100, 'fish', { stock: 6 }],
  ['Beef Bones (Haddi)', 'Beef', '1 kg', 350, 'bone', { stock: 20 }],
]);

const BAKERY: SeedProduct[] = toProducts([
  ['Fresh Bakery Bread', 'Bread', 'large', 160, 'bread', { stock: 40, featured: true }],
  ['Cake Rusk', 'Bakery', '350 g', 320, 'cookie', { stock: 30 }],
  ['Chocolate Fudge Cake', 'Cakes', '1 lb', 1400, 'cake', { stock: 8, featured: true, image: '/images/sweets.jpg', compareAt: 1600 }],
  ['Vanilla Sponge Cake', 'Cakes', '1 lb', 1100, 'cake', { stock: 10, image: '/images/sweets.jpg' }],
  ['Chicken Patties', 'Savoury', 'piece', 120, 'pie', { stock: 35 }],
  ['Nan Khatai', 'Bakery', '500 g', 450, 'cookie', { stock: 24 }],
  ['Cream Roll', 'Sweets', 'piece', 60, 'ice-cream', { stock: 60 }],
  ['Gulab Jamun', 'Sweets', '500 g', 620, 'sweet', { stock: 18, featured: true, image: '/images/sweets.jpg' }],
  ['Bakarkhani', 'Bread', 'piece', 90, 'flat bread', { stock: 28 }],
]);

const PHARMACY_SEHAT: SeedProduct[] = toProducts([
  ['Panadol 500 mg', 'Pain Relief', '10 tablets', 60, 'pill', { stock: 120, featured: true }],
  ['Brufen 400 mg', 'Pain Relief', '10 tablets', 120, 'pill', { stock: 80 }],
  ['ORS Sachet', 'Hydration', 'sachet', 40, 'glass of water', { stock: 150, featured: true }],
  ['Vitamin D3 2000 IU', 'Vitamins', '30 capsules', 650, 'pill', { stock: 40 }],
  ['Cough Syrup (Broncho)', 'Cold & Flu', '120 ml', 260, 'syrup', { stock: 35 }],
  ['Face Masks', 'Essentials', 'pack of 10', 180, 'mask', { stock: 60 }],
  ['Hand Sanitizer', 'Essentials', '250 ml', 320, 'lotion', { stock: 45 }],
  ['Digital Thermometer', 'Devices', 'piece', 450, 'thermometer', { stock: 12 }],
  ['Band-Aid', 'First Aid', 'pack of 20', 90, 'bandage', { stock: 70 }],
]);

const DAIRY: SeedProduct[] = toProducts([
  ['Raw Desi Milk', 'Milk', '1 litre', 240, 'milk', { stock: 50, featured: true, image: '/images/dairy.jpg' }],
  ['Dahi', 'Milk', '1 kg', 300, 'yogurt', { stock: 30, image: '/images/dairy.jpg' }],
  ['Lassi', 'Milk', '1 litre', 250, 'cup with straw', { stock: 25 }],
  ['Butter', 'Dairy', '200 g', 550, 'butter', { stock: 18, image: '/images/dairy.jpg' }],
  ['Desi Ghee', 'Dairy', '1 kg', 3200, 'butter', { stock: 10, featured: true }],
  ['Paneer', 'Cheese', '500 g', 900, 'cheese', { stock: 14, image: '/images/dairy.jpg' }],
  ['Cheese Slices', 'Cheese', '200 g', 700, 'cheese', { stock: 16 }],
  ['Fresh Cream', 'Dairy', '200 ml', 220, 'ice-cream', { stock: 22 }],
]);

const FRUIT: SeedProduct[] = toProducts([
  ['Kala Kulu Apples', 'Apples', '1 kg', 350, 'apple', { stock: 40, featured: true }],
  ['Bananas', 'Bananas', 'dozen', 200, 'banana', { stock: 55 }],
  ['Chaunsa Mango', 'Mango', '1 kg', 450, 'mango', { stock: 30 }],
  ['Grapes (Sundar Khani)', 'Grapes', '1 kg', 500, 'grapes', { stock: 22 }],
  ['Anar (Pomegranate)', 'Seasonal', '1 kg', 620, 'pomegranate', { stock: 18 }],
  ['Malta (Orange)', 'Citrus', '1 kg', 280, 'orange', { stock: 36 }],
  ['Watermelon', 'Melon', '1 kg', 90, 'watermelon', { stock: 60 }],
  ['Papaya', 'Melon', '1 kg', 220, 'papaya', { stock: 24 }],
]);

const GENERAL: SeedProduct[] = toProducts([
  ['Lays Masala Chips', 'Snacks', 'large pack', 150, 'chips', { stock: 80, featured: true }],
  ['Coca-Cola', 'Cold Drinks', '1.5 litre', 220, 'bottle', { stock: 60 }],
  ['Sting Energy Drink', 'Cold Drinks', '500 ml', 130, 'bottle', { stock: 70 }],
  ['Sooper Biscuits', 'Bakery', 'family pack', 180, 'cookie', { stock: 65 }],
  ['Nestle Water', 'Water', '1.5 litre', 90, 'water', { stock: 120 }],
  ['Ketchup (National)', 'Sauces', '500 g', 380, 'tomato', { stock: 30 }],
  ['Mayonnaise', 'Sauces', '500 g', 420, 'jar', { stock: 26 }],
  ['Masala Packets (Shan)', 'Cooking', 'packet', 130, 'spice', { stock: 90 }],
  ['Candles Pack', 'Household', 'pack of 6', 110, 'candle', { stock: 40 }],
  ['Match Box', 'Household', 'pack of 10', 60, 'fire', { stock: 85 }],
]);

/* -------------------------------------------------------------------------- */
/* Shops                                                                      */
/* -------------------------------------------------------------------------- */


/* ---------------------------------------------------------------------------
   Food catalogue. The neighbourhood shops above keep Qareeb useful; these
   kitchens are what make the home screen feel like a food app.
--------------------------------------------------------------------------- */
const BIRYANI: SeedProduct[] = toProducts([
  ['Chicken Biryani', 'Biryani', 'plate', 380, 'rice', { stock: 40, featured: true, image: '/images/biryani.jpg', description: 'Long-grain basmati layered with chicken, kewra and fried onion. Raita and salad included.' }],
  ['Beef Biryani', 'Biryani', 'plate', 450, 'rice', { stock: 30, image: '/images/biryani.jpg' }],
  ['Chicken Pulao', 'Biryani', 'plate', 340, 'rice', { stock: 30, image: '/images/biryani.jpg' }],
  ['Sindhi Biryani', 'Biryani', 'plate', 420, 'rice', { stock: 24, image: '/images/biryani.jpg' }],
  ['Biryani Family Deal', 'Deals', 'serves 4', 1450, 'rice', { stock: 12, image: '/images/biryani.jpg', compareAt: 1650, description: 'Four plates of chicken biryani, raita, salad and a bottle of drink.' }],
  ['Raita', 'Sides', 'bowl', 80, 'bowl', { stock: 60 }],
  ['Shami Kebab', 'Sides', '4 pieces', 240, 'meat', { stock: 20 }],
  ['Soft Drink', 'Drinks', '1.5 litre', 180, 'drink', { stock: 50 }],
]);

const KARAHI: SeedProduct[] = toProducts([
  ['Chicken Karahi', 'Karahi', 'half kg', 1250, 'meat', { stock: 18, featured: true, image: '/images/karahi.jpg', description: 'Cooked to order in a black wok with tomato, ginger and green chilli. Naan not included.' }],
  ['Mutton Karahi', 'Karahi', 'half kg', 1950, 'meat', { stock: 10, image: '/images/karahi.jpg' }],
  ['Chicken Handi', 'Karahi', 'half kg', 1150, 'meat', { stock: 16, image: '/images/karahi.jpg' }],
  ['Daal Makhani', 'Curry', 'serves 2', 620, 'bowl', { stock: 20 }],
  ['Garlic Naan', 'Bread', 'piece', 90, 'bread', { stock: 80 }],
  ['Tandoori Naan', 'Bread', 'piece', 40, 'bread', { stock: 120 }],
  ['Green Salad', 'Sides', 'bowl', 150, 'bowl', { stock: 30 }],
  ['Kashmiri Chai', 'Drinks', 'cup', 180, 'drink', { stock: 40 }],
]);

const BBQ: SeedProduct[] = toProducts([
  ['Mixed BBQ Platter', 'BBQ', 'serves 2', 1650, 'meat', { stock: 14, featured: true, image: '/images/bbq-platter.jpg', description: 'Seekh kebab, chicken tikka, lamb chops, chutney and onion rings.' }],
  ['Chicken Tikka', 'BBQ', '2 pieces', 520, 'meat', { stock: 26, image: '/images/bbq-platter.jpg' }],
  ['Seekh Kebab', 'BBQ', '4 sticks', 640, 'meat', { stock: 22, image: '/images/bbq-platter.jpg' }],
  ['Lamb Chops', 'BBQ', '6 pieces', 1150, 'meat', { stock: 10, image: '/images/bbq-platter.jpg' }],
  ['Malai Boti', 'BBQ', 'plate', 720, 'meat', { stock: 18, image: '/images/bbq-platter.jpg' }],
  ['Roghni Naan', 'Bread', 'piece', 120, 'bread', { stock: 60 }],
  ['Mint Chutney', 'Sides', 'bowl', 70, 'bowl', { stock: 60 }],
]);

const CHAPLI: SeedProduct[] = toProducts([
  ['Peshawari Chapli Kebab', 'Kebab', '2 pieces', 650, 'meat', { stock: 22, featured: true, image: '/images/chapli-kebab.jpg', description: 'Coarse minced beef with coriander seed and tomato, shallow fried. Naan and chutney included.' }],
  ['Chapli Kebab (single)', 'Kebab', '1 piece', 340, 'meat', { stock: 40 }],
  ['Namkeen Boti', 'Kebab', 'plate', 780, 'meat', { stock: 14, image: '/images/chapli-kebab.jpg' }],
  ['Kabuli Pulao', 'Rice', 'plate', 520, 'rice', { stock: 18 }],
  ['Kabuli Naan', 'Bread', 'piece', 90, 'bread', { stock: 70 }],
  ['Doodh Patti', 'Drinks', 'cup', 150, 'drink', { stock: 50 }],
]);

const PIZZA: SeedProduct[] = toProducts([
  ['Chicken Tikka Pizza', 'Pizza', 'medium', 1150, 'pizza', { stock: 20, featured: true, image: '/images/pizza.jpg', description: 'Tandoori chicken, mozzarella, onion and green chilli on a wood-fired base.' }],
  ['Fajita Pizza', 'Pizza', 'medium', 1250, 'pizza', { stock: 18, image: '/images/pizza.jpg' }],
  ['Cheese Lover Pizza', 'Pizza', 'medium', 1050, 'pizza', { stock: 18, image: '/images/pizza.jpg' }],
  ['Crown Crust Pizza', 'Pizza', 'large', 1750, 'pizza', { stock: 10, image: '/images/pizza.jpg' }],
  ['Garlic Bread', 'Sides', '4 pieces', 380, 'bread', { stock: 30, image: '/images/pizza.jpg' }],
  ['Chicken Wings', 'Sides', '6 pieces', 620, 'meat', { stock: 24, image: '/images/bbq-platter.jpg' }],
  ['Soft Drink', 'Drinks', '1 litre', 160, 'drink', { stock: 40 }],
]);

const BURGER: SeedProduct[] = toProducts([
  ['Zinger Burger', 'Burgers', 'piece', 480, 'burger', { stock: 35, featured: true, image: '/images/burger.jpg', description: 'Crispy fillet, sesame bun, mayo, lettuce and pickles.' }],
  ['Beef Cheese Burger', 'Burgers', 'piece', 560, 'burger', { stock: 28, image: '/images/burger.jpg' }],
  ['Chicken Cheese Burger', 'Burgers', 'piece', 520, 'burger', { stock: 30, image: '/images/burger.jpg' }],
  ['Loaded Fries', 'Sides', 'regular', 420, 'fries', { stock: 30, image: '/images/burger.jpg' }],
  ['French Fries', 'Sides', 'regular', 250, 'fries', { stock: 40, image: '/images/burger.jpg' }],
  ['Chicken Nuggets', 'Sides', '6 pieces', 380, 'meat', { stock: 26 }],
  ['Cold Coffee', 'Drinks', 'glass', 350, 'drink', { stock: 25 }],
]);

const CHAI: SeedProduct[] = toProducts([
  ['Doodh Patti', 'Chai', 'cup', 150, 'drink', { stock: 60, featured: true, image: '/images/chai.jpg', description: 'Full-cream tea boiled slowly, served with a slice of cake or a samosa.' }],
  ['Karak Chai', 'Chai', 'cup', 130, 'drink', { stock: 60, image: '/images/chai.jpg' }],
  ['Green Tea', 'Chai', 'cup', 110, 'drink', { stock: 40 }],
  ['Samosa', 'Snacks', '2 pieces', 120, 'bowl', { stock: 45, image: '/images/chai.jpg' }],
  ['Chicken Patties', 'Snacks', 'piece', 180, 'bread', { stock: 30 }],
  ['Chocolate Cake Slice', 'Cakes', 'slice', 320, 'cake', { stock: 20, image: '/images/chai.jpg' }],
  ['Chai + Samosa Combo', 'Deals', 'serves 1', 240, 'drink', { stock: 40, image: '/images/chai.jpg', compareAt: 270 }],
]);

type SeedShop = {
  key: string;
  name: string;
  ownerEmail: string;
  ownerName: string;
  category: string;
  tags: string[];
  addressLine: string;
  area: string;
  lat: number;
  lng: number;
  prepTimeMin: number;
  minOrder: number;
  rating: number;
  ratingCount: number;
  products: SeedProduct[];
  hours?: Record<string, { open: string; close: string }>;
  deliveryMode?: 'PLATFORM_RIDER' | 'SHOP_DELIVERY';
  cover?: string;
};

const KITCHEN_KEYS = ['biryani', 'shinwari', 'khyber', 'peshawari', 'pizzapoint', 'burgerlab', 'chaikhana'];

const SHOPS: SeedShop[] = [
  {
    key: 'madina',
    name: 'Al-Madina Karyana Store',
    ownerEmail: 'madina@demo.com',
    ownerName: 'Imran Khan',
    category: 'grocery',
    tags: ['Grocery', 'Home delivery', 'Bulk packs'],
    addressLine: 'Shop 12, Supply Bazaar Road, Abbottabad',
    area: 'Supply Bazaar',
    lat: 34.15715,
    lng: 73.22195,
    prepTimeMin: 12,
    minOrder: 200,
    rating: 4.7,
    ratingCount: 128,
    products: KARYANA,
  },
  {
    key: 'sabzi',
    name: 'Al-Falah Sabzi Mandi',
    ownerEmail: 'sabzi@demo.com',
    ownerName: 'Naveed Ahmed',
    category: 'vegetables',
    tags: ['Fresh daily', 'Farm direct'],
    cover: '/images/produce.jpg',
    addressLine: 'Sabzi Mandi, Mandian, Abbottabad',
    area: 'Mandian',
    lat: 34.1688,
    lng: 73.2273,
    prepTimeMin: 10,
    minOrder: 150,
    rating: 4.5,
    ratingCount: 96,
    products: SABZI,
    hours: { monday: { open: '06:00', close: '21:00' }, tuesday: { open: '06:00', close: '21:00' }, wednesday: { open: '06:00', close: '21:00' }, thursday: { open: '06:00', close: '21:00' }, friday: { open: '06:00', close: '21:00' }, saturday: { open: '06:00', close: '21:00' }, sunday: { open: '07:00', close: '20:00' } },
  },
  {
    key: 'kakul',
    name: 'Kakul Meat House',
    ownerEmail: 'kakul@demo.com',
    ownerName: 'Shahid Mehmood',
    category: 'meat',
    tags: ['Halal', 'Cut to order', 'Chicken & mutton'],
    addressLine: 'Main Kakul Road, near PMA Gate, Abbottabad',
    area: 'Kakul Road',
    lat: 34.1806,
    lng: 73.2441,
    prepTimeMin: 20,
    minOrder: 500,
    rating: 4.6,
    ratingCount: 74,
    products: MEAT,
  },
  {
    key: 'mart',
    name: 'Qareeb Cash & Carry Mart',
    ownerEmail: 'mart@demo.com',
    ownerName: 'Usman Tariq',
    category: 'grocery',
    tags: ['Cash & carry', 'Monthly ration', 'Card accepted'],
    addressLine: 'Mandian Chowk, opposite PSO pump, Abbottabad',
    area: 'Mandian Chowk',
    lat: 34.16655,
    lng: 73.2287,
    prepTimeMin: 15,
    minOrder: 500,
    rating: 4.4,
    ratingCount: 152,
    products: [...KARYANA.slice(0, 10), ...GENERAL],
  },
  {
    key: 'roshan',
    name: 'Roshan Bakery & Sweets',
    ownerEmail: 'roshan@demo.com',
    ownerName: 'Zahid Hussain',
    category: 'bakery',
    cover: '/images/sweets.jpg',
    tags: ['Bakery', 'Mithai', 'Birthday cakes'],
    addressLine: 'Fawara Chowk, Abbottabad Cantt',
    area: 'Fawara Chowk',
    lat: 34.1557,
    lng: 73.2194,
    prepTimeMin: 18,
    minOrder: 200,
    rating: 4.8,
    ratingCount: 210,
    products: BAKERY,
    hours: { monday: { open: '07:00', close: '22:00' }, tuesday: { open: '07:00', close: '22:00' }, wednesday: { open: '07:00', close: '22:00' }, thursday: { open: '07:00', close: '22:00' }, friday: { open: '07:00', close: '22:00' }, saturday: { open: '07:00', close: '22:30' }, sunday: { open: '08:00', close: '22:00' } },
  },
  {
    key: 'sehat',
    name: 'Sehat Pharmacy',
    ownerEmail: 'sehat@demo.com',
    ownerName: 'Dr. Farhan Saeed',
    category: 'pharmacy',
    tags: ['Pharmacy', '24/7 delivery', 'Prescription'],
    addressLine: 'Shimla Hill Road, Abbottabad',
    area: 'Shimla Hill',
    lat: 34.1621,
    lng: 73.2154,
    prepTimeMin: 12,
    minOrder: 0,
    rating: 4.6,
    ratingCount: 88,
    products: PHARMACY_SEHAT,
    hours: { monday: { open: '08:00', close: '23:59' }, tuesday: { open: '08:00', close: '23:59' }, wednesday: { open: '08:00', close: '23:59' }, thursday: { open: '08:00', close: '23:59' }, friday: { open: '08:00', close: '23:59' }, saturday: { open: '08:00', close: '23:59' }, sunday: { open: '09:00', close: '23:00' } },
  },
  {
    key: 'doodh',
    name: 'Rawal Dairy Farm',
    ownerEmail: 'doodh@demo.com',
    ownerName: 'Gul Rahman',
    category: 'dairy',
    cover: '/images/dairy.jpg',
    tags: ['Fresh milk', 'Morning delivery', 'Desi ghee'],
    addressLine: 'Nawanshehr Road, Abbottabad',
    area: 'Nawanshehr',
    lat: 34.1729,
    lng: 73.2379,
    prepTimeMin: 10,
    minOrder: 150,
    rating: 4.7,
    ratingCount: 64,
    products: DAIRY,
    hours: { monday: { open: '05:30', close: '21:00' }, tuesday: { open: '05:30', close: '21:00' }, wednesday: { open: '05:30', close: '21:00' }, thursday: { open: '05:30', close: '21:00' }, friday: { open: '05:30', close: '21:00' }, saturday: { open: '05:30', close: '21:00' }, sunday: { open: '05:30', close: '20:00' } },
  },
  {
    key: 'fruit',
    name: 'Fruit Basket Abbottabad',
    ownerEmail: 'fruit@demo.com',
    ownerName: 'Adnan Sheikh',
    category: 'fruit',
    tags: ['Fruit', 'Gift baskets', 'Seasonal'],
    addressLine: 'Jinnahabad Road, Abbottabad',
    area: 'Jinnahabad',
    lat: 34.1521,
    lng: 73.2301,
    prepTimeMin: 14,
    minOrder: 250,
    rating: 4.3,
    ratingCount: 41,
    products: FRUIT,
  },
  {
    key: 'shahzad',
    name: 'Shahzad General Store',
    ownerEmail: 'shahzad@demo.com',
    ownerName: 'Shahzad Iqbal',
    category: 'grocery',
    tags: ['Corner shop', 'Snacks', 'Late night'],
    addressLine: 'Kehal Bazaar, Abbottabad',
    area: 'Kehal',
    lat: 34.1928,
    lng: 73.2425,
    prepTimeMin: 10,
    minOrder: 100,
    rating: 4.2,
    ratingCount: 33,
    products: [...GENERAL, ...KARYANA.slice(12, 16)],
    hours: { monday: { open: '07:00', close: '23:30' }, tuesday: { open: '07:00', close: '23:30' }, wednesday: { open: '07:00', close: '23:30' }, thursday: { open: '07:00', close: '23:30' }, friday: { open: '07:00', close: '23:30' }, saturday: { open: '07:00', close: '23:30' }, sunday: { open: '08:00', close: '23:00' } },
    deliveryMode: 'SHOP_DELIVERY',
  },
  /* Kitchens — the food-first half of the catalogue. --------------------- */
  {
    key: 'biryani',
    name: 'Biryani Express',
    ownerEmail: 'biryani@demo.com',
    ownerName: 'Kamran Sheikh',
    category: 'biryani',
    tags: ['Biryani', 'Pulao', 'Family deals'],
    addressLine: 'Jhangi Road, near Mandian Chowk, Abbottabad',
    area: 'Jhangi',
    lat: 34.1652,
    lng: 73.2312,
    prepTimeMin: 22,
    minOrder: 300,
    rating: 4.8,
    ratingCount: 412,
    products: BIRYANI,
    cover: '/images/biryani.jpg',
  },
  {
    key: 'shinwari',
    name: 'Shinwari Karahi House',
    ownerEmail: 'shinwari@demo.com',
    ownerName: 'Gul Rahman',
    category: 'karahi',
    tags: ['Karahi', 'Handi', 'Cooked to order'],
    addressLine: 'Main Mansehra Road, Supply Bazaar, Abbottabad',
    area: 'Supply Bazaar',
    lat: 34.1591,
    lng: 73.2247,
    prepTimeMin: 28,
    minOrder: 500,
    rating: 4.7,
    ratingCount: 286,
    products: KARAHI,
    cover: '/images/karahi.jpg',
  },
  {
    key: 'khyber',
    name: 'Khyber BBQ & Tikka',
    ownerEmail: 'khyber@demo.com',
    ownerName: 'Adnan Afridi',
    category: 'bbq',
    tags: ['BBQ', 'Tikka', 'Charcoal grilled'],
    addressLine: 'Kakul Road, opposite Ayub Medical College, Abbottabad',
    area: 'Kakul Road',
    lat: 34.1782,
    lng: 73.2402,
    prepTimeMin: 30,
    minOrder: 500,
    rating: 4.6,
    ratingCount: 198,
    products: BBQ,
    cover: '/images/bbq-platter.jpg',
  },
  {
    key: 'peshawari',
    name: 'Peshawari Chapli Corner',
    ownerEmail: 'chapli@demo.com',
    ownerName: 'Rahim Bacha',
    category: 'chapli',
    tags: ['Chapli kebab', 'Kabuli pulao'],
    addressLine: 'Nawan Shehr Road, near Fawara Chowk, Abbottabad',
    area: 'Nawan Shehr',
    lat: 34.1524,
    lng: 73.2158,
    prepTimeMin: 25,
    minOrder: 300,
    rating: 4.5,
    ratingCount: 164,
    products: CHAPLI,
    cover: '/images/chapli-kebab.jpg',
  },
  {
    key: 'pizzapoint',
    name: 'Pizza Point',
    ownerEmail: 'pizzapoint@demo.com',
    ownerName: 'Faisal Iqbal',
    category: 'pizza',
    tags: ['Pizza', 'Wings', 'Wood fired'],
    addressLine: 'Abbottabad Cantonment, near Fawara Chowk, Abbottabad',
    area: 'Cantt',
    lat: 34.1585,
    lng: 73.2091,
    prepTimeMin: 25,
    minOrder: 600,
    rating: 4.4,
    ratingCount: 233,
    products: PIZZA,
    cover: '/images/pizza.jpg',
  },
  {
    key: 'burgerlab',
    name: 'Burger Lab',
    ownerEmail: 'burgerlab@demo.com',
    ownerName: 'Hamza Yousaf',
    category: 'burgers',
    tags: ['Burgers', 'Fries', 'Late night'],
    addressLine: 'Jhangi Road, near Hafizabad Turn, Abbottabad',
    area: 'Jhangi',
    lat: 34.1706,
    lng: 73.2348,
    prepTimeMin: 20,
    minOrder: 300,
    rating: 4.3,
    ratingCount: 147,
    products: BURGER,
    cover: '/images/burger.jpg',
  },
  {
    key: 'chaikhana',
    name: 'Chai Khana Cafe',
    ownerEmail: 'chaikhana@demo.com',
    ownerName: 'Maryam Bibi',
    category: 'cafe',
    tags: ['Chai', 'Cakes', 'Sit-in & delivery'],
    addressLine: 'Kalakot Road, near Municipal Park, Abbottabad',
    area: 'Kalakot',
    lat: 34.1622,
    lng: 73.2183,
    prepTimeMin: 18,
    minOrder: 200,
    rating: 4.6,
    ratingCount: 121,
    products: CHAI,
    cover: '/images/chai.jpg',
  },
  {
    key: 'amc',
    name: 'AMC Medicos',
    ownerEmail: 'amc@demo.com',
    ownerName: 'Naeem Akhtar',
    category: 'pharmacy',
    tags: ['Medicos', 'Surgical', 'Baby care'],
    addressLine: 'Cantt Road, near CMH, Abbottabad',
    area: 'Cantt',
    lat: 34.1499,
    lng: 73.2011,
    prepTimeMin: 15,
    minOrder: 100,
    rating: 4.4,
    ratingCount: 52,
    products: PHARMACY_SEHAT.slice(0, 7),
  },
];

// `cash` is the COD money a rider has collected but not handed over yet. Kamran
// (rider2) settled up yesterday, which is why he has a payable balance.
const RIDERS = [
  { email: 'rider1@demo.com', name: 'Bilal Khan', lat: 34.1662, lng: 73.2271, vehicle: 'bike' as const, deliveries: 486, rating: 4.8, cash: 3750 },
  { email: 'rider2@demo.com', name: 'Kamran Yousaf', lat: 34.1589, lng: 73.2203, vehicle: 'bike' as const, deliveries: 372, rating: 4.7, cash: 0 },
  { email: 'rider3@demo.com', name: 'Naveed Akhtar', lat: 34.1548, lng: 73.2187, vehicle: 'bike' as const, deliveries: 214, rating: 4.6, cash: 300 },
  { email: 'rider4@demo.com', name: 'Zubair Shah', lat: 34.1721, lng: 73.2381, vehicle: 'car' as const, deliveries: 96, rating: 4.5, cash: 850 },
];

const CUSTOMERS = [
  { email: 'ali@demo.com', name: 'Ali Raza', phone: '+92 300 1234567', points: 340 },
  { email: 'sara@demo.com', name: 'Sara Khan', phone: '+92 301 2345678', points: 120 },
  { email: 'hassan@demo.com', name: 'Hassan Ali', phone: '+92 302 3456789', points: 60 },
];

const ZONE_TEMPLATE = [
  { name: 'Within 2 km', radiusKm: 2, fee: 60, freeAbove: 1500, etaMinutes: 20 },
  { name: '2 – 4 km', radiusKm: 4, fee: 90, freeAbove: 2500, etaMinutes: 30 },
  { name: '4 – 7 km', radiusKm: 7, fee: 140, freeAbove: null, etaMinutes: 45 },
];

/* -------------------------------------------------------------------------- */
/* Seeding                                                                    */
/* -------------------------------------------------------------------------- */

export type SeedOptions = { reset?: boolean; quiet?: boolean };

export async function seedDemoData(options: SeedOptions = {}): Promise<void> {
  const db = await getDb();
  const log = (...args: unknown[]) => {
    if (!options.quiet) console.log(...args);
  };

  if (options.reset) {
    log('· truncating existing tables');
    await db.execute(sql`
      truncate table
        ${realtimeEvents}, ${pushSubscriptions}, ${refreshTokens}, ${messages}, ${orderEvents},
        ${orderItems}, ${paymentTransactions}, ${reviews}, ${favorites}, ${notifications},
        ${ticketMessages}, ${supportTickets}, ${payoutRequests},
        ${shopRunners}, ${deliveryZones}, ${products}, ${orders}, ${shops},
        ${runnerProfiles}, ${addresses}, ${auditLogs}, ${campaigns}, ${serviceAreas}, ${users}, ${settings}
      restart identity cascade
    `);
  }

  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length && !options.reset) {
    log('· demo data already present, skipping');
    return;
  }

  const passwordHash = await hashPassword(env.demoPassword);
  const now = new Date().toISOString();

  /* users ------------------------------------------------------------------ */
  const userIdByEmail = new Map<string, string>();
  const userRows = [
    { email: 'admin@qareeb.app', name: 'Qareeb Admin', role: 'ADMIN' as UserRole, phone: '+92 992 920000', points: 0 },
    ...CUSTOMERS.map((c) => ({ email: c.email, name: c.name, role: 'CUSTOMER' as UserRole, phone: c.phone, points: c.points })),
    ...SHOPS.map((s) => ({ email: s.ownerEmail, name: s.ownerName, role: 'MERCHANT' as UserRole, phone: '+92 99 000 0000', points: 0 })),
    ...RIDERS.map((r) => ({ email: r.email, name: r.name, role: 'RIDER' as UserRole, phone: '+92 33 000 0000', points: 0 })),
  ].map((user) => {
    const id = newId();
    userIdByEmail.set(user.email, id);
    return {
      id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      passwordHash,
      walletPoints: user.points,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };
  });
  await db.insert(users).values(userRows);
  log(`· ${userRows.length} users (password: ${env.demoPassword})`);

  /* rider profiles --------------------------------------------------------- */
  await db.insert(runnerProfiles).values(
    RIDERS.map((rider) => ({
      userId: userIdByEmail.get(rider.email)!,
      vehicleType: rider.vehicle,
      isAvailable: true,
      lat: rider.lat,
      lng: rider.lng,
      heading: Math.round(between(0, 359)),
      lastSeenAt: now,
      ratingAvg: rider.rating,
      ratingCount: Math.round(rider.deliveries / 4),
      totalDeliveries: rider.deliveries,
      cashInHand: rider.cash,
      createdAt: now,
    })),
  );

  /* shops ------------------------------------------------------------------ */
  const shopIdByKey = new Map<string, string>();
  const shopRows = SHOPS.map((shop) => {
    const id = newId();
    shopIdByKey.set(shop.key, id);
    return {
      id,
      ownerId: userIdByEmail.get(shop.ownerEmail)!,
      name: shop.name,
      slug: slugify(shop.name),
      category: shop.category,
      description: `${shop.name} in ${shop.area}, Abbottabad. Delivering to nearby mohallas with live rider tracking.`,
      phone: '+92 992 9' + String(1000 + Math.floor(random() * 8999)),
      addressLine: shop.addressLine,
      lat: shop.lat,
      lng: shop.lng,
      isOpen: true,
      isPaused: false,
      hours: shop.hours ?? defaultHours(),
      prepTimeMin: shop.prepTimeMin,
      minOrder: shop.minOrder,
      ratingAvg: shop.rating,
      ratingCount: shop.ratingCount,
      status: 'APPROVED' as const,
      coverUrl: shop.cover ?? null,
      deliveryMode: shop.deliveryMode ?? ('PLATFORM_RIDER' as const),
      tags: shop.tags,
      city: 'Abbottabad',
      createdAt: now,
      updatedAt: now,
    };
  });
  await db.insert(shops).values(shopRows);
  log(`· ${shopRows.length} shops around Abbottabad`);

  /* zones, products, favourites, team ------------------------------------- */
  const zoneRows: (typeof deliveryZones.$inferInsert)[] = [];
  const productRows: (typeof products.$inferInsert)[] = [];

  for (const shop of SHOPS) {
    const shopId = shopIdByKey.get(shop.key)!;
    ZONE_TEMPLATE.forEach((zone, index) => {
      zoneRows.push({
        id: newId(),
        shopId,
        name: zone.name,
        radiusKm: zone.radiusKm,
        fee: zone.fee,
        freeAbove: zone.freeAbove,
        etaMinutes: zone.etaMinutes,
        sortOrder: index,
      });
    });

    shop.products.forEach((product, index) => {
      productRows.push({
        id: newId(),
        shopId,
        name: product.name,
        description: product.description ?? null,
        category: product.category,
        unit: product.unit,
        price: product.price,
        compareAtPrice: product.compareAt ?? null,
        emoji: product.emoji,
        imageUrl: product.image ?? null,
        stock: product.stock ?? Math.round(between(8, 40)),
        isAvailable: true,
        isFeatured: product.featured ?? index < 3,
        sortOrder: index,
        createdAt: now,
        updatedAt: now,
      });
    });
  }
  await db.insert(deliveryZones).values(zoneRows);
  await db.insert(products).values(productRows);
  log(`· ${zoneRows.length} delivery rings, ${productRows.length} products`);

  await db.insert(shopRunners).values(
    [
      ['madina', 'rider1@demo.com'],
      ['madina', 'rider3@demo.com'],
      ['mart', 'rider2@demo.com'],
      ['kakul', 'rider4@demo.com'],
      ['roshan', 'rider3@demo.com'],
      ['sabzi', 'rider2@demo.com'],
      ['doodh', 'rider4@demo.com'],
      ['biryani', 'rider1@demo.com'],
      ['shinwari', 'rider2@demo.com'],
      ['khyber', 'rider3@demo.com'],
      ['chaikhana', 'rider4@demo.com'],
    ].map(([shopKey, riderEmail]) => ({
      id: newId(),
      shopId: shopIdByKey.get(shopKey as string)!,
      runnerId: userIdByEmail.get(riderEmail as string)!,
      createdAt: now,
    })),
  );

  /* addresses -------------------------------------------------------------- */
  const customerIds = Object.fromEntries(CUSTOMERS.map((c) => [c.email, userIdByEmail.get(c.email)!]));
  await db.insert(addresses).values([
    {
      id: newId(),
      userId: customerIds['ali@demo.com']!,
      label: 'Home',
      line1: 'House 42, Street 3, Mandian',
      area: 'Mandian',
      city: 'Abbottabad',
      lat: 34.16880,
      lng: 73.22650,
      landmark: 'Near Fawara Chowk',
      instructions: 'Green gate next to the chemist. Ring the bell twice.',
      isDefault: true,
      createdAt: now,
    },
    {
      id: newId(),
      userId: customerIds['ali@demo.com']!,
      label: 'Office',
      line1: '2nd Floor, Ayub Medical Complex Road',
      area: 'Supply Bazaar',
      city: 'Abbottabad',
      lat: 34.15960,
      lng: 73.22030,
      landmark: 'Opposite Ayub Medical College gate',
      instructions: 'Parking is at the back; ask for the second floor.',
      isDefault: false,
      createdAt: now,
    },
    {
      id: newId(),
      userId: customerIds['sara@demo.com']!,
      label: 'Home',
      line1: 'Flat 6, Jinnahabad Heights',
      area: 'Jinnahabad',
      city: 'Abbottabad',
      lat: 34.15260,
      lng: 73.22950,
      landmark: 'Near Jinnahabad Bridge',
      instructions: 'Call on arrival, gate is locked.',
      isDefault: true,
      createdAt: now,
    },
    {
      id: newId(),
      userId: customerIds['hassan@demo.com']!,
      label: 'Home',
      line1: 'Quarter 9, Kakul Road',
      area: 'Kakul',
      city: 'Abbottabad',
      lat: 34.17990,
      lng: 73.24180,
      landmark: 'Near PMA Gate',
      instructions: null,
      isDefault: true,
      createdAt: now,
    },
  ]);

  await db.insert(favorites).values([
    { id: newId(), userId: customerIds['ali@demo.com']!, shopId: shopIdByKey.get('madina')!, createdAt: now },
    { id: newId(), userId: customerIds['ali@demo.com']!, shopId: shopIdByKey.get('roshan')!, createdAt: now },
    { id: newId(), userId: customerIds['sara@demo.com']!, shopId: shopIdByKey.get('sabzi')!, createdAt: now },
  ]);

  /* promos, settings, service areas, campaigns ---------------------------- */
  await db.insert(promos).values([
    { id: newId(), code: 'WELCOME50', shopId: null, title: 'Rs 50 off your first order', type: 'FIXED', value: 50, minOrder: 500, maxDiscount: 50, usageLimit: 500, usedCount: 37, isActive: true, createdAt: now },
    { id: newId(), code: 'FREESHIP', shopId: null, title: 'Free delivery above Rs 800', type: 'FREE_DELIVERY', value: 0, minOrder: 800, maxDiscount: 140, usageLimit: null, usedCount: 12, isActive: true, createdAt: now },
    { id: newId(), code: 'MADINA10', shopId: shopIdByKey.get('madina')!, title: '10% off at Al-Madina', type: 'PERCENT', value: 10, minOrder: 600, maxDiscount: 200, usageLimit: null, usedCount: 5, isActive: true, createdAt: now },
    { id: newId(), code: 'SWEET15', shopId: shopIdByKey.get('roshan')!, title: '15% off bakery & sweets', type: 'PERCENT', value: 15, minOrder: 600, maxDiscount: 300, usageLimit: 100, usedCount: 9, isActive: true, createdAt: now },
  ]);

  await db.insert(settings).values(
    Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value, updatedAt: now, updatedBy: null })),
  );

  await db.insert(serviceAreas).values([
    { id: newId(), city: 'Abbottabad', name: 'Abbottabad City', lat: 34.1688, lng: 73.2215, radiusKm: 12, baseFee: 60, surgeMultiplier: 1, isActive: true, createdAt: now },
    { id: newId(), city: 'Abbottabad', name: 'Mandian & Supply Bazaar', lat: 34.1650, lng: 73.2240, radiusKm: 5, baseFee: 60, surgeMultiplier: 1, isActive: true, createdAt: now },
    { id: newId(), city: 'Abbottabad', name: 'Kakul Road & Nawanshehr', lat: 34.1775, lng: 73.2410, radiusKm: 7, baseFee: 90, surgeMultiplier: 1.2, isActive: true, createdAt: now },
  ]);

  await db.insert(campaigns).values([
    {
      id: newId(),
      title: 'Eid bazaar week',
      body: 'Flat Rs 150 off on orders above Rs 1,500 from 20–29 Ramzan.',
      channel: 'PUSH',
      audience: 'CUSTOMERS',
      status: 'SENT',
      sentAt: iso(6, 10),
      recipients: 412,
      createdBy: userIdByEmail.get('admin@qareeb.app')!,
      createdAt: iso(7, 9),
    },
    {
      id: newId(),
      title: 'New riders wanted in Kakul',
      body: 'Rs 2,500 joining bonus for riders covering Kakul Road.',
      channel: 'IN_APP',
      audience: 'RIDERS',
      status: 'DRAFT',
      createdBy: userIdByEmail.get('admin@qareeb.app')!,
      createdAt: iso(2, 15),
    },
  ]);

  /* referrals, wallets and support tickets --------------------------------- */

  // every seeded account owns a share code; Hassan was invited by Ali and his
  // first order is already delivered, so the reward shows as converted.
  const seededCodes = await import('../lib/referral.js');
  for (const id of userIdByEmail.values()) await seededCodes.ensureReferralCode(id);

  const [aliRow] = await db.select().from(users).where(eq(users.id, customerIds['ali@demo.com']!)).limit(1);
  await db
    .update(users)
    .set({ referredBy: aliRow?.referralCode ?? null, referralCreditedAt: iso(9, 19) })
    .where(eq(users.id, customerIds['hassan@demo.com']!));

  const ticketAt = iso(2, 13);
  const ticketOne = newId();
  const ticketTwo = newId();
  await db.insert(supportTickets).values([
    {
      id: ticketOne,
      userId: customerIds['sara@demo.com']!,
      orderId: null,
      subject: 'Doodh ka packet phata hua aaya',
      category: 'ORDER',
      priority: 'high',
      status: 'ANSWERED',
      createdAt: ticketAt,
      updatedAt: iso(2, 15),
    },
    {
      id: ticketTwo,
      userId: userIdByEmail.get('roshan@demo.com')!,
      orderId: null,
      subject: 'Payout account number update karna hai',
      category: 'PAYMENT',
      priority: 'normal',
      status: 'OPEN',
      createdAt: iso(0, 11),
      updatedAt: iso(0, 11),
    },
  ]);
  await db.insert(ticketMessages).values([
    {
      id: newId(),
      ticketId: ticketOne,
      authorId: customerIds['sara@demo.com']!,
      authorRole: 'CUSTOMER' as UserRole,
      body: 'Milk packet phat gaya tha aur aadha doodh gir gaya. Order Saturday ka tha.',
      createdAt: ticketAt,
    },
    {
      id: newId(),
      ticketId: ticketOne,
      authorId: userIdByEmail.get('admin@qareeb.app')!,
      authorRole: 'ADMIN' as UserRole,
      body: 'Sorry about that — 100 points credited to your wallet and we have spoken to the dairy.',
      createdAt: iso(2, 15),
    },
    {
      id: newId(),
      ticketId: ticketTwo,
      authorId: userIdByEmail.get('roshan@demo.com')!,
      authorRole: 'MERCHANT' as UserRole,
      body: 'Please transfer future payouts to the new Easypaisa number on file.',
      createdAt: iso(0, 11),
    },
  ]);

  /* orders ----------------------------------------------------------------- */
  const productRowsByShop = new Map<string, (typeof products.$inferInsert)[]>();
  for (const row of productRows) {
    const list = productRowsByShop.get(row.shopId!) ?? [];
    list.push(row);
    productRowsByShop.set(row.shopId!, list);
  }

  type PlacedOrder = { id: string; groupId: string; shopKey: string; customerEmail: string; status: OrderStatus };
  const placed: PlacedOrder[] = [];

  const placeOrder = async (input: {
    shopKey: string;
    customerEmail: string;
    status: OrderStatus;
    createdAt: string;
    paymentMethod?: PaymentMethod;
    runnerEmail?: string | null;
    promoCode?: string | null;
    discount?: number;
    tip?: number;
    rating?: number;
    reviewComment?: string;
    itemCount?: number;
    note?: string;
    /** set for a future-dated order the shop should prepare later */
    scheduledFor?: string;
  }) => {
    const shop = SHOPS.find((s) => s.key === input.shopKey)!;
    const shopId = shopIdByKey.get(input.shopKey)!;
    const addressRow = {
      ali: { label: 'Home', line1: 'House 42, Street 3, Mandian', area: 'Mandian', city: 'Abbottabad', lat: 34.1688, lng: 73.2265, instructions: 'Green gate next to the chemist.' },
      sara: { label: 'Home', line1: 'Flat 6, Jinnahabad Heights', area: 'Jinnahabad', city: 'Abbottabad', lat: 34.1526, lng: 73.2295, landmark: 'Near Jinnahabad Bridge', instructions: null },
      hassan: { label: 'Home', line1: 'Quarter 9, Kakul Road', area: 'Kakul', city: 'Abbottabad', lat: 34.1799, lng: 73.2418, landmark: 'Near PMA Gate', instructions: 'Call when you reach the check post.' },
    }[input.customerEmail.split('@')[0] as 'ali' | 'sara' | 'hassan'];

    const catalogue = productRowsByShop.get(shopId)!;
    const chosen: (typeof products.$inferInsert)[] = [];
    const wanted = input.itemCount ?? Math.round(between(2, 4));
    while (chosen.length < Math.min(wanted, catalogue.length)) {
      const candidate = pick(catalogue);
      if (!chosen.includes(candidate)) chosen.push(candidate);
    }

    const items = chosen.map((product) => {
      const quantity = Math.round(between(1, 3));
      return {
        id: newId(),
        productId: product.id!,
        name: product.name,
        unit: product.unit ?? 'piece',
        unitPrice: product.price,
        quantity,
        total: Math.round(product.price * quantity),
        emoji: product.emoji ?? null,
      };
    });

    const subtotal = items.reduce((sum, item) => sum + item.total, 0);
    const zone = ZONE_TEMPLATE[0]!;
    const freeDelivery = zone.freeAbove != null && subtotal >= zone.freeAbove;
    const deliveryFee = freeDelivery ? 0 : zone.fee;
    const serviceFee = Math.round((subtotal * DEFAULT_SETTINGS.serviceFeePct) / 100);
    const discount = input.discount ?? 0;
    const tip = input.tip ?? 0;
    const total = Math.max(0, subtotal + deliveryFee + serviceFee - discount + tip);

    const orderId = newId();
    const groupId = newId();
    const runnerId = input.runnerEmail ? userIdByEmail.get(input.runnerEmail)! : null;
    const deliveredAt = input.status === 'DELIVERED' ? new Date(new Date(input.createdAt).getTime() + 34 * 60_000).toISOString() : null;
    const history = buildHistory(input.status, input.createdAt, deliveredAt);

    await db.insert(orders).values({
      id: orderId,
      orderNumber: orderNumber(),
      groupId,
      customerId: customerIds[input.customerEmail]!,
      shopId,
      runnerId,
      status: input.status,
      paymentMethod: input.paymentMethod ?? 'COD',
      paymentStatus: input.status === 'CANCELLED' ? 'REFUNDED' : input.paymentMethod && input.paymentMethod !== 'COD' ? 'PAID' : input.status === 'DELIVERED' ? 'PAID' : 'UNPAID',
      paymentRef: input.paymentMethod && input.paymentMethod !== 'COD' ? `DEMO-${newId(8).toUpperCase()}` : null,
      subtotal,
      deliveryFee,
      serviceFee,
      discount,
      tip,
      total,
      distanceKm: Math.round(between(0.6, 3.4) * 10) / 10,
      etaMinutes: zone.etaMinutes,
      promoCode: input.promoCode ?? null,
      notes: input.note ?? null,
      scheduledFor: input.scheduledFor ?? null,
      deliveryAddress: { ...addressRow, phone: '+92 300 1234567' } as DeliveryAddressSnapshot,
      statusHistory: history,
      acceptedAt: history.find((h) => h.status === 'ACCEPTED')?.at ?? null,
      readyAt: history.find((h) => h.status === 'READY')?.at ?? null,
      pickedUpAt: history.find((h) => h.status === 'ON_THE_WAY')?.at ?? null,
      deliveredAt,
      cancelledAt: input.status === 'CANCELLED' ? history[history.length - 1]!.at : null,
      cancelledBy: input.status === 'CANCELLED' ? customerIds[input.customerEmail]! : null,
      cancelReason: input.status === 'CANCELLED' ? 'Customer changed their mind' : null,
      pointsEarned: input.status === 'DELIVERED' ? Math.floor(subtotal / 100) * DEFAULT_SETTINGS.loyaltyPointsPer100 : 0,
      createdAt: input.createdAt,
      updatedAt: history[history.length - 1]!.at,
    });

    await db.insert(orderItems).values(items.map((item) => ({ ...item, orderId })));
    await db.insert(orderEvents).values(
      history.map((entry, index) => ({
        id: newId(),
        orderId,
        status: entry.status,
        note: entry.note ?? null,
        actorId: index === 0 ? customerIds[input.customerEmail]! : runnerId,
        actorRole: index === 0 ? 'CUSTOMER' : 'RIDER',
        createdAt: entry.at,
      })),
    );

    if (input.rating) {
      await db.insert(reviews).values({
        id: newId(),
        orderId,
        shopId,
        runnerId,
        customerId: customerIds[input.customerEmail]!,
        shopRating: input.rating,
        runnerRating: Math.min(5, input.rating),
        comment: input.reviewComment ?? null,
        createdAt: deliveredAt ?? input.createdAt,
      });
    }

    placed.push({ id: orderId, groupId, shopKey: input.shopKey, customerEmail: input.customerEmail, status: input.status });
    return { orderId, total, items };
  };

  // 14 days of history so admin charts and merchant analytics have shape.
  const historyStatuses: OrderStatus[] = ['DELIVERED', 'DELIVERED', 'DELIVERED', 'DELIVERED', 'CANCELLED'];
  const comments = [
    'Fresh stock and quick delivery, sab kuch theek tha.',
    'Rider called before arriving. Very polite.',
    'Items were packed well. Will order again.',
    'Delivered in 22 minutes, impressed.',
    'One item was missing but the shop refunded it immediately.',
  ];
  let orderCount = 0;
  for (let day = 13; day >= 1; day -= 1) {
    const perDay = Math.round(between(2, 4));
    for (let index = 0; index < perDay; index += 1) {
      // People reach for cooked food more often than for a bag of atta, and the
      // "popular right now" rail should reflect that.
      const shop = random() < 0.6 ? pick(KITCHEN_KEYS.map((key) => SHOPS.find((entry) => entry.key === key)!)) : pick(SHOPS);
      const customerEmail = pick(CUSTOMERS).email;
      const status = pick(historyStatuses);
      await placeOrder({
        shopKey: shop.key,
        customerEmail,
        status,
        createdAt: iso(day, 11 + Math.round(between(0, 9)), Math.round(between(0, 59))),
        paymentMethod: pick<PaymentMethod>(['COD', 'COD', 'JAZZCASH', 'EASYPAISA']),
        runnerEmail: status === 'CANCELLED' ? null : pick(RIDERS).email,
        rating: status === 'DELIVERED' && random() > 0.45 ? Math.round(between(4, 5.4)) : undefined,
        reviewComment: pick(comments),
        itemCount: Math.round(between(2, 5)),
      });
      orderCount += 1;
    }
  }
  // A guaranteed slice of delivered trade for the two shops the demo walks
  // through (Al-Madina and Roshan), so analytics and the payout ledger have
  // real numbers on a fresh install.
  for (const [shopKey, customerEmail, day] of [
    ['madina', 'ali@demo.com', 12],
    ['madina', 'sara@demo.com', 11],
    ['madina', 'hassan@demo.com', 9],
    ['madina', 'ali@demo.com', 7],
    ['madina', 'sara@demo.com', 5],
    ['madina', 'hassan@demo.com', 3],
    ['roshan', 'ali@demo.com', 10],
    ['roshan', 'sara@demo.com', 8],
    ['roshan', 'hassan@demo.com', 6],
    ['roshan', 'ali@demo.com', 4],
  ] as const) {
    await placeOrder({
      shopKey,
      customerEmail,
      status: 'DELIVERED',
      createdAt: iso(day, 12 + Math.round(between(0, 7)), Math.round(between(0, 59))),
      paymentMethod: pick<PaymentMethod>(['COD', 'JAZZCASH', 'EASYPAISA']),
      runnerEmail: pick(RIDERS).email,
      rating: Math.round(between(4, 5.4)),
      reviewComment: pick(comments),
      itemCount: Math.round(between(2, 4)),
      tip: pick([0, 0, 50, 100]),
    });
    orderCount += 1;
  }

  // Kamran (rider2) is the rider the demo logs in as. His week is prepaid with
  // tips, so his wallet carries a real payable balance instead of only cash to
  // hand over — the settlement screen has both a merchant and a rider request.
  for (const [day, tip] of [
    [6, 100],
    [5, 150],
    [3, 100],
    [2, 50],
    [1, 100],
  ] as const) {
    await placeOrder({
      shopKey: pick(['madina', 'roshan', 'mart']),
      customerEmail: pick(CUSTOMERS).email,
      status: 'DELIVERED',
      createdAt: iso(day, 13 + Math.round(between(0, 6)), Math.round(between(0, 59))),
      paymentMethod: pick<PaymentMethod>(['JAZZCASH', 'EASYPAISA']),
      runnerEmail: 'rider2@demo.com',
      rating: Math.round(between(4, 5.4)),
      reviewComment: pick(comments),
      itemCount: Math.round(between(2, 4)),
      tip,
    });
    orderCount += 1;
  }
  log(`· ${orderCount} historical orders across 14 days`);

  /* live orders ------------------------------------------------------------ */
  // Order 1: mid-delivery right now, so rider tracking can be demoed instantly.
  const live = await placeOrder({
    shopKey: 'madina',
    customerEmail: 'ali@demo.com',
    status: 'ON_THE_WAY',
    createdAt: new Date(Date.now() - 26 * 60_000).toISOString(),
    paymentMethod: 'JAZZCASH',
    runnerEmail: 'rider1@demo.com',
    itemCount: 3,
    tip: 100,
    note: 'Please send fresh dahi. Call when you reach the gate.',
  });

  // Order 2: same multi-shop group, still being prepared at the bakery.
  const liveSecond = await placeOrder({
    shopKey: 'roshan',
    customerEmail: 'ali@demo.com',
    status: 'PREPARING',
    createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    paymentMethod: 'COD',
    runnerEmail: null,
    itemCount: 2,
    promoCode: 'SWEET15',
    discount: 150,
  });
  await db
    .update(orders)
    .set({ groupId: live.orderId, updatedAt: now })
    .where(sql`${orders.id} = ${liveSecond.orderId}`);

  // Order 3: brand new, waiting for the merchant to accept.
  await placeOrder({
    shopKey: 'sabzi',
    customerEmail: 'sara@demo.com',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 4 * 60_000).toISOString(),
    paymentMethod: 'COD',
    runnerEmail: null,
    itemCount: 4,
  });

  // Order 4: a scheduled order for tomorrow morning (the merchant sees a
  // "scheduled" badge and prepares it just before the slot).
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  await placeOrder({
    shopKey: 'roshan',
    customerEmail: 'hassan@demo.com',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 9 * 60_000).toISOString(),
    paymentMethod: 'EASYPAISA',
    runnerEmail: null,
    itemCount: 3,
    note: 'Birthday cake ke saath candles bhi bhej dein.',
    scheduledFor: tomorrow.toISOString(),
  });

  // A short chat on the live order so the customer can see messaging working.
  const liveOrderRow = placed.find((order) => order.id === live.orderId)!;
  await db.insert(messages).values([
    {
      id: newId(),
      orderId: live.orderId,
      senderId: userIdByEmail.get('madina@demo.com')!,
      senderRole: 'MERCHANT',
      body: 'Assalam o alaikum — your order is packed and Bilal has picked it up.',
      createdAt: new Date(Date.now() - 14 * 60_000).toISOString(),
    },
    {
      id: newId(),
      orderId: live.orderId,
      senderId: userIdByEmail.get('ali@demo.com')!,
      senderRole: 'CUSTOMER',
      body: 'Shukriya. Please ask him to call at the green gate.',
      createdAt: new Date(Date.now() - 12 * 60_000).toISOString(),
    },
    {
      id: newId(),
      orderId: live.orderId,
      senderId: userIdByEmail.get('rider1@demo.com')!,
      senderRole: 'RIDER',
      body: 'Main Mandian chowk se guzar raha hoon, 8 minute.',
      createdAt: new Date(Date.now() - 6 * 60_000).toISOString(),
    },
  ]);
  void liveOrderRow;

  await db.insert(notifications).values([
    {
      id: newId(),
      userId: customerIds['ali@demo.com']!,
      title: 'Bilal is on the way',
      body: 'Your Al-Madina order is 8 minutes away. Pay Rs 2,480 in cash on delivery.',
      type: 'order',
      data: { orderId: live.orderId },
      isRead: false,
      createdAt: new Date(Date.now() - 10 * 60_000).toISOString(),
    },
    {
      id: newId(),
      userId: customerIds['ali@demo.com']!,
      title: 'SWEET15 applied',
      body: 'Rs 150 off at Roshan Bakery & Sweets on your bakery order.',
      type: 'promo',
      data: { orderId: liveSecond.orderId },
      isRead: false,
      createdAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    },
    {
      id: newId(),
      userId: customerIds['ali@demo.com']!,
      title: '340 points in your wallet',
      body: 'Use points at checkout to pay for part of any order.',
      type: 'info',
      data: {},
      isRead: true,
      createdAt: iso(3, 9),
    },
    {
      id: newId(),
      userId: userIdByEmail.get('madina@demo.com')!,
      title: 'New order received',
      body: `Order for Rs ${Math.round(live.total)} — accept it to start preparing.`,
      type: 'order',
      data: { orderId: live.orderId },
      isRead: false,
      createdAt: new Date(Date.now() - 26 * 60_000).toISOString(),
    },
    {
      id: newId(),
      userId: userIdByEmail.get('rider1@demo.com')!,
      title: 'Delivery assigned',
      body: 'Pick up from Al-Madina Karyana Store, Supply Bazaar. Rs 2,480 cash to collect.',
      type: 'order',
      data: { orderId: live.orderId },
      isRead: false,
      createdAt: new Date(Date.now() - 20 * 60_000).toISOString(),
    },
  ]);

  await db.insert(auditLogs).values([
    { id: newId(), actorId: userIdByEmail.get('admin@qareeb.app')!, actorRole: 'ADMIN', action: 'shop.approve', entity: 'shop', entityId: shopIdByKey.get('madina')!, meta: { note: 'Verified CNIC and shop photos' }, createdAt: iso(12, 11) },
    { id: newId(), actorId: userIdByEmail.get('admin@qareeb.app')!, actorRole: 'ADMIN', action: 'settings.update', entity: 'settings', entityId: 'serviceFeePct', meta: { from: 1.5, to: 2 }, createdAt: iso(5, 16) },
    { id: newId(), actorId: userIdByEmail.get('admin@qareeb.app')!, actorRole: 'ADMIN', action: 'campaign.send', entity: 'campaign', entityId: 'eid-bazaar', meta: { recipients: 412 }, createdAt: iso(6, 10) },
  ]);

  /* payout history derived from what was actually delivered ------------------ */

  const [madinaDelivered] = await db
    .select({ subtotal: sql<number>`coalesce(sum(${orders.subtotal}), 0)::float` })
    .from(orders)
    .where(and(eq(orders.shopId, shopIdByKey.get('madina')!), eq(orders.status, 'DELIVERED')));
  const madinaGross = Number(madinaDelivered?.subtotal ?? 0);
  const madinaNet = Math.round(madinaGross * (1 - DEFAULT_SETTINGS.commissionPct / 100));
  const settledAmount = Math.max(0, Math.floor((madinaNet * 0.7) / 50) * 50);

  const [kamran] = await db
    .select({ fees: sql<number>`coalesce(sum(${orders.deliveryFee} + ${orders.tip}), 0)::float` })
    .from(orders)
    .where(and(eq(orders.runnerId, userIdByEmail.get('rider2@demo.com')!), eq(orders.status, 'DELIVERED')));
  const [kamranProfile] = await db
    .select({ cashInHand: runnerProfiles.cashInHand })
    .from(runnerProfiles)
    .where(eq(runnerProfiles.userId, userIdByEmail.get('rider2@demo.com')!))
    .limit(1);
  const kamranOwed = Math.max(0, Math.round(Number(kamran?.fees ?? 0) - Number(kamranProfile?.cashInHand ?? 0)));
  // A rider cashes out the minimum that is worth a transfer, not their whole balance.
  const requestedAmount = kamranOwed >= 500 ? 500 : 0;

  const [biryaniOwed] = await db
    .select({ subtotal: sql<number>`coalesce(sum(${orders.subtotal}), 0)::float` })
    .from(orders)
    .where(and(eq(orders.shopId, shopIdByKey.get('biryani')!), eq(orders.status, 'DELIVERED')));
  const biryaniNet = Math.round(Number(biryaniOwed?.subtotal ?? 0) * (1 - DEFAULT_SETTINGS.commissionPct / 100));
  const biryaniRequest = Math.floor((biryaniNet * 0.4) / 500) * 500;

  const payoutRows: (typeof payoutRequests.$inferInsert)[] = [];
  if (settledAmount >= 500) {
    payoutRows.push({
      id: newId(),
      userId: userIdByEmail.get('madina@demo.com')!,
      role: 'MERCHANT' as UserRole,
      shopId: shopIdByKey.get('madina')!,
      amount: settledAmount,
      method: 'JAZZCASH',
      accountTitle: 'Al-Madina Karyana Store',
      accountNumber: '0301 4567890',
      status: 'PAID',
      note: 'Verified against the delivery log',
      decidedBy: userIdByEmail.get('admin@qareeb.app')!,
      decidedAt: iso(6, 12),
      createdAt: iso(7, 10),
      updatedAt: iso(6, 12),
    });
  }
  if (requestedAmount >= 500) {
    payoutRows.push({
      id: newId(),
      userId: userIdByEmail.get('rider2@demo.com')!,
      role: 'RIDER' as UserRole,
      shopId: null,
      amount: requestedAmount,
      method: 'EASYPAISA',
      accountTitle: 'Kamran Yousaf',
      accountNumber: '0345 9988776',
      status: 'PENDING',
      note: null,
      createdAt: iso(1, 20),
      updatedAt: iso(1, 20),
    });
  }
  if (biryaniRequest >= 500) {
    payoutRows.push({
      id: newId(),
      userId: userIdByEmail.get('biryani@demo.com')!,
      role: 'MERCHANT' as UserRole,
      shopId: shopIdByKey.get('biryani')!,
      amount: biryaniRequest,
      method: 'JAZZCASH',
      accountTitle: 'Biryani Express',
      accountNumber: '0333 2211004',
      status: 'PENDING',
      note: null,
      createdAt: iso(2, 18),
      updatedAt: iso(2, 18),
    });
  }
  if (payoutRows.length) await db.insert(payoutRequests).values(payoutRows);

  log('· live orders, chat, notifications and audit trail');
  log(`\n  Demo login: ali@demo.com / ${env.demoPassword}\n  Merchant:   madina@demo.com   Rider: rider1@demo.com   Admin: admin@qareeb.app\n`);
}

function buildHistory(status: OrderStatus, createdAt: string, deliveredAt: string | null) {
  const start = new Date(createdAt).getTime();
  const at = (minutes: number) => new Date(start + minutes * 60_000).toISOString();
  const base: { status: OrderStatus; at: string; note?: string }[] = [
    { status: 'PENDING', at: createdAt, note: 'Order placed' },
  ];
  if (status === 'PENDING') return base;
  if (status === 'CANCELLED') {
    base.push({ status: 'CANCELLED', at: at(6), note: 'Customer changed their mind' });
    return base;
  }

  base.push({ status: 'ACCEPTED', at: at(2), note: 'Accepted by the shop' });
  if (status === 'ACCEPTED') return base;
  base.push({ status: 'PREPARING', at: at(4) });
  if (status === 'PREPARING') return base;
  base.push({ status: 'READY', at: at(12), note: 'Packed, waiting for a rider' });
  if (status === 'READY') return base;
  base.push({ status: 'ON_THE_WAY', at: at(18), note: 'Rider picked up the order' });
  if (status === 'ON_THE_WAY') return base;
  base.push({ status: 'DELIVERED', at: deliveredAt ?? at(34), note: 'Handed to the customer' });
  return base;
}

/* CLI ---------------------------------------------------------------------- */
const isDirectRun = process.argv[1]?.includes('seed');
if (isDirectRun) {
  const reset = process.argv.includes('--reset');
  const { ensureDatabase } = await import('./bootstrap.js');
  try {
    await ensureDatabase();
    if (reset) await seedDemoData({ reset: true });
    else await seedDemoData();
    process.exit(0);
  } catch (error) {
    console.error('[qareeb] seed failed:', (error as Error).message);
    process.exit(1);
  }
}
