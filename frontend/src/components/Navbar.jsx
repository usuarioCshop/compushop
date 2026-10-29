import {
  Box, Flex, HStack, IconButton, Button, useColorMode,
  Container, Image, Badge, Menu, MenuButton, MenuList, MenuItem,
  useDisclosure, Drawer, DrawerBody, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton, VStack, Text,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { FiShoppingCart, FiSun, FiMoon, FiMenu, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import logo from '../assets/logo-header.png';

export default function Navbar() {
  const { colorMode, toggleColorMode } = useColorMode();
  const { user, logout, isAdmin } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const barBg = { base: 'rgba(255,255,255,0.85)', _dark: 'rgba(12,18,32,0.85)' };
  const borderColor = { base: 'border.subtle', _dark: 'border.subtle' };
  const muted = { base: 'fg.muted', _dark: 'fg.muted' };
  const textColor = { base: 'fg.default', _dark: 'fg.default' };

  const links = [
    { to: '/', label: 'Inicio' },
    { to: '/productos', label: 'Productos' },
    { to: '/servicios', label: 'Servicios' },
    { to: '/contacto', label: 'Contacto' },
  ];

  return (
    <Box
      as="nav"
      position="fixed"
      top={0}
      left={0}
      right={0}
      zIndex={1000}
      bg={barBg}
      sx={{ backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
      borderBottom="1px solid"
      borderColor={borderColor}
    >
      <Container maxW="7xl" h="72px" display="flex" alignItems="center">
        <Flex w="100%" align="center" justify="space-between">
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
              gap={3}
              sx={{ transition: 'opacity 200ms', _hover: { opacity: 0.9 } }}
            >
              <Image
                src={logo}
                alt="Compushop"
                h="32px"
                w="auto"
                borderRadius="4px"
                flexShrink={0}
              />
              <Text
                display={{ base: 'none', sm: 'block' }}
                fontSize="xl"
                fontWeight="700"
                letterSpacing="-0.02em"
                sx={{ backgroundImage: 'linear-gradient(135deg, var(--chakra-colors-brand-400), var(--chakra-colors-accent-400))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
              >
                Compushop
              </Text>
            </Box>
          </HStack>

          <HStack spacing={1} display={{ base: 'none', md: 'flex' }} bg={{ base: 'blackAlpha.50', _dark: 'whiteAlpha.50' }} borderRadius="full" px={2} py={1}>
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
                  fontWeight={active ? '600' : '500'}
                  color={active ? textColor : muted}
                  bg={active ? { base: 'white', _dark: 'whiteAlpha.100' } : 'transparent'}
                  _hover={{ bg: active ? { base: 'white', _dark: 'whiteAlpha.100' } : { base: 'blackAlpha.100', _dark: 'whiteAlpha.50' } }}
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
                  colorScheme="brand"
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
                  to="/registro"
                  colorScheme="brand"
                  size="sm"
                  borderRadius="full"
                  px={5}
                >
                  Registrarse
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
                  <Button as={RouterLink} to="/login" variant="ghost" borderRadius="full" onClick={onClose}>
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
