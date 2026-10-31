import { useEffect, useState } from 'react';
import { Container, Heading, SimpleGrid, Text, Center, Spinner } from '@chakra-ui/react';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import { useAuth } from '../context/AuthContext';

export default function Wishlist() {
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    api.get('/wishlist').then(r => {
      setProducts((r.data.items || []).map(i => ({
        id: Number(i.product_id || i.id),
        name: i.name,
        slug: i.slug,
        price: i.price,
        image: i.image,
        stock: i.stock,
        is_active: i.is_active,
        brand: i.brand,
        description: i.description,
        is_promo: i.is_promo,
      })));
    }).catch(() => setProducts([])).finally(() => setLoading(false));
  }, [user?.id]);

  if (loading) {
    return <Center py={20}><Spinner size="xl" color="brand.500" /></Center>;
  }

  return (
    <Container maxW="7xl" py={10}>
      <Heading mb={6}>Mis favoritos</Heading>
      {!user ? (
        <Text color="fg.muted">Iniciá sesión para ver y guardar tus favoritos.</Text>
      ) : products.length === 0 ? (
        <Text color="fg.muted">Aún no tenés productos en favoritos.</Text>
      ) : (
        <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </SimpleGrid>
      )}
    </Container>
  );
}
