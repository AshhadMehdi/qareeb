import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import { RequireAuth, RequireRole } from './components/RouteGuards';
import { EmptyState } from './components/ui';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Home from './pages/customer/Home';
import ShopPage from './pages/customer/Shop';
import Cart from './pages/customer/Cart';
import Checkout from './pages/customer/Checkout';
import Orders from './pages/customer/Orders';
import OrderTracking from './pages/customer/OrderTracking';
import Search from './pages/customer/Search';
import Account from './pages/customer/Account';
import { Addresses, Favorites, Notifications, Referrals, Support, Wallet } from './pages/customer/AccountSub';
import MerchantOverview from './pages/merchant/Overview';
import MerchantOrders from './pages/merchant/Orders';
import MerchantProducts from './pages/merchant/Products';
import MerchantShop from './pages/merchant/ShopSettings';
import MerchantRiders from './pages/merchant/Riders';
import MerchantSetup from './pages/merchant/Setup';
import RiderDeliveries from './pages/rider/Deliveries';
import RiderDelivery from './pages/rider/DeliveryDetail';
import RiderEarnings from './pages/rider/Earnings';
import RiderProfile from './pages/rider/Profile';
import AdminOverview from './pages/admin/Overview';
import AdminShops from './pages/admin/Shops';
import AdminUsers from './pages/admin/Users';
import AdminOrders from './pages/admin/AdminOrders';
import AdminMarketing from './pages/admin/Marketing';
import AdminSettings from './pages/admin/Settings';
import AdminAudit from './pages/admin/Audit';
import AdminPayouts from './pages/admin/Payouts';
import AdminSupport from './pages/admin/Support';
import MerchantPayouts from './pages/merchant/Payouts';
import { homeForRole, useAuth } from './store/auth';

function ShellLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function RootRedirect() {
  const user = useAuth((state) => state.user);
  const location = useLocation();
  if (!user) return <Navigate to="/home" replace state={{ from: location.pathname }} />;
  return <Navigate to={homeForRole(user.role)} replace />;
}

function NotFound() {
  return (
    <EmptyState
      title="This page moved or never existed"
      body="Head back to the shops around you."
      action={
        <a href="/home" className="btn btn-primary">
          Go home
        </a>
      }
    />
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* Customer app — browsing works signed out; checkout asks for a sign-in. */}
      <Route element={<ShellLayout />}>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/home" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/shop/:slug" element={<ShopPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route
          path="/checkout"
          element={
            <RequireAuth>
              <Checkout />
            </RequireAuth>
          }
        />
        <Route
          path="/orders"
          element={
            <RequireAuth>
              <Orders />
            </RequireAuth>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequireAuth>
              <OrderTracking />
            </RequireAuth>
          }
        />
        <Route
          path="/account"
          element={
            <RequireAuth>
              <Account />
            </RequireAuth>
          }
        />
        <Route
          path="/account/addresses"
          element={
            <RequireAuth>
              <Addresses />
            </RequireAuth>
          }
        />
        <Route
          path="/account/wallet"
          element={
            <RequireAuth>
              <Wallet />
            </RequireAuth>
          }
        />
        <Route
          path="/account/refer"
          element={
            <RequireAuth>
              <Referrals />
            </RequireAuth>
          }
        />
        <Route
          path="/support"
          element={
            <RequireAuth>
              <Support />
            </RequireAuth>
          }
        />
        <Route
          path="/favorites"
          element={
            <RequireAuth>
              <Favorites />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <Notifications />
            </RequireAuth>
          }
        />

        {/* Merchant app */}
        <Route
          path="/merchant"
          element={
            <RequireAuth>
              <RequireRole roles={['MERCHANT', 'ADMIN']}>
                <MerchantOverview />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/orders"
          element={
            <RequireAuth>
              <RequireRole roles={['MERCHANT', 'ADMIN']}>
                <MerchantOrders />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/products"
          element={
            <RequireAuth>
              <RequireRole roles={['MERCHANT', 'ADMIN']}>
                <MerchantProducts />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/shop"
          element={
            <RequireAuth>
              <RequireRole roles={['MERCHANT', 'ADMIN']}>
                <MerchantShop />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/payouts"
          element={
            <RequireAuth>
              <RequireRole roles={['MERCHANT', 'ADMIN']}>
                <MerchantPayouts />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/riders"
          element={
            <RequireAuth>
              <RequireRole roles={['MERCHANT', 'ADMIN']}>
                <MerchantRiders />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/merchant/setup"
          element={
            <RequireAuth>
              <RequireRole roles={['MERCHANT', 'ADMIN']}>
                <MerchantSetup />
              </RequireRole>
            </RequireAuth>
          }
        />

        {/* Rider app */}
        <Route
          path="/rider"
          element={
            <RequireAuth>
              <RequireRole roles={['RIDER', 'ADMIN']}>
                <RiderDeliveries />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/rider/deliveries/:id"
          element={
            <RequireAuth>
              <RequireRole roles={['RIDER', 'ADMIN']}>
                <RiderDelivery />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/rider/earnings"
          element={
            <RequireAuth>
              <RequireRole roles={['RIDER', 'ADMIN']}>
                <RiderEarnings />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/rider/profile"
          element={
            <RequireAuth>
              <RequireRole roles={['RIDER', 'ADMIN']}>
                <RiderProfile />
              </RequireRole>
            </RequireAuth>
          }
        />

        {/* Admin console */}
        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminOverview />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/shops"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminShops />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminUsers />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminOrders />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/marketing"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminMarketing />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminSettings />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/payouts"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminPayouts />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/support"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminSupport />
              </RequireRole>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <RequireAuth>
              <RequireRole roles={['ADMIN']}>
                <AdminAudit />
              </RequireRole>
            </RequireAuth>
          }
        />

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
