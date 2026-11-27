import {
  Box, Image, Text, Badge, Button, VStack, HStack, IconButton, useToast,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiHeart } from 'react-icons/fi';
import { FaHeart } from 'react-icons/fa';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import { resolveUploadUrl } from '../api/uploads';

const formatPrice = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function ProductCard({ product, type = 'product' }) {
  const { addItem } = useCart();
  const { toggle, has } = useWishlist();
  const { user } = useAuth();
  const toast = useToast();
  const fav = has(product.id);
  const bg = 'bg.surface';
  const muted = 'fg.muted';

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1, type);
    toast({
      title: 'Agregado al carrito',
      status: 'success',
      duration: 2000,
      isClosable: true,
      position: 'top-right',
    });
  };

  const handleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast({ title: 'Iniciá sesión para agregar a favoritos', status: 'info', duration: 2000, isClosable: true });
      return;
    }
    toggle(product.id);
    toast({
      title: fav ? 'Eliminado de favoritos' : 'Agregado a favoritos',
      status: 'success',
      duration: 1500,
      isClosable: true,
      position: 'top-right',
    });
  };

  const to = type === 'product' ? `/producto/${product.id}` : `/servicio/${product.id}`;
  const outOfStock = type === 'product' && product.stock === 0;
  const lowStock = type === 'product' && !product.is_promo && product.stock > 0 && product.stock <= 5;

  return (
    <Box
      bg={bg}
      borderRadius="lg"
      overflow="hidden"
      borderWidth="1px"
      borderColor="border.card"
      h="100%"
      display="flex"
      flexDirection="column"
      transition="all 0.2s ease"
      boxShadow="shadow-card"
      _hover={{
        boxShadow: 'shadow-cardHover',
        transform: 'translateY(-2px)',
        borderColor: 'border.cardHover',
      }}
    >
      <Box
        as={RouterLink}
        to={to}
        position="relative"
        w="100%"
        sx={{ aspectRatio: '4 / 3' }}
        bg="bg.subtle"
        overflow="hidden"
        flexShrink={0}
      >
        {type === 'product' && (
          <IconButton
            aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            icon={fav ? <FaHeart /> : <FiHeart />}
            size="sm"
            position="absolute"
            top={3}
            right={3}
            borderRadius="full"
            colorScheme={fav ? 'red' : 'gray'}
            variant={fav ? 'solid' : 'solid'}
            bg={fav ? undefined : 'whiteAlpha.900'}
            color={fav ? undefined : 'gray.700'}
            _dark={!fav ? { bg: 'blackAlpha.700', color: 'gray.100' } : undefined}
            _hover={{ transform: 'scale(1.04)' }}
            onClick={handleFavorite}
            zIndex={1}
          />
        )}
        <Image
          src={resolveUploadUrl(product.image) || 'https://via.placeholder.com/400x400?text=Compushop'}
          alt={product.name}
          w="100%"
          h="100%"
          objectFit="cover"
          objectPosition="center"
          transition="transform 0.25s ease"
          _hover={{ transform: 'scale(1.02)' }}
          fallbackSrc="https://via.placeholder.com/400x400?text=Compushop"
          loading="lazy"
          decoding="async"
        />
        {type === 'product' && product.is_promo && (
          <Badge
            position="absolute"
            top={3}
            left={3}
            colorScheme="accent"
            variant="solid"
            borderRadius="full"
            px={3}
            fontSize="xs"
            fontWeight="700"
          >
            Promoción
          </Badge>
        )}
        {lowStock && (
          <Badge position="absolute" top={3} left={3} colorScheme="orange" variant="solid" borderRadius="full" px={3} fontSize="xs" fontWeight="600">
            Últimas unidades
          </Badge>
        )}
        {outOfStock && (
          <Badge position="absolute" top={3} left={3} bg="gray.700" color="white" borderRadius="full" px={3} fontSize="xs" fontWeight="600">
            Sin stock
          </Badge>
        )}
      </Box>

      <VStack p={5} align="stretch" spacing={3} flex="1">
        <Box>
          <Text fontSize="xs" color="brand.500" _dark={{ color: 'brand.300' }} textTransform="uppercase" letterSpacing="0.05em" fontWeight="600" mb={1}>
            {product.brand || (type === 'service' ? 'Servicio' : 'Compushop')}
          </Text>
          <Text
            as={RouterLink}
            to={to}
            fontWeight="600"
            fontSize="md"
            noOfLines={2}
            minH="2.7em"
            lineHeight="1.35"
            title={product.name}
            _hover={{ color: 'brand.600', _dark: { color: 'brand.300' } }}
          >
            {product.name}
          </Text>
          {product.description && (
            <Text fontSize="sm" color={muted} noOfLines={2} mt={2} minH="2.6em">
              {product.description}
            </Text>
          )}
        </Box>

        <HStack justify="space-between" align="center" mt="auto" pt={1} spacing={3}>
          <Text fontWeight="700" fontSize="xl" letterSpacing="-0.02em" color="fg.default">
            {formatPrice(product.price)}
          </Text>
          <Button
            colorScheme="brand"
            borderRadius="full"
            size="sm"
            onClick={handleAdd}
            isDisabled={outOfStock}
            px={5}
            flexShrink={0}
          >
            {type === 'service' ? 'Contratar' : outOfStock ? 'Sin stock' : 'Agregar'}
          </Button>
        </HStack>
      </VStack>
    </Box>
  );
}
