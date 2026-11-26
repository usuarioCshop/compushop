import { NavLink, useNavigate } from 'react-router-dom';
import {
  Box, Button, Drawer, DrawerBody, DrawerCloseButton, DrawerContent, DrawerHeader, DrawerOverlay,
  Flex, HStack, Heading, Icon, IconButton, VStack, useDisclosure,
} from '@chakra-ui/react';
import {
  FiHome, FiPackage, FiTool, FiShoppingBag, FiUsers, FiMail, FiSettings, FiArrowLeft, FiDollarSign, FiFileText, FiBriefcase, FiMenu,
} from 'react-icons/fi';

const links = [
  { to: '/admin', label: 'Dashboard', icon: FiHome, end: true },
  { to: '/admin/productos', label: 'Productos', icon: FiPackage },
  { to: '/admin/servicios', label: 'Servicios', icon: FiTool },
  { to: '/admin/pedidos', label: 'Pedidos', icon: FiShoppingBag },
  { to: '/admin/caja', label: 'Caja', icon: FiDollarSign },
  { to: '/facturacion', label: 'Facturación', icon: FiFileText },
  { to: '/tecnico', label: 'Servicio Técnico', icon: FiBriefcase },
  { to: '/admin/usuarios', label: 'Usuarios', icon: FiUsers },
  { to: '/admin/mensajes', label: 'Mensajes', icon: FiMail },
  { to: '/admin/configuracion', label: 'Configuración', icon: FiSettings },
];

export default function AdminHorizontalNav() {
  const bg = 'bg.surface';
  const border = 'border.subtle';
  const navigate = useNavigate();
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box bg={bg} borderBottom="1px" borderColor={border} px={{ base: 4, md: 6 }} py={3}>
      <Flex align="center" justify="space-between" gap={3}>
        <HStack spacing={2}>
          <IconButton
            display={{ base: 'inline-flex', lg: 'none' }}
            aria-label="Abrir menú admin"
            icon={<FiMenu />}
            variant="outline"
            size="sm"
            onClick={onOpen}
          />
          <Heading size="sm" color="brand.600" letterSpacing="-0.01em">Admin</Heading>
        </HStack>

        <HStack spacing={2} flexWrap="wrap" display={{ base: 'none', lg: 'flex' }} flex={1} ml={2}>
          {links.map(l => (
            <Button
              key={l.to}
              as={NavLink}
              to={l.to}
              end={l.end}
              variant="ghost"
              leftIcon={<Icon as={l.icon} />}
              size="sm"
              _activeLink={{ bg: 'brand.50', color: 'brand.700', fontWeight: '600', _dark: { bg: 'whiteAlpha.100', color: 'brand.300' } }}
            >
              {l.label}
            </Button>
          ))}
        </HStack>

        <Button size="sm" variant="outline" leftIcon={<FiArrowLeft />} onClick={() => navigate('/')} display={{ base: 'none', sm: 'inline-flex' }}>
          Volver a la tienda
        </Button>
      </Flex>

      <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
        <DrawerOverlay />
        <DrawerContent>
          <DrawerCloseButton />
          <DrawerHeader borderBottomWidth="1px">Admin</DrawerHeader>
          <DrawerBody py={4}>
            <VStack align="stretch" spacing={1}>
              {links.map(l => (
                <Button
                  key={l.to}
                  as={NavLink}
                  to={l.to}
                  end={l.end}
                  variant="ghost"
                  justifyContent="flex-start"
                  leftIcon={<Icon as={l.icon} />}
                  onClick={onClose}
                  _activeLink={{ bg: 'brand.50', color: 'brand.700', fontWeight: '600', _dark: { bg: 'whiteAlpha.100', color: 'brand.300' } }}
                >
                  {l.label}
                </Button>
              ))}
              <Button
                mt={2}
                variant="outline"
                justifyContent="flex-start"
                leftIcon={<FiArrowLeft />}
                onClick={() => { onClose(); navigate('/'); }}
              >
                Volver a la tienda
              </Button>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </Box>
  );
}
