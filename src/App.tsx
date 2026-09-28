import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Shop } from './pages/Shop';
import { ProductDetail } from './pages/ProductDetail';
import { Collections } from './pages/Collections';
import { About } from './pages/About';
import { Blog } from './pages/Blog';
import { Contact } from './pages/Contact';
import { Cart } from './pages/Cart';
import { CustomerLogin } from './pages/auth/CustomerLogin';
import { CustomerSignup } from './pages/auth/CustomerSignup';
import { AuthenticatedRoute } from './components/auth/AuthenticatedRoute';
import { AccountLayout } from './components/account/AccountLayout';
import { AccountOverview } from './pages/account/AccountOverview';
import { AccountProfile } from './pages/account/AccountProfile';
import { AccountAddresses } from './pages/account/AccountAddresses';
import { AdminRoute } from './components/admin/AdminRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AdminProductEditor } from './pages/admin/AdminProductEditor';
import { AdminCategories } from './pages/admin/AdminCategories';

function App() {
  return (
    <BrowserRouter>
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
          <Route path="/collections" element={<Collections />} />
          <Route path="/about" element={<About />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/cart" element={<Cart />} />

          {/* Customer account — any signed-in user, no admin role required.
              One D1 guard wraps the whole area; no per-page auth checks. */}
          <Route element={<AuthenticatedRoute />}>
            <Route path="/account" element={<AccountLayout />}>
              <Route index element={<AccountOverview />} />
              <Route path="profile" element={<AccountProfile />} />
              <Route path="addresses" element={<AccountAddresses />} />
              {/* Orders route deferred to Phase E — placeholder nav entry only */}
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
            {/* Later phases: collections, blog */}
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
