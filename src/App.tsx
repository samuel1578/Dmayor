import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ScrollToTop } from './components/ScrollToTop';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { ProductDetail } from './pages/ProductDetail';
import { About } from './pages/About';
import { Blog } from './pages/Blog';
import { Contact } from './pages/Contact';
import { Cart } from './pages/Cart';
import { Checkout } from './pages/Checkout';
import { OrderConfirmation } from './pages/OrderConfirmation';
import { CustomerLogin } from './pages/auth/CustomerLogin';
import { CustomerSignup } from './pages/auth/CustomerSignup';
import { AuthenticatedRoute } from './components/auth/AuthenticatedRoute';
import { AccountLayout } from './components/account/AccountLayout';
import { AccountOverview } from './pages/account/AccountOverview';
import { AccountProfile } from './pages/account/AccountProfile';
import { AccountAddresses } from './pages/account/AccountAddresses';
import { AccountOrders } from './pages/account/AccountOrders';
import { AccountOrderDetail } from './pages/account/AccountOrderDetail';
import { AdminRoute } from './components/admin/AdminRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AdminProductEditor } from './pages/admin/AdminProductEditor';
import { AdminCategories } from './pages/admin/AdminCategories';
import { AdminOrders } from './pages/admin/AdminOrders';
import { AdminOrderDetail } from './pages/admin/AdminOrderDetail';

function App() {
  return (
    <BrowserRouter>
      {/* Global route scroll restoration — mounted once, no per-page scroll calls. */}
      <ScrollToTop />
      <Routes>
        {/* Public storefront — unchanged behaviour, public chrome */}
        <Route
          element={
            <Layout>
              <Outlet />
            </Layout>
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/product/:slug" element={<ProductDetail />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/cart" element={<Cart />} />

          {/* Customer account — any signed-in user, no admin role required.
              One D1 guard wraps the whole area; no per-page auth checks. */}
          <Route element={<AuthenticatedRoute />}>
            {/* Checkout (E1) — authenticated customers only. A guest reaching
                /checkout is redirected to /login and returned here afterwards. */}
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/order-confirmation/:orderNumber" element={<OrderConfirmation />} />

            <Route path="/account" element={<AccountLayout />}>
              <Route index element={<AccountOverview />} />
              <Route path="profile" element={<AccountProfile />} />
              <Route path="addresses" element={<AccountAddresses />} />
              {/* Phase E2 — customer order history + one order, read-only. */}
              <Route path="orders" element={<AccountOrders />} />
              <Route path="orders/:orderNumber" element={<AccountOrderDetail />} />
            </Route>
          </Route>
        </Route>

        {/* Customer auth — standalone brand screens (own chrome, like admin login) */}
        <Route path="/login" element={<CustomerLogin />} />
        <Route path="/signup" element={<CustomerSignup />} />

        {/* Admin — guarded shell, separate from the public Layout */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductEditor />} />
            <Route path="products/:id" element={<AdminProductEditor />} />
            <Route path="categories" element={<AdminCategories />} />
            {/* Phase E3 — manual payment + fulfilment operations. */}
            <Route path="orders" element={<AdminOrders />} />
            <Route path="orders/:id" element={<AdminOrderDetail />} />
            {/* Later phases: collections, blog */}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
