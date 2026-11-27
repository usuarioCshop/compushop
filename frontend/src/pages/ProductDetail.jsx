import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box, Container, Heading, Text, Image, Button, HStack, VStack, Badge, Spinner, Center,
  SimpleGrid, useToast, List, ListItem,
} from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';
import { FiShoppingCart, FiAlertCircle } from 'react-icons/fi';
import api from '../api/client';
import { useCart } from '../context/CartContext';
import { resolveUploadUrl } from '../api/uploads';
import EmptyState from '../components/EmptyState';

const formatPrice = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const bg = 'bg.surface';

  useEffect(() => {
    api.get(`/products/${id}`).then(r => setProduct(r.data.product))
      .catch(() => setProduct(null)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Center py={20}><Spinner size="xl" color="brand.500" /></Center>;
  if (!product) return (
    <Container maxW="6xl" py={16}>
      <EmptyState
        icon={FiAlertCircle}
        title="Producto no encontrado"
        description="El artículo que buscás no existe o fue retirado del catálogo."
        actionLabel="Ver catálogo"
        onAction={() => navigate('/productos')}
      />
    </Container>
  );

  const handleAdd = () => {
    addItem(product, 1, 'product');
    toast({ title: 'Agregado al carrito', status: 'success', duration: 2000 });
  };

  return (
    <Container maxW="6xl" py={10}>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={10}>
        <Box bg={bg} borderRadius="lg" overflow="hidden" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card">
          <Image src={resolveUploadUrl(product.image)} alt={product.name} w="100%" maxH="420px" objectFit="cover" loading="lazy" decoding="async"
            fallbackSrc="https://via.placeholder.com/600x400?text=Compushop" />
        </Box>
        <VStack align="start" spacing={5}>
          <HStack spacing={2} flexWrap="wrap">
            {product.is_promo && <Badge colorScheme="accent" fontSize="sm" px={3} py={1} borderRadius="full">Promoción</Badge>}
            {product.brand && <Badge colorScheme="brand" variant="subtle" px={2} py={1} borderRadius="full">{product.brand}</Badge>}
            {!product.is_promo && product.stock <= 5 && product.stock > 0 && <Badge colorScheme="orange" variant="subtle" px={2} py={1} borderRadius="full">Últimas unidades</Badge>}
            {!product.is_promo && product.stock === 0 && <Badge colorScheme="red" variant="subtle" px={2} py={1} borderRadius="full">Sin stock</Badge>}
          </HStack>
          <Heading size="lg" letterSpacing="-0.02em" lineHeight="1.2">{product.name}</Heading>
          <Text fontSize="3xl" fontWeight="800" letterSpacing="-0.02em" color="fg.default">{formatPrice(product.price)}</Text>
          <Text color="fg.muted" lineHeight="1.8">{product.description}</Text>
          {product.stock !== undefined && (
            <Text fontSize="sm" color={product.stock > 0 ? 'green.600' : 'red.500'} _dark={{ color: product.stock > 0 ? 'green.300' : 'red.300' }}>
              {product.stock > 0 ? `Stock disponible: ${product.stock} unidades` : 'Sin stock'}
            </Text>
          )}
          {product.specs && (
            <Box w="100%">
              <Text fontWeight="600" mb={3}>Especificaciones</Text>
              <List spacing={2} fontSize="sm" color="fg.muted">
                {Object.entries(product.specs).map(([k, v]) => (
                  <ListItem key={k}><Text as="span" fontWeight="600" color="fg.default">{k}:</Text> {String(v)}</ListItem>
                ))}
              </List>
            </Box>
          )}
          <Button leftIcon={<FiShoppingCart />} colorScheme="brand" size="lg" borderRadius="full" px={8} onClick={handleAdd}
            isDisabled={product.stock === 0}>
            {product.stock === 0 ? 'Sin stock' : 'Agregar al carrito'}
          </Button>
        </VStack>
      </SimpleGrid>
    </Container>
  );
}
