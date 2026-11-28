import { Box, Container, Flex, HStack, VStack, Text, Link, Image, Grid, GridItem } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import logo from '../assets/logo-header.png';

export default function Footer() {
  const borderColor = { base: 'border.subtle', _dark: 'border.subtle' };
  const muted = { base: 'fg.muted', _dark: 'fg.muted' };
  const textColor = { base: 'fg.default', _dark: 'fg.default' };

  return (
    <Box as="footer" bg="bg.elevated" borderTop="1px solid" borderColor={borderColor} pt={{ base: 12, md: 16 }} pb={8}>
      <Container maxW="6xl">
        <Grid templateColumns={{ base: '1fr', md: '2fr 1fr 1fr 1fr' }} gap={{ base: 8, md: 12 }} mb={12}>
          <GridItem>
            <VStack align="flex-start" spacing={4}>
              <HStack spacing={3} as={RouterLink} to="/">
                <Image src={logo} alt="Compushop" h="32px" w="auto" borderRadius="4px" loading="lazy" decoding="async" htmlWidth="40" htmlHeight="32" />
                <Text
                  fontSize="xl"
                  fontWeight="700"
                  sx={{ backgroundImage: 'linear-gradient(135deg, var(--chakra-colors-brand-400), var(--chakra-colors-accent-400))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
                >
                  Compushop
                </Text>
              </HStack>
              <Text color={muted} maxW="280px" fontSize="sm" lineHeight="1.7">
                Venta de hardware, insumos y servicio técnico especializado para profesionales, gamers y empresas.
              </Text>
            </VStack>
          </GridItem>

          <GridItem>
            <VStack align="flex-start" spacing={4}>
              <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em" color={muted}>
                Navegación
              </Text>
              <VStack align="flex-start" spacing={2}>
                {[
                  { to: '/', label: 'Inicio' },
                  { to: '/productos', label: 'Productos' },
                  { to: '/servicios', label: 'Servicios' },
                  { to: '/contacto', label: 'Contacto' },
                ].map((link) => (
                  <Link key={link.to} as={RouterLink} to={link.to} color={textColor} fontSize="sm" _hover={{ color: 'brand.500' }}>
                    {link.label}
                  </Link>
                ))}
              </VStack>
            </VStack>
          </GridItem>

          <GridItem>
            <VStack align="flex-start" spacing={4}>
              <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em" color={muted}>
                Servicios
              </Text>
              <VStack align="flex-start" spacing={2}>
                {['Armado de PC', 'Reparación', 'Mantenimiento', 'Redes'].map((label) => (
                  <Link key={label} as={RouterLink} to="/servicios" color={textColor} fontSize="sm" _hover={{ color: 'brand.500' }}>
                    {label}
                  </Link>
                ))}
              </VStack>
            </VStack>
          </GridItem>

          <GridItem>
            <VStack align="flex-start" spacing={4}>
              <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="0.05em" color={muted}>
                Contacto
              </Text>
              <VStack align="flex-start" spacing={2}>
                <Link href="mailto:info@compushop.com" color={textColor} fontSize="sm" _hover={{ color: 'brand.500' }}>
                  info@compushop.com
                </Link>
                <Link href="tel:+543482468040" color={textColor} fontSize="sm" _hover={{ color: 'brand.500' }}>
                  +54 3482 468040
                </Link>
                <Text color={textColor} fontSize="sm" lineHeight="1.6">
                  Villa Ocampo, Santa Fe - Av. San Martín 1730
                </Text>
              </VStack>
            </VStack>
          </GridItem>
        </Grid>

        <Flex
          pt={6}
          borderTop="1px solid"
          borderColor={borderColor}
          justify="space-between"
          align="center"
          direction={{ base: 'column', md: 'row' }}
          gap={3}
        >
          <Text color={muted} fontSize="sm">
            © 2026 Compushop. Todos los derechos reservados.
          </Text>
          <Text color={muted} fontSize="sm">
            Desarrollado por odvsystem
          </Text>
        </Flex>
      </Container>
    </Box>
  );
}
