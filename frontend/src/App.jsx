import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Flex, Spinner, Center } from '@chakra-ui/react';
import { lazy, Suspense } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Cart from './pages/Cart';
import Login from './pages/Login';
import Register from './pages/Register';
import Contact from './pages/Contact';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Wishlist from './pages/Wishlist';
import { useAuth } from './context/AuthContext';

const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminServices = lazy(() => import('./pages/admin/AdminServices'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminMessages = lazy(() => import('./pages/admin/AdminMessages'));
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'));

function PageLoader() {
  return (
    <Center py={20}>
      <Spinner size="xl" color="brand.500" />
    </Center>
  );
}

function PrivateAdmin({ children }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user || !isAdmin) return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  return children;
}

export default function App() {
  return (
    <Flex direction="column" minH="100vh">
      <Navbar />
      <Box flex="1" pt="72px">
        <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/productos" element={<Products />} />
        <Route path="/producto/:id" element={<ProductDetail />} />
        <Route path="/servicios" element={<Services />} />
        <Route path="/servicio/:id" element={<ServiceDetail />} />
        <Route path="/carrito" element={<Cart />} />
        <Route path="/favoritos" element={<Wishlist />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Register />} />
        <Route path="/contacto" element={<Contact />} />
        <Route path="/recuperar-clave" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/admin"
          element={
            <PrivateAdmin>
              <Suspense fallback={<PageLoader />}>
                <AdminLayout />
              </Suspense>
            </PrivateAdmin>
          }
        >
          <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="productos" element={<Suspense fallback={<PageLoader />}><AdminProducts /></Suspense>} />
          <Route path="servicios" element={<Suspense fallback={<PageLoader />}><AdminServices /></Suspense>} />
          <Route path="pedidos" element={<Suspense fallback={<PageLoader />}><AdminOrders /></Suspense>} />
          <Route path="usuarios" element={<Suspense fallback={<PageLoader />}><AdminUsers /></Suspense>} />
          <Route path="mensajes" element={<Suspense fallback={<PageLoader />}><AdminMessages /></Suspense>} />
          <Route path="configuracion" element={<Suspense fallback={<PageLoader />}><AdminSettings /></Suspense>} />
        </Route>
      </Routes>
      </Box>
      <Footer />
    </Flex>
  );
}
