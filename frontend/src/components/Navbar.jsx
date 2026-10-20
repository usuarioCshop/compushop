import {
  Box, Flex, HStack, IconButton, Button, useColorMode, useColorModeValue,
  Container, Image, Badge, Menu, MenuButton, MenuList, MenuItem,
  useDisclosure, Drawer, DrawerBody, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton, VStack,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { FiShoppingCart, FiSun, FiMoon, FiMenu, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import portada from '../assets/portada.jpg';

export default function Navbar() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user, logout, isAdmin } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const isHome = location.pathname === '/';
  // En home la navbar flota sobre el hero (estilo plantilla)
  const barBg = useColorModeValue('whiteAlpha.900', 'blackAlpha.700');
  const barBgSolid = 'bg.surface';
  const muted = 'fg.muted';

  const links = [
    { to: '/', label: 'Inicio' },
    { to: '/productos', label: 'Productos' },
    { to: '/servicios', label: 'Servicios' },
    { to: '/contacto', label: 'Contacto' },
  ];

  return (
    <Box
      as="nav"
      position="sticky"
      top={0}
      zIndex={100}
      pt={{ base: 3, md: 4 }}
      pb={{ base: 2, md: 3 }}
      px={{ base: 3, md: 6 }}
      bg="transparent"
      pointerEvents="none"
    >
      <Container maxW="6xl" pointerEvents="auto">
        {/* Barra tipo "pill" flotante (como la plantilla Mobirise) */}
        <Flex
          h={{ base: 14, md: 16 }}
          align="center"
          justify="space-between"
          px={{ base: 3, md: 5 }}
          bg={isHome ? barBg : barBgSolid}
          backdropFilter="blur(12px)"
          borderRadius="full"
          border="1px solid"
          borderColor={useColorModeValue('blackAlpha.100', 'whiteAlpha.200')}
          shadow="lg"
        >
          <HStack spacing={3}>
            <IconButton
              display={{ base: 'flex', md: 'none' }}
              icon={<FiMenu />}
              variant="ghost"
              borderRadius="full"
              onClick={onOpen}
              aria-label="Menú"
            />
            {/* Logo */}
            <Box
              as={RouterLink}
              to="/"
              display="flex"
              alignItems="center"
              _hover={{ opacity: 0.9 }}
            >
              <Image
                src={portada}
                alt="Compushop"
                h={{ base: 8, md: 9 }}
                w="auto"
                objectFit="contain"
                borderRadius="md"
                flexShrink={0}
              />
            </Box>
          </HStack>

          <HStack spacing={1} display={{ base: 'none', md: 'flex' }}>
            {links.map((l) => {
              const active = location.pathname === l.to;
              return (
                <Button
                  key={l.to}
                  as={RouterLink}
                  to={l.to}
                  variant="ghost"
                  size="sm"
                  borderRadius="full"
                  fontWeight={active ? '700' : '500'}
                  color={active ? 'brand.600' : muted}
                  _hover={{ color: 'brand.500', bg: useColorModeValue('blackAlpha.50', 'whiteAlpha.100') }}
                >
                  {l.label}
                </Button>
              );
            })}
          </HStack>

          <HStack spacing={2}>
            <IconButton
              icon={colorMode === 'light' ? <FiMoon /> : <FiSun />}
              onClick={toggleColorMode}
              variant="ghost"
              borderRadius="full"
              size="sm"
              aria-label="Cambiar tema"
            />
            <Box position="relative">
              <IconButton
                as={RouterLink}
                to="/carrito"
                icon={<FiShoppingCart />}
                variant="ghost"
                borderRadius="full"
                size="sm"
                aria-label="Carrito"
              />
              {totalItems > 0 && (
                <Badge
                  position="absolute"
                  top="-1"
                  right="-1"
                  colorScheme="accent"
                  borderRadius="full"
                  fontSize="xs"
                  minW="18px"
                  textAlign="center"
                >
                  {totalItems}
                </Badge>
              )}
            </Box>

            {user ? (
              <Menu>
                <MenuButton
                  as={Button}
                  variant="ghost"
                  size="sm"
                  borderRadius="full"
                  rightIcon={<FiUser />}
                >
                  {user.name.split(' ')[0]}
                </MenuButton>
                <MenuList borderRadius="xl">
                  {isAdmin && (
                    <MenuItem icon={<FiSettings />} onClick={() => navigate('/admin')}>
                      Dashboard
                    </MenuItem>
                  )}
                  <MenuItem icon={<FiLogOut />} onClick={() => { logout(); navigate('/'); }}>
                    Cerrar sesión
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : (
              <HStack spacing={2} display={{ base: 'none', sm: 'flex' }}>
                <Button
                  as={RouterLink}
                  to="/login"
                  variant="ghost"
                  size="sm"
                  borderRadius="full"
                >
                  Ingresar
                </Button>
                <Button
                  as={RouterLink}
                  to="/contacto"
                  colorScheme="brand"
                  size="sm"
                  borderRadius="full"
                  px={5}
                >
                  Contáctanos
                </Button>
              </HStack>
            )}
          </HStack>
        </Flex>
      </Container>

      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent borderRightRadius="2xl">
          <DrawerCloseButton />
          <DrawerHeader>Menú</DrawerHeader>
          <DrawerBody>
            <VStack align="stretch" spacing={3}>
              {links.map((l) => (
                <Button
                  key={l.to}
                  as={RouterLink}
                  to={l.to}
                  variant="ghost"
                  justifyContent="flex-start"
                  borderRadius="full"
                  onClick={onClose}
                >
                  {l.label}
                </Button>
              ))}
              {!user && (
                <>
                  <Button as={RouterLink} to="/login" variant="outline" borderRadius="full" onClick={onClose}>
                    Ingresar
                  </Button>
                  <Button as={RouterLink} to="/registro" colorScheme="brand" borderRadius="full" onClick={onClose}>
                    Registrarse
                  </Button>
                </>
              )}
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}
