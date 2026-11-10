import { useEffect, useState } from 'react';
import {
  Box, Heading, Table, Thead, Tbody, Tr, Th, Td, Select, Badge, Spinner, Center, useToast, Text,
  IconButton, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalCloseButton,
  VStack, HStack, Divider, useDisclosure, Checkbox, Link, Image,
} from '@chakra-ui/react';
import { FiEye } from 'react-icons/fi';
import api from '../../api/client';
import { resolveUploadUrl } from '../../api/uploads';

const formatPrice = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);
const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
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
  const { isOpen, onOpen, onClose } = useDisclosure();
  const toast = useToast();
  const bg = 'bg.surface';

  const load = () => {
    setLoading(true);
    api.get('/orders?limit=50').then(r => setOrders(r.data.orders || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const changeStatus = async (id, status) => {
    try {
      await api.put(`/orders/${id}/status`, { status });
      if (status === 'shipped') {
        localStorage.removeItem(prepKey(id));
        if (selectedOrder?.id === id) setPrep({});
      }
      toast({ title: 'Estado actualizado', status: 'success' });
      load();
    } catch (err) {
      toast({ title: 'Error', status: 'error' });
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
      <Heading size="lg" mb={6} fontWeight="700" letterSpacing="-0.02em">Pedidos</Heading>
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
                  <Select size="sm" value={o.status} onChange={e => changeStatus(o.id, e.target.value)} maxW="140px" bg="bg.surface">
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </Select>
                </Td>
                <Td color="fg.muted">{new Date(o.created_at).toLocaleString('es-AR')}</Td>
                <Td>
                  <IconButton aria-label="Ver detalle" icon={<FiEye />} size="sm" variant="ghost" onClick={() => openDetail(o.id)} />
                </Td>
              </Tr>
            ))}
            {orders.length === 0 && <Tr><Td colSpan={6}><Text textAlign="center" color="fg.muted" py={6}>Sin pedidos</Text></Td></Tr>}
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
                  <Text fontSize="xs" color="fg.muted" mb={2}>Marcá los ítems preparados (se guarda en este navegador y se borra al pasar el pedido a <strong>shipped</strong>).</Text>
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
                                onChange={(e) => {
                                  const next = { ...prep, [item.id]: e.target.checked };
                                  setPrep(next);
                                  savePrep(selectedOrder.id, next);
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
    </Box>
  );
}
