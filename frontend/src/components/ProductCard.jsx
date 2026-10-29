import {
  Box, Image, Text, Badge, Button, VStack, HStack, useToast,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const formatPrice = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function ProductCard({ product, type = 'product' }) {
  const { addItem } = useCart();
  const toast = useToast();
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
      borderRadius="2xl"
      overflow="hidden"
      sx={{
        transition: 'all 250ms',
        boxShadow: '0 0 0 2px rgba(59,130,246,0.18), 0 10px 40px -10px rgba(59,130,246,0.45)',
        _hover: {
          boxShadow: '0 0 0 2px rgba(96,165,250,0.8), 0 20px 60px -15px rgba(59,130,246,0.7)',
          transform: 'translateY(-6px)',
          borderColor: 'rgba(96,165,250,0.9)',
        },
      }}
      h="100%"
      display="flex"
      flexDirection="column"
      border="2px solid"
      borderColor="rgba(59,130,246,0.35)"
    >
      <Box
        as={RouterLink}
        to={to}
        position="relative"
        sx={{ aspectRatio: 1 }}
        bg="bg.subtle"
        overflow="hidden"
      >
        <Image
          src={product.image || 'https://via.placeholder.com/400x400?text=Compushop'}
          alt={product.name}
          sx={{
            objectFit: 'contain',
            transition: 'transform 0.3s',
            '&:hover': { transform: 'scale(1.05)' },
          }}
          w="70%"
          h="70%"
          margin="auto"
          opacity={0.9}
          fallbackSrc="https://via.placeholder.com/400x400?text=Compushop"
        />
        {type === 'product' && product.is_promo && (
          <Badge position="absolute" top={3} left={3} colorScheme="purple" borderRadius="full" px={3} fontWeight="600" fontSize="xs">
            PROMOCIÓN
          </Badge>
        )}
        {type === 'product' && !product.is_promo && product.stock <= 5 && product.stock > 0 && (
          <Badge position="absolute" top={3} left={3} colorScheme="red" borderRadius="full" px={3} fontSize="xs" fontWeight="600">
            Últimas unidades
          </Badge>
        )}
        {type === 'product' && !product.is_promo && product.stock === 0 && (
          <Badge position="absolute" top={3} left={3} bg="gray.600" color="white" borderRadius="full" px={3} fontSize="xs" fontWeight="600">
            Sin stock
          </Badge>
        )}
      </Box>

      <VStack p={5} align="stretch" spacing={2} flex="1">
        {product.brand && (
          <Text fontSize="xs" color="brand.400" textTransform="uppercase" letterSpacing="0.04em" fontWeight="600">
            {product.brand}
          </Text>
        )}
        <Text
          as={RouterLink}
          to={to}
          fontWeight="600"
          fontSize="md"
          noOfLines={2}
          minH="48px"
          lineHeight="1.35"
          _hover={{ color: 'brand.400' }}
        >
          {product.name}
        </Text>
        {product.description && (
          <Text fontSize="sm" color={muted} noOfLines={2} minH="40px">
            {product.description}
          </Text>
        )}
        <HStack justify="space-between" align="center" mt="auto" pt={2}>
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
      </VStack>
    </Box>
  );
}
