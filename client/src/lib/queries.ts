import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from './api';
import type {
  Address,
  AppConfig,
  DeliveryZone,
  Notification,
  Order,
  Product,
  ProductSearchHit,
  Promo,
  Quote,
  RunnerProfile,
  Shop,
  User,
} from './types';
import { useAuth } from '../store/auth';

/* ---------------------------------------------------------------- discovery */

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => apiGet<AppConfig>('/config'),
    staleTime: 5 * 60_000,
  });
}

export type ShopFilters = {
  lat?: number;
  lng?: number;
  radius?: number;
  q?: string;
  category?: string;
  sort?: 'distance' | 'rating' | 'fee' | 'eta';
  openNow?: boolean;
};

export function useShops(filters: ShopFilters) {
  const params = new URLSearchParams();
  if (filters.lat != null) params.set('lat', String(filters.lat));
  if (filters.lng != null) params.set('lng', String(filters.lng));
  if (filters.radius != null) params.set('radius', String(filters.radius));
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.sort) params.set('sort', filters.sort);
  if (filters.openNow) params.set('openNow', 'true');
  const query = params.toString();

  return useQuery({
    queryKey: ['shops', query],
    queryFn: () => apiGet<{ shops: Shop[]; radiusKm: number }>(`/shops?${query}`),
    staleTime: 30_000,
    enabled: filters.lat != null && filters.lng != null,
  });
}

export function useShopCategories() {
  return useQuery({
    queryKey: ['shop-categories'],
    queryFn: () => apiGet<{ categories: { key: string; label: string; count: number }[] }>('/shops/categories'),
    staleTime: 5 * 60_000,
  });
}

export function useShop(slug: string | undefined, point: { lat: number; lng: number }) {
  return useQuery({
    queryKey: ['shop', slug, point.lat, point.lng],
    queryFn: () =>
      apiGet<{
        shop: Shop;
        categories: string[];
        products: Product[];
        zones: DeliveryZone[];
        reviews: { id: string; shopRating: number; runnerRating: number | null; comment: string | null; customerName: string; createdAt: string }[];
      }>(`/shops/${slug}?lat=${point.lat}&lng=${point.lng}`),
    enabled: Boolean(slug),
  });
}

export function useSearch(term: string, point: { lat: number; lng: number }) {
  return useQuery({
    queryKey: ['search', term, point.lat, point.lng],
    queryFn: () =>
      apiGet<{ products: ProductSearchHit[]; shops: Shop[] }>(
        `/shops/search?q=${encodeURIComponent(term)}&lat=${point.lat}&lng=${point.lng}`,
      ),
    enabled: term.trim().length >= 2,
    staleTime: 20_000,
  });
}

/* ------------------------------------------------------------------- account */

export function useProfile() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['profile'],
    queryFn: () =>
      apiGet<{
        user: User;
        addresses: Address[];
        favorites: { id: string; shopId: string; name: string; slug: string; category: string; addressLine: string; ratingAvg: number; isOpen: boolean }[];
        stats: { total: number; delivered: number; spent: number };
      }>('/users/me'),
    enabled: Boolean(token),
  });
}

export function useNotifications() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => apiGet<{ notifications: Notification[]; unread: number }>('/users/me/notifications'),
    enabled: Boolean(token),
    refetchInterval: 30_000,
  });
}

export function useWallet() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['wallet'],
    queryFn: () =>
      apiGet<{
        points: number;
        valuePkr: number;
        history: { id: string; orderNumber: string; pointsEarned: number; pointsRedeemed: number; deliveredAt: string | null; status: string }[];
      }>('/users/me/wallet'),
    enabled: Boolean(token),
  });
}

export function usePromos() {
  return useQuery({
    queryKey: ['promos-public'],
    queryFn: () => apiGet<{ promos: Promo[] }>('/users/me/promos'),
    staleTime: 2 * 60_000,
  });
}

/* -------------------------------------------------------------------- orders */

export function useOrders(status: string = 'ALL') {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['orders', status],
    queryFn: () => apiGet<{ orders: Order[]; active: number }>(`/orders?status=${status}`),
    enabled: Boolean(token),
    refetchInterval: 20_000,
  });
}

export function useOrder(id: string | undefined) {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['order', id],
    queryFn: () =>
      apiGet<{
        order: Order;
        group: Order[];
        events: { id: string; status: string; note: string | null; actorRole: string | null; createdAt: string }[];
        messages: { id: string; senderId: string; senderRole: string; body: string; createdAt: string }[];
        canCancel: boolean;
        review: { shopRating: number; runnerRating: number | null; comment: string | null } | null;
      }>(`/orders/${id}`),
    enabled: Boolean(id && token),
    refetchInterval: 15_000,
  });
}

export function useQuote(input: {
  groups: { shopId: string; items: { productId: string; quantity: number; note?: string | null }[]; promoCode?: string | null; tip?: number }[];
  addressId?: string | null;
  address?: { label: string; line1: string; area?: string | null; city?: string; lat: number; lng: number } | null;
  usePoints?: number;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['quote', JSON.stringify(input)],
    queryFn: () =>
      apiPost<Quote>('/orders/quote', {
        groups: input.groups,
        addressId: input.addressId ?? undefined,
        address: input.addressId ? undefined : input.address ?? undefined,
        usePoints: input.usePoints ?? 0,
      }),
    enabled: (input.enabled ?? true) && input.groups.length > 0,
    retry: false,
    staleTime: 10_000,
  });
}

export function usePlaceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPost<{ groupId: string; orders: Order[] }>('/orders/checkout', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      void queryClient.invalidateQueries({ queryKey: ['wallet'] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => apiPost(`/orders/${id}/cancel`, { reason }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

export function useReviewOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; shopRating: number; runnerRating?: number | null; comment?: string }) =>
      apiPost(`/orders/${id}/review`, body),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['order', variables.id] });
    },
  });
}

export function useSendMessage(orderId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiPost(`/orders/${orderId}/messages`, { body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
  });
}

/* ------------------------------------------------------------------ merchant */

export function useMerchantOverview() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['merchant', 'shop'],
    queryFn: () =>
      apiGet<{
        shop: Shop & { ownerId: string; prepTimeMin: number; minOrder: number; phone: string | null; description: string | null; deliveryMode: string; tags: string[] };
        zones: DeliveryZone[];
        products: Product[];
        reviews: { id: string; shopRating: number; comment: string | null; customerName: string; createdAt: string }[];
        runners: RunnerProfile[];
        isOnboarded: boolean;
        owner: { id: string; name: string; email: string };
      }>('/merchant/shop'),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useMerchantOrders(status: string) {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['merchant', 'orders', status],
    queryFn: () =>
      apiGet<{ orders: Order[]; counts: Record<string, number> }>(`/merchant/orders?status=${status}`),
    enabled: Boolean(token),
    refetchInterval: 15_000,
  });
}

export function useMerchantAnalytics() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['merchant', 'analytics'],
    queryFn: () =>
      apiGet<{
        today: { orders: number; revenue: number; pending: number; onTheWay: number };
        window: { days: number; orders: number; revenue: number; commission: number; payout: number; averageOrderValue: number };
        daily: { date: string; orders: number; revenue: number }[];
        byStatus: Record<string, number>;
        topProducts: { name: string; quantity: number; revenue: number }[];
        lowStock: Product[];
        settings: { commissionPct: number; serviceFeePct: number };
      }>('/merchant/analytics'),
    enabled: Boolean(token),
  });
}

export function useMerchantRunners() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['merchant', 'runners'],
    queryFn: () => apiGet<{ team: RunnerProfile[]; nearby: RunnerProfile[] }>('/merchant/runners'),
    enabled: Boolean(token),
  });
}

export function useMerchantPromos() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['merchant', 'promos'],
    queryFn: () => apiGet<{ promos: Promo[] }>('/merchant/promos'),
    enabled: Boolean(token),
  });
}

export function useUpdateShop() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Record<string, unknown>) => apiPatch('/merchant/shop', body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['merchant', 'shop'] }),
  });
}

export function useSetOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason, note }: { id: string; status: string; reason?: string; note?: string }) =>
      apiPost(`/merchant/orders/${id}/status`, { status, reason, note }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['merchant', 'orders'] });
      void queryClient.invalidateQueries({ queryKey: ['merchant', 'analytics'] });
      void queryClient.invalidateQueries({ queryKey: ['merchant', 'shop'] });
    },
  });
}

export function useAssignRunner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, runnerId }: { id: string; runnerId: string }) =>
      apiPost<{ runnerId: string; runner: { id: string; name: string } | null }>(`/merchant/orders/${id}/assign`, {
        runnerId,
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['merchant', 'orders'] }),
  });
}

export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string } & Record<string, unknown>) =>
      id ? apiPatch(`/merchant/products/${id}`, body) : apiPost('/merchant/products', body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['merchant', 'shop'] }),
  });
}

export function useSetStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, delta }: { id: string; delta: number }) => apiPost(`/merchant/products/${id}/stock`, { delta }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['merchant', 'shop'] }),
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/merchant/products/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['merchant', 'shop'] }),
  });
}

export function useSaveZones() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string } & Record<string, unknown>) =>
      id ? apiPatch(`/merchant/zones/${id}`, body) : apiPost('/merchant/zones', body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['merchant', 'shop'] }),
  });
}

export function useDeleteZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete(`/merchant/zones/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['merchant', 'shop'] }),
  });
}

/* --------------------------------------------------------------------- rider */

export function useRunnerProfile() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['runner', 'me'],
    queryFn: () => apiGet<{ profile: RunnerProfile }>('/runner/me'),
    enabled: Boolean(token),
  });
}

export function useRunnerDeliveries(view: 'active' | 'history') {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['runner', 'deliveries', view],
    queryFn: () =>
      apiGet<{ active: Order[]; history: Order[]; available: Order[] }>(`/runner/deliveries?view=${view}`),
    enabled: Boolean(token),
    refetchInterval: 12_000,
  });
}

export function useRunnerEarnings() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['runner', 'earnings'],
    queryFn: () =>
      apiGet<{
        today: number;
        week: number;
        month: number;
        deliveries: { today: number; week: number; month: number };
        tips: number;
        cashInHand: number;
        daily: { date: string; amount: number }[];
        recent: { id: string; orderNumber: string; deliveredAt: string | null; earned: number; tip: number }[];
      }>('/runner/earnings'),
    enabled: Boolean(token),
  });
}

export function useRunnerMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['runner'] });
  };
  return {
    setAvailability: useMutation({
      mutationFn: (body: { isAvailable?: boolean; vehicleType?: string }) => apiPatch('/runner/me', body),
      onSuccess: invalidate,
    }),
    pushLocation: useMutation({
      mutationFn: (body: { lat: number; lng: number; heading?: number | null; orderId?: string | null }) =>
        apiPost('/runner/location', body),
    }),
    accept: useMutation({
      mutationFn: (id: string) => apiPost(`/runner/deliveries/${id}/accept`),
      onSuccess: invalidate,
    }),
    decline: useMutation({
      mutationFn: (id: string) => apiPost(`/runner/deliveries/${id}/decline`),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status, cashCollected }: { id: string; status: 'ON_THE_WAY' | 'DELIVERED'; cashCollected?: number }) =>
        apiPost(`/runner/deliveries/${id}/status`, { status, cashCollected }),
      onSuccess: invalidate,
    }),
    simulate: useMutation({
      mutationFn: (id: string) =>
        apiPost<{ waypoints: { lat: number; lng: number }[]; stepSeconds: number; distanceKm: number }>(
          `/runner/deliveries/${id}/simulate`,
        ),
    }),
  };
}

/* --------------------------------------------------------------------- admin */

export function useAdminStats() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () =>
      apiGet<{
        totals: { gmv: number; commission: number; serviceFees: number; orders: number; delivered: number; cancelled: number; averageOrderValue: number };
        counts: { users: { role: string; count: number }[]; shops: number; approvedShops: number; pendingShops: number; riders: number; ridersOnline: number };
        daily: { date: string; orders: number; gmv: number }[];
        live: {
          shops: { id: string; name: string; lat: number; lng: number; isOpen: boolean; status: string; ratingAvg: number }[];
          riders: { id: string; name: string; lat: number | null; lng: number | null; isAvailable: boolean; activeOrders: number }[];
        };
      }>('/admin/stats'),
    enabled: Boolean(token),
    refetchInterval: 30_000,
  });
}

export function useAdminShops(status = 'ALL') {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['admin', 'shops', status],
    queryFn: () =>
      apiGet<{
        shops: (Shop & { ownerName: string | null; ownerEmail: string | null; zones: number; products: number })[];
        counts: { status: string; count: number }[];
      }>(`/admin/shops?status=${status}`),
    enabled: Boolean(token),
  });
}

export function useAdminUsers(role = 'ALL') {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['admin', 'users', role],
    queryFn: () =>
      apiGet<{ users: (User & { isActive: boolean; orders: number; spent: number })[] }>(`/admin/users?role=${role}`),
    enabled: Boolean(token),
  });
}

export function useAdminOrders(status = 'ALL') {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['admin', 'orders', status],
    queryFn: () =>
      apiGet<{
        orders: (Order & {
          shopId: string;
          shopName: string | null;
          customerName: string | null;
          items: { name: string; quantity: number; total: number }[];
        })[];
      }>(`/admin/orders?status=${status}`),
    enabled: Boolean(token),
    refetchInterval: 30_000,
  });
}

export function useAdminSettings() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => apiGet<{ settings: Record<string, string | number> }>('/admin/settings'),
    enabled: Boolean(token),
  });
}

export function useAdminAudit() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['admin', 'audit'],
    queryFn: () =>
      apiGet<{
        logs: { id: string; action: string; entity: string; entityId: string | null; actorName: string; createdAt: string; meta: Record<string, unknown> }[];
      }>('/admin/audit-logs'),
    enabled: Boolean(token),
  });
}

export function useAdminMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
  };
  return {
    setShopStatus: useMutation({
      mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
        apiPost(`/admin/shops/${id}/status`, { status, reason }),
      onSuccess: invalidate,
    }),
    updateUser: useMutation({
      mutationFn: ({ id, ...body }: { id: string } & Record<string, unknown>) => apiPatch(`/admin/users/${id}`, body),
      onSuccess: invalidate,
    }),
    saveSettings: useMutation({
      mutationFn: (body: Record<string, unknown>) => apiPatch('/admin/settings', body),
      onSuccess: invalidate,
    }),
    createPromo: useMutation({
      mutationFn: (body: Record<string, unknown>) => apiPost('/admin/promos', body),
      onSuccess: invalidate,
    }),
    broadcast: useMutation({
      mutationFn: (body: { title: string; body: string; audience: string }) => apiPost('/admin/broadcast', body),
      onSuccess: invalidate,
    }),
    createCampaign: useMutation({
      mutationFn: (body: Record<string, unknown>) => apiPost('/admin/campaigns', body),
      onSuccess: invalidate,
    }),
    sendCampaign: useMutation({
      mutationFn: (id: string) => apiPost(`/admin/campaigns/${id}/send`),
      onSuccess: invalidate,
    }),
  };
}

/* earnings wallet, referrals and support ----------------------------------- */

export type Payout = {
  id: string;
  role: string;
  shopId: string | null;
  amount: number;
  method: 'JAZZCASH' | 'EASYPAISA' | 'BANK';
  accountTitle: string;
  accountNumber: string;
  status: 'PENDING' | 'APPROVED' | 'PAID' | 'REJECTED';
  note: string | null;
  decidedAt: string | null;
  createdAt: string;
};

export type WalletSummary = {
  earned: number;
  commission: number;
  tips: number;
  cashInHand: number;
  paidOut: number;
  pending: number;
  available: number;
  minPayout: number;
  payouts: Payout[];
};

export function useMyWallet() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['wallet', 'payouts'],
    queryFn: () => apiGet<{ role: string; shopId: string | null; wallet: WalletSummary }>('/users/me/payouts'),
    enabled: Boolean(token),
  });
}

export function useRequestPayout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { amount: number; method: string; accountTitle: string; accountNumber: string }) =>
      apiPost<{ payout: Payout; available: number }>('/users/me/payouts', body),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['wallet'] }),
  });
}

export function useReferral() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['referral'],
    queryFn: () =>
      apiGet<{
        code: string;
        reward: { referrer: number; referee: number };
        invited: { id: string; name: string; joinedAt: string; credited: boolean }[];
        stats: { invited: number; converted: number; earned: number };
      }>('/users/me/referral'),
    enabled: Boolean(token),
  });
}

export type SupportTicket = {
  id: string;
  orderId: string | null;
  subject: string;
  category: string;
  priority: string;
  status: 'OPEN' | 'ANSWERED' | 'RESOLVED';
  createdAt: string;
  updatedAt: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  messages: { id: string; authorId: string; authorName: string | null; authorRole: string; body: string; createdAt: string }[];
};

export function useMyTickets() {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['tickets'],
    queryFn: () => apiGet<{ tickets: SupportTicket[]; open: number }>('/users/me/tickets'),
    enabled: Boolean(token),
  });
}

export function useTicketMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['tickets'] });
  return {
    create: useMutation({
      mutationFn: (body: { subject: string; body: string; category?: string; orderId?: string | null; priority?: string }) =>
        apiPost('/users/me/tickets', body),
      onSuccess: invalidate,
    }),
    reply: useMutation({
      mutationFn: ({ id, body }: { id: string; body: string }) => apiPost(`/users/me/tickets/${id}/reply`, { body }),
      onSuccess: invalidate,
    }),
  };
}

export function useAdminPayouts(status = 'ALL') {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['admin', 'payouts', status],
    queryFn: () =>
      apiGet<{
        payouts: (Payout & { name: string | null; email: string | null; phone: string | null; shopName: string | null })[];
        totals: { status: string; sum: number; count: number }[];
      }>(`/admin/payouts?status=${status}`),
    enabled: Boolean(token),
  });
}

export function useAdminPayMutations() {
  const queryClient = useQueryClient();
  return {
    decide: useMutation({
      mutationFn: ({ id, status, note }: { id: string; status: 'APPROVED' | 'PAID' | 'REJECTED'; note?: string }) =>
        apiPost(`/admin/payouts/${id}/status`, { status, note }),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['admin', 'payouts'] });
        void queryClient.invalidateQueries({ queryKey: ['wallet'] });
      },
    }),
  };
}

export function useAdminTickets(status = 'ALL') {
  const token = useAuth((state) => state.token);
  return useQuery({
    queryKey: ['admin', 'tickets', status],
    queryFn: () =>
      apiGet<{ tickets: SupportTicket[]; counts: { open: number; answered: number; resolved: number; high: number } }>(
        `/admin/tickets?status=${status}`,
      ),
    enabled: Boolean(token),
  });
}

export function useAdminTicketMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] });
  return {
    reply: useMutation({
      mutationFn: ({ id, body }: { id: string; body: string }) => apiPost(`/admin/tickets/${id}/reply`, { body }),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) => apiPost(`/admin/tickets/${id}/status`, { status }),
      onSuccess: invalidate,
    }),
  };
}
