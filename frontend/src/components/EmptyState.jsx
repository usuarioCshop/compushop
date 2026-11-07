import { VStack, Icon, Heading, Text, Button } from '@chakra-ui/react';
import { FiInbox } from 'react-icons/fi';

// Estado vacio reutilizable: icono grande, titulo, descripcion y CTA opcional.
// Usar en listados sin resultados (catalogo, admins, pedidos, etc.).
export default function EmptyState({
  icon: IconComponent = FiInbox,
  title = 'Nada por acá todavía',
  description,
  actionLabel,
  onAction,
}) {
  return (
    <VStack spacing={4} py={12} px={4} textAlign="center">
      <Icon as={IconComponent} boxSize={12} color="fg.muted" />
      <Heading size="md" color="fg.default" fontFamily="heading">{title}</Heading>
      {description && (
        <Text fontSize="sm" color="fg.muted" maxW="md">
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button colorScheme="brand" onClick={onAction}>{actionLabel}</Button>
      )}
    </VStack>
  );
}
