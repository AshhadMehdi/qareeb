import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '../lib/types';

export type CartLine = {
  productId: string;
  name: string;
  unit: string;
  price: number;
  emoji: string | null;
  imageUrl: string | null;
  quantity: number;
  note?: string | null;
  stock: number;
};

export type CartGroup = {
  shopId: string;
  shopName: string;
  shopSlug: string;
  lines: CartLine[];
  promoCode?: string | null;
  tip?: number;
  note?: string | null;
};

type CartState = {
  groups: CartGroup[];
  /** set at checkout and cleared once an order group is created */
  usePoints: number;
  lastOrderId: string | null;
  add: (shop: { id: string; name: string; slug: string }, product: Product, quantity?: number) => void;
  setQuantity: (shopId: string, productId: string, quantity: number) => void;
  remove: (shopId: string, productId: string) => void;
  setLineNote: (shopId: string, productId: string, note: string) => void;
  setPromo: (shopId: string, code: string | null) => void;
  setTip: (shopId: string, tip: number) => void;
  setNote: (shopId: string, note: string) => void;
  setUsePoints: (points: number) => void;
  clearGroup: (shopId: string) => void;
  clear: () => void;
  markOrdered: (orderId: string) => void;
};

const emptyGroups = (): CartGroup[] => [];

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      groups: emptyGroups(),
      usePoints: 0,
      lastOrderId: null,

      add: (shop, product, quantity = 1) =>
        set((state) => {
          const groups = [...state.groups];
          const index = groups.findIndex((entry) => entry.shopId === shop.id);
          const group: CartGroup =
            index === -1
              ? { shopId: shop.id, shopName: shop.name, shopSlug: shop.slug, lines: [], tip: 0 }
              : { ...groups[index]!, lines: [...groups[index]!.lines] };
          if (index === -1) groups.push(group);
          else groups[index] = group;

          const existing = group.lines.find((line) => line.productId === product.id);
          if (existing) {
            existing.quantity = Math.min(existing.quantity + quantity, Math.max(product.stock, 1));
          } else {
            group.lines.push({
              productId: product.id,
              name: product.name,
              unit: product.unit,
              price: product.price,
              emoji: product.emoji,
              imageUrl: product.imageUrl,
              quantity: Math.min(quantity, Math.max(product.stock, 1)),
              stock: product.stock,
              note: null,
            });
          }
          return { groups };
        }),

      setQuantity: (shopId, productId, quantity) =>
        set((state) => ({
          groups: state.groups
            .map((group) =>
              group.shopId !== shopId
                ? group
                : {
                    ...group,
                    lines: group.lines
                      .map((line) =>
                        line.productId === productId
                          ? { ...line, quantity: Math.min(Math.max(quantity, 0), Math.max(line.stock, 1)) }
                          : line,
                      )
                      .filter((line) => line.quantity > 0),
                  },
            )
            .filter((group) => group.lines.length > 0),
        })),

      remove: (shopId, productId) =>
        set((state) => ({
          groups: state.groups
            .map((group) =>
              group.shopId !== shopId
                ? group
                : { ...group, lines: group.lines.filter((line) => line.productId !== productId) },
            )
            .filter((group) => group.lines.length > 0),
        })),

      setLineNote: (shopId, productId, note) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.shopId !== shopId
              ? group
              : {
                  ...group,
                  lines: group.lines.map((line) =>
                    line.productId === productId ? { ...line, note: note.slice(0, 200) } : line,
                  ),
                },
          ),
        })),

      setPromo: (shopId, code) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.shopId === shopId ? { ...group, promoCode: code ? code.toUpperCase() : null } : group,
          ),
        })),

      setTip: (shopId, tip) =>
        set((state) => ({
          groups: state.groups.map((group) => (group.shopId === shopId ? { ...group, tip } : group)),
        })),

      setNote: (shopId, note) =>
        set((state) => ({
          groups: state.groups.map((group) =>
            group.shopId === shopId ? { ...group, note: note.slice(0, 300) } : group,
          ),
        })),

      setUsePoints: (points) => set({ usePoints: Math.max(0, Math.round(points)) }),

      clearGroup: (shopId) => set((state) => ({ groups: state.groups.filter((group) => group.shopId !== shopId) })),
      clear: () => set({ groups: [], usePoints: 0 }),
      markOrdered: (orderId) => set({ lastOrderId: orderId, groups: [], usePoints: 0 }),
    }),
    { name: 'qareeb.cart' },
  ),
);

/* derived helpers ---------------------------------------------------------- */

export const lineCount = (group: CartGroup): number =>
  group.lines.reduce((total, line) => total + line.quantity, 0);

export const groupSubtotal = (group: CartGroup): number =>
  group.lines.reduce((total, line) => total + line.price * line.quantity, 0);

export const cartCount = (groups: CartGroup[]): number =>
  groups.reduce((total, group) => total + lineCount(group), 0);

export const cartSubtotal = (groups: CartGroup[]): number =>
  groups.reduce((total, group) => total + groupSubtotal(group), 0);

export const quantityFor = (groups: CartGroup[], shopId: string, productId: string): number =>
  groups.find((group) => group.shopId === shopId)?.lines.find((line) => line.productId === productId)?.quantity ?? 0;
