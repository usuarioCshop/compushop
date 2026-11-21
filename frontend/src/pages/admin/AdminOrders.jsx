import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Heading, Table, Thead, Tbody, Tr, Th, Td, Select, Badge, Spinner, Center, useToast, Text,
  IconButton, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  VStack, HStack, Divider, useDisclosure, Checkbox, Link, Image, Textarea, FormControl, FormLabel,
} from '@chakra-ui/react';
import { FiEye, FiFileText, FiXCircle } from 'react-icons/fi';
import api from '../../api/client';
import { resolveUploadUrl } from '../../api/uploads';

const formatPrice = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const ORDER_STATUS_OPTIONS = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'preparando', label: 'Preparando' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'cobrado', label: 'Cobrado' },
  { value: 'facturado', label: 'Facturado' },
  { value: 'cancelado', label: 'Cancelado' },
];
const ORDER_STATUS_LABEL = Object.fromEntries(ORDER_STATUS_OPTIONS.map((s) => [s.value, s.label]));
const prepKey = (orderId) => `compushop_order_prep_${orderId}`;

function loadPrep(orderId) {
  try {
    return JSON.parse(localStorage.getItem(prepKey(orderId)) || '{}');
  } catch {
    return {};
  }
}

function savePrep(orderId, prep) {
  localStorage.setItem(prepKey(orderId), JSON.stringify(prep));
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [prep, setPrep] = useState({});
  const [voidOrder, setVoidOrder] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [voiding, setVoiding] = useState(false);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const voidDisc = useDisclosure();
  const toast = useToast();
  const bg = 'bg.surface';
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get('/orders?limit=50').then(r => setOrders(r.data.orders || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      if (status === 'enviado') {
        localStorage.removeItem(prepKey(id));
        if (selectedOrder?.id === id) setPrep({});
      }
      toast({ title: 'Estado actualizado', status: 'success' });
      load();
      window.dispatchEvent(new Event('orders:pending-changed'));
      window.setTimeout(() => window.dispatchEvent(new Event('orders:pending-changed')), 300);
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error, status: 'error' });
    }
  };

  const openVoidModal = (order) => {
    setVoidOrder(order);
    setVoidReason('');
    voidDisc.onOpen();
  };

  const confirmVoidLinkedInvoice = async () => {
    if (!voidOrder) return;
    setVoiding(true);
    try {
      const { data } = await api.post(`/orders/${voidOrder.id}/void-invoice`, { reason: voidReason });
      const msg = data.cashAction === 'compensated'
        ? 'Factura anulada. Se generó egreso compensatorio en caja de hoy.'
        : data.cashAction === 'voided_original'
          ? 'Factura anulada. Se corrigió el movimiento de caja original.'
          : 'Factura anulada y pedido cancelado.';
      toast({ title: msg, status: 'success', duration: 5000 });
      voidDisc.onClose();
      setVoidOrder(null);
      setVoidReason('');
      load();
      window.dispatchEvent(new Event('orders:pending-changed'));
    } catch (err) {
      toast({ title: 'No se pudo anular la factura', description: err.response?.data?.error || err.message, status: 'error', duration: 6000 });
    } finally {
      setVoiding(false);
    }
  };

  const openDetail = async (id) => {
    setSelectedOrder(null);
    setPrep(loadPrep(id));
    setDetailLoading(true);
    onOpen();
    try {
      const { data } = await api.get(`/orders/${id}`);
      setSelectedOrder(data.order || data);
    } catch (err) {
      toast({ title: 'Error al cargar detalle', description: err.response?.data?.error || err.message, status: 'error' });
      onClose();
    } finally {
      setDetailLoading(false);
    }
  };

  const statusFilter = useMemo(() => {
    const raw = searchParams.get('status');
    if (!raw) return null;
    const set = new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
    return set.size ? set : null;
  }, [searchParams]);

  const visibleOrders = useMemo(() => {
    if (!statusFilter) return orders;
    return orders.filter((o) => statusFilter.has(o.status));
  }, [orders, statusFilter]);

  if (loading) return <Center py={10}><Spinner color="brand.500" /></Center>;

  return (
    <Box>
      <HStack justify="space-between" mb={6} flexWrap="wrap" gap={2}>
        <Heading size="lg" fontWeight="700" letterSpacing="-0.02em">Pedidos</Heading>
        {statusFilter && <Text fontSize="sm" color="fg.muted">Filtro: {Array.from(statusFilter).join(', ')} ({visibleOrders.length})</Text>}
      </HStack>
      <Box bg={bg} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" overflowX="auto">
        <Table size="sm">
          <Thead><Tr><Th>Nº</Th><Th>Cliente</Th><Th>Total</Th><Th>Estado</Th><Th>Fecha</Th><Th></Th></Tr></Thead>
          <Tbody>
            {visibleOrders.map(o => (
              <Tr key={o.id}>
                <Td fontFamily="mono" fontWeight="500">{o.order_number}</Td>
                <Td>
                  <Text>{o.customer_name}</Text>
                  <Text fontSize="xs" color="fg.muted">{o.customer_email}</Text>
                </Td>
                <Td fontWeight="600">{formatPrice(o.total)}</Td>
                <Td>
                  <Select
                    size="sm"
                    value={o.status}
                    onChange={e => changeStatus(o.id, e.target.value)}
                    maxW="160px"
                    bg="bg.surface"
                    isDisabled={o.status === 'facturado'}
                  >
                    {ORDER_STATUS_OPTIONS.filter((s) => s.value !== 'facturado' || o.status === 'facturado').map(s => (
                      <option key={s.value} value={s.value} disabled={s.value === 'facturado' && o.status !== 'facturado'}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Td>
                <Td color="fg.muted">{new Date(o.created_at).toLocaleString('es-AR')}</Td>
                <Td>
                  <HStack spacing={1}>
                    <IconButton aria-label="Ver detalle" icon={<FiEye />} size="sm" variant="ghost" onClick={() => openDetail(o.id)} />
                    {o.status === 'cobrado' && (
                      <IconButton
                        aria-label="Facturar pedido"
                        icon={<FiFileText />}
                        size="sm"
                        variant="ghost"
                        colorScheme="green"
                        onClick={() => navigate(`/facturacion?order_id=${o.id}`)}
                        title="Facturar pedido (sin afectar caja/stock)"
                      />
                    )}
                    {o.status === 'facturado' && (
                      <IconButton
                        aria-label="Anular factura del pedido"
                        icon={<FiXCircle />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => openVoidModal(o)}
                        title="Anular factura vinculada y cancelar pedido"
                      />
                    )}
                  </HStack>
                </Td>
              </Tr>
            ))}
            {visibleOrders.length === 0 && <Tr><Td colSpan={6}><Text textAlign="center" color="fg.muted" py={6}>Sin pedidos</Text></Td></Tr>}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {selectedOrder ? `Pedido ${selectedOrder.order_number}` : 'Detalle del pedido'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody pb={6}>
            {detailLoading && <Center py={10}><Spinner color="brand.500" /></Center>}
            {!detailLoading && selectedOrder && (
              <VStack align="stretch" spacing={4}>
                <Box>
                  <Text fontSize="sm" color="fg.muted">Cliente</Text>
                  <Text fontWeight="600">{selectedOrder.customer_name}</Text>
                  <Text fontSize="sm" color="fg.muted">{selectedOrder.customer_email}{selectedOrder.customer_phone ? ` · ${selectedOrder.customer_phone}` : ''}</Text>
                  {selectedOrder.shipping_address && <Text fontSize="sm" mt={1}>Envío: {selectedOrder.shipping_address}</Text>}
                  {selectedOrder.notes && <Text fontSize="sm" color="fg.muted" mt={1}>Notas: {selectedOrder.notes}</Text>}
                </Box>
                <Divider />
                <Box>
                  <Text fontSize="sm" color="fg.muted">Forma de pago</Text>
                  <HStack spacing={2} mt={1} flexWrap="wrap">
                    <Text fontWeight="600" textTransform="capitalize">
                      {selectedOrder.payment_method === 'transferencia' ? 'Transferencia' : selectedOrder.payment_method === 'efectivo' ? 'Efectivo' : 'No informado'}
                    </Text>
                    {selectedOrder.payment_method === 'transferencia' && selectedOrder.payment_receipt_pending && (
                      <Badge colorScheme="orange" borderRadius="full">Comprobante no subido</Badge>
                    )}
                  </HStack>
                  {selectedOrder.payment_method === 'transferencia' && selectedOrder.payment_receipt_url && (() => {
                    const url = resolveUploadUrl(selectedOrder.payment_receipt_url);
                    const isPdf = /\.pdf($|\?)/i.test(selectedOrder.payment_receipt_url);
                    return (
                      <Box mt={2}>
                        {isPdf ? (
                          <Link href={url} color="brand.500" isExternal fontSize="sm">Ver comprobante (PDF)</Link>
                        ) : (
                          <Link href={url} isExternal>
                            <Image src={url} alt="Comprobante" maxH="180px" borderRadius="md" borderWidth="1px" borderColor="border.subtle" />
                          </Link>
                        )}
                      </Box>
                    );
                  })()}
                </Box>
                <Divider />
                <Box>
                  <Text fontWeight="600" mb={2}>Productos</Text>
                  <Text fontSize="xs" color="fg.muted" mb={2}>Marcá los ítems preparados (se guarda en este navegador y se borra al pasar el pedido a <strong>enviado</strong>).</Text>
                  <Table size="sm" variant="simple">
                    <Thead>
                      <Tr><Th w="40px">Listo</Th><Th>Ítem</Th><Th isNumeric>Cant.</Th><Th isNumeric>Precio</Th><Th isNumeric>Subtotal</Th></Tr>
                    </Thead>
                    <Tbody>
                      {(selectedOrder.items || []).map((item) => {
                        const ready = !!prep[item.id];
                        return (
                          <Tr key={item.id} opacity={ready ? 0.7 : 1}>
                            <Td>
                              <Checkbox
                                isChecked={ready}
                                colorScheme="green"
                                onChange={async (e) => {
                                  const next = { ...prep, [item.id]: e.target.checked };
                                  setPrep(next);
                                  savePrep(selectedOrder.id, next);
                                  const allChecked = (selectedOrder.items || []).length > 0
                                    && (selectedOrder.items || []).every((it) => !!next[it.id]);
                                  if (e.target.checked && allChecked && selectedOrder.status === 'preparando') {
                                    setSelectedOrder((prev) => (prev ? { ...prev, status: 'confirmado' } : prev));
                                    await changeStatus(selectedOrder.id, 'confirmado');
                                  }
                                }}
                                aria-label={`Marcar ${item.name} como preparado`}
                              />
                            </Td>
                            <Td>
                              <Text textDecoration={ready ? 'line-through' : 'none'}>{item.name}</Text>
                              <Text fontSize="xs" color="fg.muted">{item.type === 'service' ? 'Servicio' : 'Producto'}</Text>
                            </Td>
                            <Td isNumeric>{item.quantity}</Td>
                            <Td isNumeric>{formatPrice(item.price)}</Td>
                            <Td isNumeric fontWeight="600">{formatPrice(Number(item.price) * Number(item.quantity))}</Td>
                          </Tr>
                        );
                      })}
                      {(!selectedOrder.items || selectedOrder.items.length === 0) && (
                        <Tr><Td colSpan={5}><Text color="fg.muted" textAlign="center" py={3}>Sin ítems</Text></Td></Tr>
                      )}
                    </Tbody>
                  </Table>
                </Box>
                <HStack justify="space-between" pt={1}>
                  <Text fontWeight="700">Total</Text>
                  <Text fontWeight="700" fontSize="lg" color="brand.600">{formatPrice(selectedOrder.total)}</Text>
                </HStack>
              </VStack>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      <Modal isOpen={voidDisc.isOpen} onClose={voidDisc.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Anular factura del pedido</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Text mb={3}>
              Vas a anular la factura vinculada al pedido <strong>{voidOrder?.order_number || voidOrder?.id}</strong>. El pedido pasará a <strong>cancelado</strong> y se repondrá el stock.
            </Text>
            <Text fontSize="sm" color="fg.muted" mb={3}>
              Si la sesión de caja original está cerrada y hay caja abierta hoy, se generará un egreso compensatorio en la caja de hoy. Si no hay caja abierta hoy, la anulación se bloqueará.
            </Text>
            <FormControl>
              <FormLabel>Motivo (opcional)</FormLabel>
              <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Motivo de anulación" />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={voidDisc.onClose}>Cancelar</Button>
            <Button colorScheme="red" onClick={confirmVoidLinkedInvoice} isLoading={voiding}>Anular factura</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
