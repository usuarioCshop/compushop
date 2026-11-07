import {
  Box, Image, Text, Badge, Button, VStack, HStack, useToast, IconButton,
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
  const borderColor = 'border.subtle';

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

  const to = type === 'product'
    ? `/producto/${product.id}`
    : `/servicio/${product.id}`;

  return (
    <Box
      bg={bg}
      borderRadius="lg"
      overflow="hidden"
      borderWidth="1px"
      borderColor="rgba(37,99,235,0.68)"
      h="100%"
      display="flex"
      flexDirection="column"
      position="relative"
      transition="all 220ms ease"
      sx={{
        boxShadow: '0 0 0 1px rgba(37,99,235,0.27), 0 14px 40px -10px rgba(37,99,235,0.75)',
        _hover: {
          boxShadow: '0 0 0 2px rgba(37,99,235,0.82), 0 22px 56px -12px rgba(37,99,235,0.95)',
          transform: 'translateY(-4px)',
          borderColor: 'rgba(37,99,235,1)',
        },
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
            top={2}
            right={2}
            borderRadius="full"
            colorScheme={fav ? 'red' : 'gray'}
            variant={fav ? 'solid' : 'ghost'}
            color={fav ? undefined : { base: 'gray.500', _dark: 'brand.400' }}
            sx={!fav ? { _dark: { svg: { color: 'brand.400', stroke: 'currentColor' } } } : undefined}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!user) {
                toast({ title: 'Iniciá sesión para agregar a favoritos', status: 'info', duration: 2000, isClosable: true });
                return;
              }
              if (fav) {
                toggle(product.id);
              } else {
                toggle(product.id);
              }
              toast({
                title: fav ? 'Eliminado de favoritos' : 'Agregado a favoritos',
                status: 'success',
                duration: 1500,
                isClosable: true,
                position: 'top-right',
              });
            }}
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
          transition="transform 0.3s"
          _hover={{ transform: 'scale(1.03)' }}
          fallbackSrc="https://via.placeholder.com/400x400?text=Compushop"
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
            _dark={{ bg: 'accent.700', color: 'white' }}
          >
            PROMOCIÓN
          </Badge>
        )}
        {type === 'product' && !product.is_promo && product.stock <= 5 && product.stock > 0 && (
          <Badge position="absolute" top={3} left={3} colorScheme="red" variant="solid" borderRadius="full" px={3} fontSize="xs" fontWeight="700">
            Últimas unidades
          </Badge>
        )}
        {type === 'product' && !product.is_promo && product.stock === 0 && (
          <Badge position="absolute" top={3} left={3} bg="gray.600" color="white" borderRadius="full" px={3} fontSize="xs" fontWeight="600">
            Sin stock
          </Badge>
        )}
      </Box>

      <VStack px={5} pt={5} pb="56px" align="stretch" spacing={2} flex="1">
        <Text fontSize="xs" color="brand.400" textTransform="uppercase" letterSpacing="0.04em" fontWeight="600">
          {product.brand || 'Sin Marca'}
        </Text>
        <Text
          as={RouterLink}
          to={to}
          fontWeight="600"
          fontSize="md"
          noOfLines={1}
          minH="unset"
          lineHeight="1.35"
          title={product.name}
          _hover={{ color: 'brand.400' }}
        >
          {product.name}
        </Text>
        {product.description && (
          <Text fontSize="sm" color={muted} noOfLines={2} minH="40px">
            {product.description}
          </Text>
        )}
      </VStack>
      <HStack
        justify="space-between"
        align="center"
        position="absolute"
        left={5}
        right={5}
        bottom="2%"
      >
        <Text fontWeight="700" fontSize="xl" letterSpacing="-0.02em">
          {formatPrice(product.price)}
        </Text>
        <Button
          colorScheme="brand"
          borderRadius="full"
          size="sm"
          onClick={handleAdd}
          isDisabled={type === 'product' && product.stock === 0}
          px={5}
        >
          {type === 'service' ? 'Contratar' : 'Comprar'}
        </Button>
      </HStack>
    </Box>
  );
}
