import { useState } from 'react';
import {
  Box, Container, Heading, VStack, HStack, Text, Button, Image, IconButton,
  Divider, Input, FormControl, FormLabel, useToast, NumberInput, NumberInputField,
  NumberInputStepper, NumberIncrementStepper, NumberDecrementStepper, Select, Checkbox,
} from '@chakra-ui/react';
import { FiTrash2, FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import { resolveUploadUrl } from '../api/uploads';
import EmptyState from '../components/EmptyState';

const formatPrice = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function Cart() {
  const { items, removeItem, updateQuantity, clearCart, totalPrice } = useCart();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const bg = 'bg.surface';
  const [loading, setLoading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [form, setForm] = useState({
    customer_name: user?.name || '',
    customer_email: user?.email || '',
    customer_phone: user?.phone || '',
    shipping_address: user?.address || '',
    notes: '',
    payment_method: 'efectivo',
    payment_receipt_url: '',
    payment_receipt_pending: false,
  });

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const okType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(file.type);
    if (!okType) {
      toast({ title: 'Formato no permitido', description: 'Subí una imagen (jpg, png, webp, gif) o PDF', status: 'warning' });
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Máximo 5 MB', status: 'warning' });
      e.target.value = '';
      return;
    }
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      const { data } = await api.post('/upload/receipt', fd, { headers: { 'Content-Type': undefined } });
      setForm((f) => ({ ...f, payment_receipt_url: data.url, payment_receipt_pending: false }));
      setReceiptFileName(file.name);
      toast({ title: 'Comprobante cargado', status: 'success' });
    } catch (err) {
      toast({ title: 'No se pudo subir', description: err.response?.data?.error || err.message, status: 'error' });
      e.target.value = '';
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleConfirm = async () => {
    if (!form.customer_name || !form.customer_email) {
      toast({ title: 'Completá nombre y email', status: 'warning' });
      return;
    }
    if (form.payment_method === 'transferencia' && !form.payment_receipt_url && !form.payment_receipt_pending) {
      toast({ title: 'Comprobante requerido', description: 'Subí el comprobante o marcá que no se pudo subir', status: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/orders', {
        items: items.map(i => ({ id: i.id, name: i.name, price: i.price, quantity: i.quantity, type: i.type })),
        customer_name: form.customer_name,
        customer_email: form.customer_email,
        customer_phone: form.customer_phone,
        shipping_address: form.shipping_address,
        notes: form.notes,
        payment_method: form.payment_method,
        payment_receipt_url: form.payment_method === 'transferencia' ? (form.payment_receipt_url || null) : null,
        payment_receipt_pending: form.payment_method === 'transferencia' ? !!form.payment_receipt_pending : false,
      });
      clearCart();
      toast({ title: '¡Pedido confirmado!', description: `Nº ${data.order.order_number}`, status: 'success', duration: 5000 });
      navigate('/');
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || 'No se pudo confirmar', status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <Container maxW="3xl" py={16}>
        <EmptyState
          icon={FiShoppingCart}
          title="Tu carrito está vacío"
          description="Todavía no agregaste productos. Explorá el catálogo y armá tu pedido."
          actionLabel="Ver productos"
          onAction={() => navigate('/productos')}
        />
      </Container>
    );
  }

  return (
    <Container maxW="5xl" py={10}>
      <VStack spacing={1} align="start" mb={8}>
        <Heading fontWeight="700" letterSpacing="-0.02em">Carrito de compras</Heading>
        <Text color="fg.muted" fontSize="sm">
          {items.length} {items.length === 1 ? 'artículo' : 'artículos'} en tu pedido
        </Text>
      </VStack>
      <HStack align="start" spacing={8} flexDir={{ base: 'column', lg: 'row' }}>
        <VStack flex="1" spacing={4} w="100%">
          {items.map(item => (
            <Box key={`${item.type}-${item.id}`} bg={bg} p={4} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" w="100%">
              <HStack spacing={4} align="start">
                <Image src={resolveUploadUrl(item.image)} alt={item.name} boxSize="80px" objectFit="cover" borderRadius="md" fallbackSrc="https://via.placeholder.com/80" />
                <VStack align="start" flex="1" spacing={1}>
                  <Text fontWeight="600">{item.name}</Text>
                  <Text fontSize="sm" color="fg.muted">{item.type === 'service' ? 'Servicio' : 'Producto'}</Text>
                  <Text color="brand.600" fontWeight="700" className="price">{formatPrice(item.price)}</Text>
                </VStack>
                <NumberInput size="sm" maxW="100px" value={item.quantity} min={1}
                  onChange={(_, v) => updateQuantity(item.id, item.type, v)}>
                  <NumberInputField />
                  <NumberInputStepper>
                    <NumberIncrementStepper />
                    <NumberDecrementStepper />
                  </NumberInputStepper>
                </NumberInput>
                <IconButton icon={<FiTrash2 />} variant="ghost" colorScheme="red" aria-label={`Quitar ${item.name}`}
                  onClick={() => removeItem(item.id, item.type)} />
              </HStack>
            </Box>
          ))}
        </VStack>

        <Box bg={bg} p={6} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" w={{ base: '100%', lg: '360px' }} position="sticky" top="80px">
          <Heading size="md" mb={4} fontWeight="700" letterSpacing="-0.01em">Resumen</Heading>
          <HStack justify="space-between" mb={2}>
            <Text color="fg.muted">Subtotal</Text>
            <Text fontWeight="700" color="brand.600" className="price">{formatPrice(totalPrice)}</Text>
          </HStack>
          <Divider my={4} />
          <VStack spacing={3} mb={6}>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Nombre</FormLabel>
              <Input size="sm" value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Email</FormLabel>
              <Input size="sm" type="email" value={form.customer_email} onChange={e => setForm({ ...form, customer_email: e.target.value })} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Teléfono</FormLabel>
              <Input size="sm" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })} />
            </FormControl>
            <FormControl>
              <FormLabel fontSize="sm">Dirección de envío</FormLabel>
              <Input size="sm" value={form.shipping_address} onChange={e => setForm({ ...form, shipping_address: e.target.value })} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel fontSize="sm">Forma de pago</FormLabel>
              <Select
                size="sm"
                value={form.payment_method}
                onChange={e => setForm((f) => ({
                  ...f,
                  payment_method: e.target.value,
                  payment_receipt_url: '',
                  payment_receipt_pending: false,
                }))}
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </Select>
            </FormControl>
            {form.payment_method === 'transferencia' && (
              <Box w="100%" p={3} borderWidth="1px" borderColor="border.subtle" borderRadius="md" bg="bg.subtle">
                <Text fontSize="sm" fontWeight="600" mb={2}>ALIAS DEL CBU compushopvo.mp</Text>
                <FormControl mb={2}>
                  <FormLabel fontSize="sm">Comprobante (imagen o PDF)</FormLabel>
                  <Input
                    size="sm"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                    onChange={handleReceiptUpload}
                    isDisabled={form.payment_receipt_pending || uploadingReceipt}
                    p={1}
                  />
                  {uploadingReceipt && <Text fontSize="xs" color="fg.muted" mt={1}>Subiendo comprobante...</Text>}
                  {form.payment_receipt_url && !uploadingReceipt && (
                    <Text fontSize="xs" color="green.500" mt={1}>Comprobante cargado: {receiptFileName || 'archivo'}</Text>
                  )}
                </FormControl>
                <Checkbox
                  size="sm"
                  isChecked={form.payment_receipt_pending}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    payment_receipt_pending: e.target.checked,
                    payment_receipt_url: e.target.checked ? '' : f.payment_receipt_url,
                  }))}
                >
                  No se pudo subir el comprobante
                </Checkbox>
              </Box>
            )}
            <FormControl>
              <FormLabel fontSize="sm">Notas</FormLabel>
              <Input size="sm" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </FormControl>
          </VStack>
          <Button colorScheme="accent" size="lg" w="100%" borderRadius="full" isLoading={loading} onClick={handleConfirm}>
            Confirmar pedido
          </Button>
        </Box>
      </HStack>
    </Container>
  );
}
