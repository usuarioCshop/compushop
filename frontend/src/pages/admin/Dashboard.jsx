import { useEffect, useState } from 'react';
import {
  SimpleGrid, Box, Stat, StatLabel, StatNumber, Heading, Text, Table, Thead, Tbody, Tr, Th, Td,
  Spinner, Center, Badge, HStack, Input, Button, useToast, FormControl, FormLabel,
} from '@chakra-ui/react';
import api from '../../api/client';

const formatPrice = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0);

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [settings, setSettings] = useState({});
  const [usdRate, setUsdRate] = useState('');
  const [iibbPercent, setIibbPercent] = useState('');
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const toast = useToast();
  const bg = 'bg.surface';

  useEffect(() => {
    api.get('/dashboard/stats').then(r => setData(r.data)).catch(console.error);
    api.get('/settings').then(r => {
      setSettings(r.data.settings || {});
      setUsdRate(r.data.settings?.usd_rate || '');
      setIibbPercent(r.data.settings?.iibb_percent || '');
    }).catch(console.error);
  }, []);

  const saveUsd = async () => {
    try {
      setSaving(true);
      const res = await api.put('/settings', { usd_rate: usdRate, iibb_percent: iibbPercent });
      setSettings(res.data.settings || {});
      toast({ title: 'Configuración actualizada', status: 'success' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error, status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const updatePrices = async () => {
    try {
      setUpdating(true);
      const res = await api.post('/products/update-prices');
      toast({ title: 'Precios actualizados', description: `${res.data.actualizados} productos`, status: 'success' });
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error, status: 'error' });
    } finally {
      setUpdating(false);
    }
  };

  if (!data) return <Center py={20}><Spinner size="xl" color="brand.500" thickness="3px" /></Center>;

  const cards = [
    { label: 'Productos', value: data.stats.productsCount },
    { label: 'Servicios', value: data.stats.servicesCount },
    { label: 'Clientes', value: data.stats.usersCount },
    { label: 'Pedidos', value: data.stats.ordersCount },
    { label: 'Pendientes', value: data.stats.pendingOrders },
    { label: 'Mensajes sin leer', value: data.stats.unreadMessages },
    { label: 'Ingresos', value: formatPrice(data.stats.revenue) },
  ];

  return (
    <Box>
      <Heading size="lg" mb={6} fontWeight="700" letterSpacing="-0.02em">Dashboard</Heading>
      <Box bg={bg} p={5} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" mb={8} maxW="520px">
        <Heading size="md" mb={3} fontWeight="700" letterSpacing="-0.01em">Cotización y márgenes</Heading>
        <HStack align="end" flexWrap="wrap">
          <FormControl maxW="200px">
            <FormLabel fontSize="sm">Valor 1 USD (ARS)</FormLabel>
            <Input value={usdRate} onChange={(e) => setUsdRate(e.target.value)} placeholder="Ej: 1200" />
          </FormControl>
          <FormControl maxW="200px">
            <FormLabel fontSize="sm">IIBB (%)</FormLabel>
            <Input value={iibbPercent} onChange={(e) => setIibbPercent(e.target.value)} placeholder="Ej: 3" />
          </FormControl>
          <Button colorScheme="brand" onClick={saveUsd} isLoading={saving}>Guardar</Button>
        </HStack>
        <HStack mt={4} spacing={3} flexWrap="wrap">
          <Button colorScheme="green" onClick={updatePrices} isLoading={updating}>Actualizar precios desde compra USD</Button>
        </HStack>
        <Text fontSize="xs" color="fg.muted" mt={2}>Fórmula: (Compra USD × Dólar × (1+IVA) × (1+IIBB) × (1+Gasto Variable)) + Flete + Ganancia</Text>
      </Box>
      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={4} mb={10}>
        {cards.map(c => (
          <Box key={c.label} bg={bg} p={5} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card">
            <Stat>
              <StatLabel color="fg.muted" fontSize="sm">{c.label}</StatLabel>
              <StatNumber fontSize="2xl" fontWeight="700" letterSpacing="-0.02em">{c.value}</StatNumber>
            </Stat>
          </Box>
        ))}
      </SimpleGrid>

      <Heading size="md" mb={4} fontWeight="700" letterSpacing="-0.01em">Pedidos recientes</Heading>
      <Box bg={bg} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" overflow="hidden" mb={10}>
        <Table size="sm">
          <Thead>
            <Tr><Th>Nº</Th><Th>Cliente</Th><Th>Total</Th><Th>Estado</Th><Th>Fecha</Th></Tr>
          </Thead>
          <Tbody>
            {(data.recentOrders || []).map(o => (
              <Tr key={o.id}>
                <Td fontWeight="500">{o.order_number}</Td>
                <Td>{o.customer_name}</Td>
                <Td fontWeight="600">{formatPrice(o.total)}</Td>
                <Td><Badge variant="subtle" borderRadius="full">{o.status}</Badge></Td>
                <Td color="fg.muted">{new Date(o.created_at).toLocaleDateString('es-AR')}</Td>
              </Tr>
            ))}
            {(!data.recentOrders || data.recentOrders.length === 0) && (
              <Tr><Td colSpan={5}><Text color="fg.muted" textAlign="center" py={6}>Sin pedidos aún</Text></Td></Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      {data.lowStock?.length > 0 && (
        <>
          <Heading size="md" mb={4} fontWeight="700" letterSpacing="-0.01em">Stock bajo</Heading>
          <Box bg={bg} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" overflow="hidden">
            <Table size="sm">
              <Thead><Tr><Th>Producto</Th><Th>Stock</Th><Th>Precio</Th></Tr></Thead>
              <Tbody>
                {data.lowStock.map(p => (
                  <Tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td><Badge colorScheme={p.stock === 0 ? 'red' : 'orange'} borderRadius="full">{p.stock}</Badge></Td>
                    <Td fontWeight="600">{formatPrice(p.price)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </Box>
        </>
      )}
    </Box>
  );
}
