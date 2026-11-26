import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box, Button, Heading, Table, Thead, Tbody, Tr, Th, Td, Select, Badge, Spinner, Center, useToast, Text,
  IconButton, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton, ModalFooter,
  VStack, HStack, Divider, useDisclosure, Checkbox, Link, Image, Textarea, FormControl, FormLabel,
  Input, SimpleGrid,
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

  const initialStatus = searchParams.get('status') || '';
  const [filters, setFilters] = useState({
    search: '',
    status: initialStatus,
    payment_method: '',
    date_from: '',
    date_to: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    status: initialStatus,
    payment_method: '',
    date_from: '',
    date_to: '',
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const load = (page = 1, f = appliedFilters) => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (f.search?.trim()) params.search = f.search.trim();
    if (f.status) params.status = f.status;
    if (f.payment_method) params.payment_method = f.payment_method;
    if (f.date_from) params.date_from = f.date_from;
    if (f.date_to) params.date_to = f.date_to;
    api.get('/orders', { params })
      .then(r => {
        setOrders(r.data.orders || []);
        setPagination(r.data.pagination || { page: 1, limit: 20, total: 0, pages: 1 });
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(1, appliedFilters); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyFilters = () => {
    const next = { ...filters };
    setAppliedFilters(next);
    load(1, next);
  };

  const clearFilters = () => {
    const empty = { search: '', status: '', payment_method: '', date_from: '', date_to: '' };
    setFilters(empty);
    setAppliedFilters(empty);
    load(1, empty);
  };

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      if (status === 'enviado') {
        localStorage.removeItem(prepKey(id));
        if (selectedOrder?.id === id) setPrep({});
      }
      toast({ title: 'Estado actualizado', status: 'success' });
      load(pagination.page, appliedFilters);
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
      load(pagination.page, appliedFilters);
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

  if (loading) return <Center py={10}><Spinner color="brand.500" /></Center>;

  return (
    <Box>
      <HStack justify="space-between" mb={6} flexWrap="wrap" gap={2}>
        <Heading size="lg" fontWeight="700" letterSpacing="-0.02em">Pedidos</Heading>
        <Text fontSize="sm" color="fg.muted">{pagination.total} pedido{pagination.total === 1 ? '' : 's'}</Text>
      </HStack>

      <Box bg={bg} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" p={4} mb={4}>
        <SimpleGrid columns={{ base: 1, md: 3, lg: 6 }} spacing={3}>
          <FormControl>
            <FormLabel fontSize="sm">Buscar</FormLabel>
            <Input size="sm" placeholder="Nº, cliente o email" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Estado</FormLabel>
            <Select size="sm" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">Todos</option>
              {ORDER_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Forma de pago</FormLabel>
            <Select size="sm" value={filters.payment_method} onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}>
              <option value="">Todas</option>
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
            </Select>
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Desde</FormLabel>
            <Input size="sm" type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} />
          </FormControl>
          <FormControl>
            <FormLabel fontSize="sm">Hasta</FormLabel>
            <Input size="sm" type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} />
          </FormControl>
          <HStack align="end" spacing={2}>
            <Button size="sm" colorScheme="brand" onClick={applyFilters}>Aplicar</Button>
            <Button size="sm" variant="outline" onClick={clearFilters}>Limpiar</Button>
          </HStack>
        </SimpleGrid>
      </Box>
      <Box bg={bg} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" overflowX="auto">
        <Table size="sm">
          <Thead><Tr><Th>Nº</Th><Th>Cliente</Th><Th>Total</Th><Th>Estado</Th><Th>Fecha</Th><Th></Th></Tr></Thead>
          <Tbody>
            {orders.map(o => (
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
                    <IconButton aria-label="Ver detalle" icon={<FiEye />} size="md" variant="ghost" onClick={() => openDetail(o.id)} />
                    {o.status === 'cobrado' && (
                      <IconButton
                        aria-label="Facturar pedido"
                        icon={<FiFileText />}
                        size="md"
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
                        size="md"
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
            {orders.length === 0 && <Tr><Td colSpan={6}><Text textAlign="center" color="fg.muted" py={6}>Sin pedidos</Text></Td></Tr>}
          </Tbody>
        </Table>
      </Box>

      {pagination.pages > 1 && (
        <HStack justify="space-between" mt={4} flexWrap="wrap" gap={2}>
          <Text fontSize="sm" color="fg.muted">Página {pagination.page} de {pagination.pages}</Text>
          <HStack spacing={2}>
            <Button size="sm" variant="outline" onClick={() => load(pagination.page - 1, appliedFilters)} isDisabled={pagination.page <= 1}>Anterior</Button>
            <Button size="sm" variant="outline" onClick={() => load(pagination.page + 1, appliedFilters)} isDisabled={pagination.page >= pagination.pages}>Siguiente</Button>
          </HStack>
        </HStack>
      )}

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
