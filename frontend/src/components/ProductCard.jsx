import {
  Box, Image, Text, Badge, Button, VStack, HStack, IconButton, useToast,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { FiHeart, FiShoppingCart, FiEye, FiShoppingBag } from 'react-icons/fi';
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
  const navigate = useNavigate();
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

  const handleBuy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1, type);
    navigate('/carrito');
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
      flexDirection={{ base: 'row', sm: 'column' }}
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
        w={{ base: '112px', sm: '100%' }}
        minW={{ base: '112px', sm: 'auto' }}
        sx={{ aspectRatio: { base: '1 / 1', sm: '4 / 3' } }}
        bg="bg.subtle"
        overflow="hidden"
        flexShrink={0}
      >
        {type === 'product' && (
          <IconButton
            aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
            icon={fav ? <FaHeart /> : <FiHeart />}
            size="xs"
            position="absolute"
            top={2}
            right={2}
            borderRadius="full"
            colorScheme={fav ? 'red' : 'gray'}
            variant="solid"
            bg={fav ? undefined : 'whiteAlpha.900'}
            color={fav ? undefined : 'gray.700'}
            _dark={!fav ? { bg: 'blackAlpha.700', color: 'gray.100' } : undefined}
            onClick={handleFavorite}
            zIndex={1}
            display={{ base: 'none', sm: 'inline-flex' }}
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
            top={2}
            left={2}
            colorScheme="accent"
            variant="solid"
            borderRadius="full"
            px={2}
            fontSize="10px"
            fontWeight="700"
          >
            Promo
          </Badge>
        )}
        {lowStock && (
          <Badge position="absolute" top={2} left={2} colorScheme="orange" variant="solid" borderRadius="full" px={2} fontSize="10px" fontWeight="600">
            Últimas
          </Badge>
        )}
        {outOfStock && (
          <Badge position="absolute" top={2} left={2} bg="gray.700" color="white" borderRadius="full" px={2} fontSize="10px" fontWeight="600">
            Sin stock
          </Badge>
        )}
      </Box>

      <VStack p={{ base: 3, sm: 5 }} align="stretch" spacing={{ base: 1, sm: 3 }} flex="1" minW={0}>
        <Box minW={0}>
          <Text fontSize="10px" color="brand.500" _dark={{ color: 'brand.300' }} textTransform="uppercase" letterSpacing="0.04em" fontWeight="600" mb={{ base: 0, sm: 1 }} noOfLines={1}>
            {product.brand || (type === 'service' ? 'Servicio' : 'Compushop')}
          </Text>
          <Text
            as={RouterLink}
            to={to}
            fontWeight="600"
            fontSize={{ base: 'sm', sm: 'md' }}
            noOfLines={2}
            minH={{ base: '2.4em', sm: '2.7em' }}
            lineHeight="1.3"
            title={product.name}
            _hover={{ color: 'brand.600', _dark: { color: 'brand.300' } }}
          >
            {product.name}
          </Text>
          {product.description && (
            <Text fontSize="sm" color={muted} noOfLines={2} mt={2} minH="2.6em" display={{ base: 'none', sm: '-webkit-box' }}>
              {product.description}
            </Text>
          )}
        </Box>

        <HStack justify="space-between" align="center" mt="auto" pt={{ base: 1, sm: 1 }} spacing={2}>
          <Text fontWeight="700" fontSize={{ base: 'md', sm: 'xl' }} letterSpacing="-0.02em" color="fg.default" noOfLines={1}>
            {formatPrice(product.price)}
          </Text>
          <HStack spacing={1} flexShrink={0}>
            <IconButton
              aria-label={type === 'service' ? 'Ver servicio' : 'Ver producto'}
              icon={<FiEye />}
              as={RouterLink}
              to={to}
              size="sm"
              variant="ghost"
              borderRadius="full"
              display={{ base: 'inline-flex', sm: 'none' }}
            />
            <IconButton
              aria-label={type === 'service' ? 'Contratar servicio' : 'Agregar al carrito'}
              icon={<FiShoppingCart />}
              size="sm"
              colorScheme="brand"
              variant="outline"
              borderRadius="full"
              onClick={handleAdd}
              isDisabled={outOfStock}
              display={{ base: 'inline-flex', sm: 'none' }}
            />
            <IconButton
              aria-label={type === 'service' ? 'Contratar ahora' : 'Comprar ahora'}
              icon={<FiShoppingBag />}
              size="sm"
              colorScheme="brand"
              variant="solid"
              borderRadius="full"
              onClick={handleBuy}
              isDisabled={outOfStock}
              display={{ base: 'inline-flex', sm: 'none' }}
            />
            <Button
              colorScheme="brand"
              borderRadius="full"
              size="sm"
              onClick={handleAdd}
              isDisabled={outOfStock}
              px={5}
              flexShrink={0}
              display={{ base: 'none', sm: 'inline-flex' }}
            >
              {type === 'service' ? 'Contratar' : outOfStock ? 'Sin stock' : 'Agregar'}
            </Button>
          </HStack>
        </HStack>
      </VStack>
    </Box>
  );
}
