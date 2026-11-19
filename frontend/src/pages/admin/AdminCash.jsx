import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge, Box, Button, Card, CardBody, Divider, FormControl, FormLabel, Grid, GridItem,
  Heading, HStack, IconButton, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Spinner, Stat, StatLabel,
  StatNumber, Tab, TabList, TabPanel, TabPanels, Table, TableContainer, Tabs, Tbody, Td,
  Text, Textarea, Th, Thead, Tr, VStack, useDisclosure, useToast, Center,
} from '@chakra-ui/react';
import { FiCheck, FiEdit2, FiPlus, FiRefreshCw, FiSlash, FiTrash2 } from 'react-icons/fi';
import api from '../../api/client';

const money = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const fmtDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d).slice(0, 10);
  return dt.toLocaleDateString('es-AR');
};
const fmtDateTime = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleString('es-AR');
};

const STATUS_LABEL = {
  cobrado: 'Cobrado',
  pendiente_verificacion: 'Pendiente verificación',
  pendiente_cobro: 'Pendiente cobro',
  registrado: 'Registrado',
  anulado: 'Anulado',
};
const STATUS_COLOR = {
  cobrado: 'green',
  pendiente_verificacion: 'orange',
  pendiente_cobro: 'yellow',
  registrado: 'blue',
  anulado: 'red',
};
const ORIGIN_LABEL = {
  factura: 'Factura',
  pedido: 'Pedido',
  reparacion: 'Reparación',
  otro: 'Otro',
  egreso_manual: 'Egreso manual',
};
const PM_LABEL = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  cuenta_corriente: 'Cuenta corriente',
  otro: 'Otro',
};

export default function AdminCash() {
  const toast = useToast();
  const bg = 'bg.surface';

  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [byOrigin, setByOrigin] = useState([]);
  const [cashBalance, setCashBalance] = useState(null);
  const [movements, setMovements] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [categories, setCategories] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [currentCashState, setCurrentCashState] = useState(null);

  const [filters, setFilters] = useState({
    date_from: todayYmd().slice(0, 8) + '01',
    date_to: todayYmd(),
    movement_type: '',
    status: '',
    origin_type: '',
    payment_method: '',
    category_id: '',
    search: '',
  });

  // modals
  const openDisc = useDisclosure();
  const closeDisc = useDisclosure();
  const expenseDisc = useDisclosure();
  const incomeDisc = useDisclosure();
  const categoryDisc = useDisclosure();
  const voidDisc = useDisclosure();

  const [openForm, setOpenForm] = useState({ session_date: todayYmd(), opening_balance: 0, notes: '' });
  const [closeForm, setCloseForm] = useState({ counted_cash: '', notes: '' });
  const [expenseForm, setExpenseForm] = useState({ id: null, movement_date: todayYmd(), amount: '', description: '', payment_method: 'efectivo', category_id: '', reference: '', counterparty: '', notes: '' });
  const [incomeForm, setIncomeForm] = useState({ movement_date: todayYmd(), amount: '', description: '', payment_method: 'efectivo', reference: '', counterparty: '', notes: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadAll = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { ...filters, page, limit: 50 };
      Object.keys(params).forEach((k) => { if (params[k] === '' || params[k] == null) delete params[k]; });
      const sumParams = {};
      if (filters.date_from) sumParams.date_from = filters.date_from;
      if (filters.date_to) sumParams.date_to = filters.date_to;
      const [sumRes, movRes, catRes, sessRes, curRes] = await Promise.all([
        api.get('/cash/summary', { params: sumParams }),
        api.get('/cash/movements', { params }),
        api.get('/cash/categories', { params: { include_inactive: 'true' } }),
        api.get('/cash/sessions', { params: { limit: 20 } }),
        api.get('/cash/session/current'),
      ]);
      setSummary(sumRes.data.summary || null);
      setByOrigin(sumRes.data.by_origin || []);
      setCashBalance(sumRes.data.cash_balance || null);
      setMovements(movRes.data.movements || []);
      setPagination(movRes.data.pagination || { page: 1, pages: 1, total: 0 });
      setCategories(catRes.data.categories || []);
      setSessions(sessRes.data.sessions || []);
      setCurrentSession(curRes.data.open || curRes.data.today || curRes.data.session || null);
      setCurrentCashState(curRes.data.cash_state || null);
    } catch (err) {
      toast({ title: 'Error al cargar Caja', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => { loadAll(1); }, []); // eslint-disable-line
  // reload when filters applied manually via button; initial load done

  const activeCategories = useMemo(() => categories.filter((c) => c.is_active), [categories]);

  const openExpense = (m = null) => {
    if (m) {
      setExpenseForm({
        id: m.id,
        movement_date: String(m.movement_date || '').slice(0, 10),
        amount: m.amount,
        description: m.description || '',
        payment_method: m.payment_method || 'efectivo',
        category_id: m.category_id || '',
        reference: m.reference || '',
        counterparty: m.counterparty || '',
        notes: m.notes || '',
      });
    } else {
      setExpenseForm({ id: null, movement_date: todayYmd(), amount: '', description: '', payment_method: 'efectivo', category_id: '', reference: '', counterparty: '', notes: '' });
    }
    expenseDisc.onOpen();
  };

  const saveExpense = async () => {
    if (!expenseForm.description?.trim()) return toast({ title: 'Ingresá el concepto', status: 'warning' });
    if (!(Number(expenseForm.amount) > 0)) return toast({ title: 'Ingresá un monto válido', status: 'warning' });
    if (!expenseForm.category_id) return toast({ title: 'Seleccioná una categoría', status: 'warning' });
    setSaving(true);
    try {
      const payload = {
        movement_date: expenseForm.movement_date,
        amount: Number(expenseForm.amount),
        description: expenseForm.description,
        payment_method: expenseForm.payment_method,
        category_id: Number(expenseForm.category_id),
        reference: expenseForm.reference || null,
        counterparty: expenseForm.counterparty || null,
        notes: expenseForm.notes || null,
      };
      if (expenseForm.id) {
        await api.put(`/cash/movements/${expenseForm.id}`, payload);
        toast({ title: 'Egreso actualizado', status: 'success' });
      } else {
        await api.post('/cash/movements', { ...payload, movement_type: 'egreso' });
        toast({ title: 'Egreso registrado', status: 'success' });
      }
      expenseDisc.onClose();
      loadAll(pagination.page);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Error al guardar egreso', status: 'error' });
    } finally { setSaving(false); }
  };

  const saveIncome = async () => {
    if (!incomeForm.description?.trim()) return toast({ title: 'Ingresá el concepto', status: 'warning' });
    if (!(Number(incomeForm.amount) > 0)) return toast({ title: 'Ingresá un monto válido', status: 'warning' });
    setSaving(true);
    try {
      await api.post('/cash/movements', {
        movement_type: 'ingreso',
        movement_date: incomeForm.movement_date,
        amount: Number(incomeForm.amount),
        description: incomeForm.description,
        payment_method: incomeForm.payment_method,
        reference: incomeForm.reference || null,
        counterparty: incomeForm.counterparty || null,
        notes: incomeForm.notes || null,
      });
      toast({ title: 'Ingreso registrado', status: 'success' });
      incomeDisc.onClose();
      setIncomeForm({ movement_date: todayYmd(), amount: '', description: '', payment_method: 'efectivo', reference: '', counterparty: '', notes: '' });
      loadAll(pagination.page);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Error al registrar ingreso', status: 'error' });
    } finally { setSaving(false); }
  };

  const confirmPending = async (id) => {
    try {
      await api.post(`/cash/movements/${id}/confirm`);
      toast({ title: 'Cobro confirmado', status: 'success' });
      loadAll(pagination.page);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'No se pudo confirmar', status: 'error' });
    }
  };

  const askVoid = (m) => { setVoidTarget(m); setVoidReason(''); voidDisc.onOpen(); };
  const doVoid = async () => {
    if (!voidTarget) return;
    try {
      await api.post(`/cash/movements/${voidTarget.id}/void`, { reason: voidReason || null });
      toast({ title: 'Movimiento anulado', status: 'success' });
      voidDisc.onClose(); setVoidTarget(null);
      loadAll(pagination.page);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'No se pudo anular', status: 'error' });
    }
  };

  const deleteMovement = async (m) => {
    if (!window.confirm('¿Eliminar este egreso manual? Esta acción no se puede deshacer.')) return;
    try {
      await api.delete(`/cash/movements/${m.id}`);
      toast({ title: 'Movimiento eliminado', status: 'success' });
      loadAll(pagination.page);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'No se pudo eliminar', status: 'error' });
    }
  };

  const openSessionAction = async () => {
    setSaving(true);
    try {
      await api.post('/cash/sessions/open', {
        session_date: openForm.session_date,
        opening_balance: Number(openForm.opening_balance || 0),
        notes: openForm.notes || null,
      });
      toast({ title: 'Sesión de caja abierta', status: 'success' });
      openDisc.onClose();
      loadAll(pagination.page);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'No se pudo abrir la sesión', status: 'error' });
    } finally { setSaving(false); }
  };

  const closeSessionAction = async () => {
    if (!currentSession || currentSession.status !== 'abierta') return;
    if (closeForm.counted_cash === '' || Number(closeForm.counted_cash) < 0) {
      return toast({ title: 'Ingresá el efectivo contado (arqueo)', status: 'warning' });
    }
    setSaving(true);
    try {
      await api.post(`/cash/sessions/${currentSession.id}/close`, {
        counted_cash: Number(closeForm.counted_cash),
        notes: closeForm.notes || null,
      });
      toast({ title: 'Sesión cerrada', status: 'success' });
      closeDisc.onClose();
      setCloseForm({ counted_cash: '', notes: '' });
      loadAll(pagination.page);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'No se pudo cerrar la sesión', status: 'error' });
    } finally { setSaving(false); }
  };

  const createCategory = async () => {
    if (!categoryForm.name?.trim()) return toast({ title: 'Ingresá el nombre', status: 'warning' });
    try {
      await api.post('/cash/categories', { name: categoryForm.name.trim() });
      toast({ title: 'Categoría creada', status: 'success' });
      setCategoryForm({ name: '' });
      categoryDisc.onClose();
      const { data } = await api.get('/cash/categories', { params: { include_inactive: 'true' } });
      setCategories(data.categories || []);
    } catch (err) {
      toast({ title: err.response?.data?.error || 'No se pudo crear la categoría', status: 'error' });
    }
  };

  const applyFilters = () => loadAll(1);

  return (
    <Box>
      <HStack justify="space-between" mb={6} flexWrap="wrap" gap={3}>
        <Heading size="lg" fontWeight="700" letterSpacing="-0.02em">Caja</Heading>
        <HStack>
          <IconButton aria-label="Actualizar" icon={<FiRefreshCw />} onClick={() => loadAll(pagination.page)} variant="outline" />
          <Button leftIcon={<FiPlus />} variant="outline" onClick={() => incomeDisc.onOpen()}>Ingreso manual</Button>
          <Button leftIcon={<FiPlus />} colorScheme="brand" onClick={() => openExpense(null)}>Nuevo egreso</Button>
        </HStack>
      </HStack>

      <Tabs colorScheme="brand">
        <TabList overflowX="auto" flexWrap={{ base: 'nowrap', md: 'wrap' }}>
          <Tab>Resumen</Tab>
          <Tab>Movimientos</Tab>
          <Tab>Egresos</Tab>
          <Tab>Cierre diario</Tab>
        </TabList>
        <TabPanels>
          <TabPanel px={0}>
            <Card mb={4}><CardBody>
              <HStack spacing={3} flexWrap="wrap" align="end">
                <FormControl maxW="180px"><FormLabel fontSize="sm">Desde</FormLabel><Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /></FormControl>
                <FormControl maxW="180px"><FormLabel fontSize="sm">Hasta</FormLabel><Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /></FormControl>
                <Button onClick={applyFilters}>Aplicar</Button>
              </HStack>
            </CardBody></Card>

            {summary && (
              <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} mb={6}>
                <Card bg={bg}><CardBody><Stat><StatLabel>Ingresos cobrados</StatLabel><StatNumber color="green.500">{money(summary.ingresos_cobrados)}</StatNumber></Stat></CardBody></Card>
                <Card bg={bg}><CardBody><Stat><StatLabel>Ingresos pendientes</StatLabel><StatNumber color="orange.500">{money(summary.ingresos_pendientes)}</StatNumber><Text fontSize="xs" color="fg.muted">Verif.: {money(summary.pendientes_verificacion)} · Cobro: {money(summary.pendientes_cobro)}</Text></Stat></CardBody></Card>
                <Card bg={bg}><CardBody><Stat><StatLabel>Egresos</StatLabel><StatNumber color="red.500">{money(summary.egresos_total)}</StatNumber></Stat></CardBody></Card>
                <Card bg={bg}><CardBody><Stat><StatLabel>Saldo neto (cobrados - egresos)</StatLabel><StatNumber color="brand.600">{money(summary.saldo_neto)}</StatNumber></Stat></CardBody></Card>
                {cashBalance && (
                  <Card bg={bg} gridColumn={{ base: 'auto', lg: 'span 2' }} borderColor="brand.200" borderWidth="1px">
                    <CardBody>
                      <Stat>
                        <StatLabel>Saldo efectivo que debería haber (sesión {cashBalance.session_status === 'abierta' ? 'abierta' : 'del día'} {fmtDate(cashBalance.session_date)})</StatLabel>
                        <StatNumber color="teal.600">{money(cashBalance.expected_cash)}</StatNumber>
                        <Text fontSize="xs" color="fg.muted" mt={1}>
                          Apertura {money(cashBalance.opening_balance)} + ingresos efectivo cobrados {money(cashBalance.ingresos_efectivo)} − egresos efectivo {money(cashBalance.egresos_efectivo)}
                        </Text>
                      </Stat>
                    </CardBody>
                  </Card>
                )}
              </SimpleGrid>
            )}
            {summary && (
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                <Card><CardBody>
                  <Heading size="sm" mb={3}>Ingresos cobrados por medio</Heading>
                  <VStack align="stretch" spacing={2} fontSize="sm">
                    <HStack justify="space-between"><Text>Efectivo</Text><Text fontWeight="600">{money(summary.ingresos_cobrados_efectivo)}</Text></HStack>
                    <HStack justify="space-between"><Text>Transferencia</Text><Text fontWeight="600">{money(summary.ingresos_cobrados_transferencia)}</Text></HStack>
                    <HStack justify="space-between"><Text>Cuenta corriente</Text><Text fontWeight="600">{money(summary.ingresos_cobrados_cuenta_corriente)}</Text></HStack>
                    <Divider />
                    <HStack justify="space-between"><Text>Egresos en efectivo</Text><Text fontWeight="600">{money(summary.egresos_efectivo)}</Text></HStack>
                  </VStack>
                </CardBody></Card>
                <Card><CardBody>
                  <Heading size="sm" mb={3}>Ingresos por origen (período)</Heading>
                  {byOrigin.length === 0 ? <Text color="fg.muted" fontSize="sm">Sin ingresos en el período.</Text> : (
                    <TableContainer><Table size="sm"><Thead><Tr><Th>Origen</Th><Th isNumeric>Cobrado</Th><Th isNumeric>Pendiente</Th></Tr></Thead><Tbody>
                      {byOrigin.map((r) => (
                        <Tr key={r.origin_type}><Td>{ORIGIN_LABEL[r.origin_type] || r.origin_type}</Td><Td isNumeric>{money(r.cobrado)}</Td><Td isNumeric>{money(r.pendiente)}</Td></Tr>
                      ))}
                    </Tbody></Table></TableContainer>
                  )}
                </CardBody></Card>
              </SimpleGrid>
            )}
          </TabPanel>

          <TabPanel px={0}>
            <Card mb={4}><CardBody>
              <SimpleGrid columns={{ base: 1, md: 3, lg: 6 }} spacing={3}>
                <FormControl><FormLabel fontSize="sm">Desde</FormLabel><Input type="date" value={filters.date_from} onChange={(e) => setFilters({ ...filters, date_from: e.target.value })} /></FormControl>
                <FormControl><FormLabel fontSize="sm">Hasta</FormLabel><Input type="date" value={filters.date_to} onChange={(e) => setFilters({ ...filters, date_to: e.target.value })} /></FormControl>
                <FormControl><FormLabel fontSize="sm">Tipo</FormLabel><Select placeholder="Todos" value={filters.movement_type} onChange={(e) => setFilters({ ...filters, movement_type: e.target.value })}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></Select></FormControl>
                <FormControl><FormLabel fontSize="sm">Estado</FormLabel><Select placeholder="Todos" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="cobrado">Cobrado</option><option value="pendiente_verificacion">Pendiente verificación</option><option value="pendiente_cobro">Pendiente cobro</option><option value="registrado">Registrado</option><option value="anulado">Anulado</option></Select></FormControl>
                <FormControl><FormLabel fontSize="sm">Origen</FormLabel><Select placeholder="Todos" value={filters.origin_type} onChange={(e) => setFilters({ ...filters, origin_type: e.target.value })}><option value="factura">Factura</option><option value="pedido">Pedido</option><option value="reparacion">Reparación</option><option value="otro">Otro</option><option value="egreso_manual">Egreso manual</option></Select></FormControl>
                <FormControl><FormLabel fontSize="sm">Medio</FormLabel><Select placeholder="Todos" value={filters.payment_method} onChange={(e) => setFilters({ ...filters, payment_method: e.target.value })}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="cuenta_corriente">Cuenta corriente</option><option value="otro">Otro</option></Select></FormControl>
              </SimpleGrid>
              <HStack mt={3} flexWrap="wrap">
                <Input placeholder="Buscar concepto, referencia o contraparte" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} maxW="360px" />
                <Button onClick={applyFilters}>Filtrar</Button>
              </HStack>
            </CardBody></Card>

            <Card><CardBody>
              {loading ? <Center py={10}><Spinner /></Center> : movements.length === 0 ? (
                <Text color="fg.muted" py={6} textAlign="center">No hay movimientos para los filtros seleccionados.</Text>
              ) : (
                <TableContainer>
                  <Table size="sm">
                    <Thead><Tr><Th>Fecha</Th><Th>Tipo</Th><Th>Concepto</Th><Th>Origen</Th><Th>Medio</Th><Th>Estado</Th><Th isNumeric>Monto</Th><Th>Acciones</Th></Tr></Thead>
                    <Tbody>
                      {movements.map((m) => (
                        <Tr key={m.id} opacity={m.status === 'anulado' ? 0.6 : 1}>
                          <Td>{fmtDate(m.movement_date)}</Td>
                          <Td><Badge colorScheme={m.movement_type === 'ingreso' ? 'green' : 'red'}>{m.movement_type === 'ingreso' ? 'Ingreso' : 'Egreso'}</Badge></Td>
                          <Td>
                            <Text fontWeight="500">{m.description}</Text>
                            <Text fontSize="xs" color="fg.muted">{[m.reference, m.counterparty, m.category_name].filter(Boolean).join(' · ')}</Text>
                          </Td>
                          <Td>{ORIGIN_LABEL[m.origin_type] || m.origin_type}{m.origin_id ? ` #${m.origin_id}` : ''}</Td>
                          <Td>{PM_LABEL[m.payment_method] || m.payment_method}</Td>
                          <Td><Badge colorScheme={STATUS_COLOR[m.status] || 'gray'}>{STATUS_LABEL[m.status] || m.status}</Badge></Td>
                          <Td isNumeric fontWeight="600" color={m.movement_type === 'ingreso' ? 'green.600' : 'red.500'}>{m.movement_type === 'ingreso' ? '+' : '-'}{money(m.amount)}</Td>
                          <Td>
                            <HStack spacing={1}>
                              {m.movement_type === 'ingreso' && ['pendiente_verificacion', 'pendiente_cobro'].includes(m.status) && (
                                <IconButton size="sm" aria-label="Confirmar cobro" icon={<FiCheck />} colorScheme="green" variant="ghost" onClick={() => confirmPending(m.id)} title="Confirmar cobro" />
                              )}
                              {m.movement_type === 'egreso' && m.origin_type === 'egreso_manual' && m.status !== 'anulado' && (
                                <IconButton size="sm" aria-label="Editar" icon={<FiEdit2 />} variant="ghost" onClick={() => openExpense(m)} />
                              )}
                              {m.status !== 'anulado' && !(m.movement_type === 'egreso' && m.origin_type === 'egreso_manual') && (
                                <IconButton size="sm" aria-label="Anular" icon={<FiSlash />} colorScheme="orange" variant="ghost" onClick={() => askVoid(m)} title="Anular" />
                              )}
                              {m.movement_type === 'egreso' && m.origin_type === 'egreso_manual' && m.status !== 'anulado' && (
                                <IconButton size="sm" aria-label="Anular egreso" icon={<FiSlash />} colorScheme="orange" variant="ghost" onClick={() => askVoid(m)} />
                              )}
                              {m.movement_type === 'egreso' && m.origin_type === 'egreso_manual' && (
                                <IconButton size="sm" aria-label="Eliminar" icon={<FiTrash2 />} colorScheme="red" variant="ghost" onClick={() => deleteMovement(m)} />
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              )}
              {pagination.pages > 1 && (
                <HStack mt={4} justify="center">
                  <Button size="sm" isDisabled={pagination.page <= 1} onClick={() => loadAll(pagination.page - 1)}>Anterior</Button>
                  <Text fontSize="sm">Página {pagination.page} de {pagination.pages} ({pagination.total})</Text>
                  <Button size="sm" isDisabled={pagination.page >= pagination.pages} onClick={() => loadAll(pagination.page + 1)}>Siguiente</Button>
                </HStack>
              )}
            </CardBody></Card>
          </TabPanel>

          <TabPanel px={0}>
            <HStack mb={4} justify="space-between" flexWrap="wrap" gap={2}>
              <Text color="fg.muted" fontSize="sm">Egresos manuales: podés registrar, editar, anular o eliminar. Las categorías se pueden crear desde el formulario.</Text>
              <Button leftIcon={<FiPlus />} colorScheme="brand" size="sm" onClick={() => openExpense(null)}>Registrar egreso</Button>
            </HStack>
            <Card><CardBody>
              <Heading size="sm" mb={3}>Categorías de egreso</Heading>
              <HStack mb={4} flexWrap="wrap">
                <Button size="sm" variant="outline" leftIcon={<FiPlus />} onClick={() => categoryDisc.onOpen()}>Nueva categoría</Button>
              </HStack>
              <HStack spacing={2} flexWrap="wrap" mb={4}>
                {categories.map((c) => (
                  <Badge key={c.id} colorScheme={c.is_active ? 'purple' : 'gray'} variant={c.is_default ? 'solid' : 'subtle'} px={2} py={1}>{c.name}{!c.is_active ? ' (inactiva)' : ''}</Badge>
                ))}
              </HStack>
              <Divider mb={4} />
              <Text fontSize="sm" color="fg.muted">Usá la pestaña “Movimientos” filtrando por tipo “Egreso” para ver y gestionar egresos (editar/anular/eliminar) con todos los filtros.</Text>
            </CardBody></Card>
          </TabPanel>

          <TabPanel px={0}>
            <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4}>
              <Card><CardBody>
                <Heading size="sm" mb={3}>Sesión actual / del día</Heading>
                {currentSession ? (
                  <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between"><Text>Fecha</Text><Text fontWeight="600">{fmtDate(currentSession.session_date)}</Text></HStack>
                    <HStack justify="space-between"><Text>Estado</Text><Badge colorScheme={currentSession.status === 'abierta' ? 'green' : 'gray'}>{currentSession.status}</Badge></HStack>
                    <HStack justify="space-between"><Text>Saldo inicial (efectivo)</Text><Text>{money(currentSession.opening_balance)}</Text></HStack>
                    {currentCashState && (
                      <>
                        <Divider />
                        <HStack justify="space-between"><Text>Ingresos en efectivo (cobrados)</Text><Text>{money(currentCashState.ingresos_efectivo)}</Text></HStack>
                        <HStack justify="space-between"><Text>Egresos en efectivo</Text><Text>{money(currentCashState.egresos_efectivo)}</Text></HStack>
                        <HStack justify="space-between"><Text fontWeight="600">Efectivo esperado (saldo que debería haber)</Text><Text fontWeight="700" color="teal.600">{money(currentCashState.expected_cash)}</Text></HStack>
                      </>
                    )}
                    {currentSession.status === 'cerrada' && (
                      <>
                        <Divider />
                        <HStack justify="space-between"><Text>Efectivo contado</Text><Text>{money(currentSession.counted_cash)}</Text></HStack>
                        <HStack justify="space-between"><Text>Diferencia</Text><Text fontWeight="700" color={Number(currentSession.difference) === 0 ? 'green.500' : 'orange.500'}>{money(currentSession.difference)}</Text></HStack>
                        <Text fontSize="xs" color="fg.muted">Cerrada: {fmtDateTime(currentSession.closed_at)}</Text>
                      </>
                    )}
                    {currentSession.status === 'abierta' && (
                      <Button mt={2} colorScheme="orange" onClick={() => closeDisc.onOpen()}>Cerrar caja (arqueo)</Button>
                    )}
                  </VStack>
                ) : (
                  <VStack align="stretch" spacing={3}>
                    <Text color="fg.muted">No hay sesión abierta ni del día.</Text>
                    <Button colorScheme="brand" onClick={() => { setOpenForm({ session_date: todayYmd(), opening_balance: 0, notes: '' }); openDisc.onOpen(); }}>Abrir sesión de caja</Button>
                  </VStack>
                )}
                {currentSession && currentSession.status !== 'abierta' && (
                  <Button mt={4} variant="outline" onClick={() => { setOpenForm({ session_date: todayYmd(), opening_balance: 0, notes: '' }); openDisc.onOpen(); }}>Abrir nueva sesión</Button>
                )}
              </CardBody></Card>

              <Card><CardBody>
                <Heading size="sm" mb={3}>Sesiones recientes</Heading>
                {sessions.length === 0 ? <Text color="fg.muted" fontSize="sm">Sin sesiones registradas.</Text> : (
                  <TableContainer><Table size="sm"><Thead><Tr><Th>Fecha</Th><Th>Estado</Th><Th isNumeric>Apertura</Th><Th isNumeric>Contado</Th><Th isNumeric>Diferencia</Th></Tr></Thead><Tbody>
                    {sessions.map((s) => (
                      <Tr key={s.id}>
                        <Td>{fmtDate(s.session_date)}</Td>
                        <Td><Badge colorScheme={s.status === 'abierta' ? 'green' : 'gray'}>{s.status}</Badge></Td>
                        <Td isNumeric>{money(s.opening_balance)}</Td>
                        <Td isNumeric>{s.counted_cash != null ? money(s.counted_cash) : '-'}</Td>
                        <Td isNumeric>{s.difference != null ? money(s.difference) : '-'}</Td>
                      </Tr>
                    ))}
                  </Tbody></Table></TableContainer>
                )}
              </CardBody></Card>
            </SimpleGrid>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Abrir sesión */}
      <Modal isOpen={openDisc.isOpen} onClose={openDisc.onClose}>
        <ModalOverlay /><ModalContent>
          <ModalHeader>Abrir sesión de caja</ModalHeader><ModalCloseButton />
          <ModalBody>
            <VStack spacing={3}>
              <FormControl><FormLabel>Fecha</FormLabel><Input type="date" value={openForm.session_date} onChange={(e) => setOpenForm({ ...openForm, session_date: e.target.value })} /></FormControl>
              <FormControl><FormLabel>Saldo inicial (efectivo)</FormLabel><Input type="number" min={0} step="0.01" value={openForm.opening_balance} onChange={(e) => setOpenForm({ ...openForm, opening_balance: e.target.value })} /></FormControl>
              <FormControl><FormLabel>Notas</FormLabel><Textarea value={openForm.notes} onChange={(e) => setOpenForm({ ...openForm, notes: e.target.value })} /></FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={openDisc.onClose}>Cancelar</Button><Button colorScheme="brand" onClick={openSessionAction} isLoading={saving}>Abrir</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Cerrar sesión */}
      <Modal isOpen={closeDisc.isOpen} onClose={closeDisc.onClose}>
        <ModalOverlay /><ModalContent>
          <ModalHeader>Cerrar sesión de caja</ModalHeader><ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <Text fontSize="sm" color="fg.muted">Ingresá el efectivo contado (arqueo). El sistema calculará el efectivo esperado y la diferencia.</Text>
              {currentCashState && (
                <Box p={3} borderWidth="1px" borderRadius="md" bg="bg.subtle">
                  <HStack justify="space-between"><Text fontSize="sm">Efectivo esperado (saldo que debería haber)</Text><Text fontWeight="700" color="teal.600">{money(currentCashState.expected_cash)}</Text></HStack>
                  <Text fontSize="xs" color="fg.muted" mt={1}>Apertura {money(currentCashState.opening_balance)} + ingresos efectivo {money(currentCashState.ingresos_efectivo)} − egresos efectivo {money(currentCashState.egresos_efectivo)}</Text>
                  {closeForm.counted_cash !== '' && Number.isFinite(Number(closeForm.counted_cash)) && (
                    <HStack justify="space-between" mt={2}>
                      <Text fontSize="sm">Diferencia estimada</Text>
                      <Text fontWeight="700" color={Math.abs(Number(closeForm.counted_cash) - Number(currentCashState.expected_cash)) < 0.005 ? 'green.500' : 'orange.500'}>
                        {money(Number(closeForm.counted_cash) - Number(currentCashState.expected_cash))}
                      </Text>
                    </HStack>
                  )}
                </Box>
              )}
              <FormControl isRequired><FormLabel>Efectivo contado</FormLabel><Input type="number" min={0} step="0.01" value={closeForm.counted_cash} onChange={(e) => setCloseForm({ ...closeForm, counted_cash: e.target.value })} /></FormControl>
              <FormControl><FormLabel>Notas</FormLabel><Textarea value={closeForm.notes} onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })} /></FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={closeDisc.onClose}>Cancelar</Button><Button colorScheme="orange" onClick={closeSessionAction} isLoading={saving}>Cerrar caja</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Egreso */}
      <Modal isOpen={expenseDisc.isOpen} onClose={expenseDisc.onClose} size="lg">
        <ModalOverlay /><ModalContent>
          <ModalHeader>{expenseForm.id ? 'Editar egreso' : 'Registrar egreso'}</ModalHeader><ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              <FormControl isRequired><FormLabel>Fecha</FormLabel><Input type="date" value={expenseForm.movement_date} onChange={(e) => setExpenseForm({ ...expenseForm, movement_date: e.target.value })} /></FormControl>
              <FormControl isRequired><FormLabel>Monto</FormLabel><Input type="number" min={0} step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} /></FormControl>
              <FormControl isRequired gridColumn={{ md: 'span 2' }}><FormLabel>Concepto</FormLabel><Input value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} /></FormControl>
              <FormControl isRequired>
                <FormLabel>Categoría</FormLabel>
                <HStack>
                  <Select placeholder="Seleccionar" value={expenseForm.category_id} onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}>
                    {activeCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                  <IconButton aria-label="Nueva categoría" icon={<FiPlus />} onClick={() => categoryDisc.onOpen()} />
                </HStack>
              </FormControl>
              <FormControl isRequired><FormLabel>Medio de pago</FormLabel><Select value={expenseForm.payment_method} onChange={(e) => setExpenseForm({ ...expenseForm, payment_method: e.target.value })}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="otro">Otro</option></Select></FormControl>
              <FormControl><FormLabel>Referencia</FormLabel><Input value={expenseForm.reference} onChange={(e) => setExpenseForm({ ...expenseForm, reference: e.target.value })} /></FormControl>
              <FormControl><FormLabel>Proveedor / destinatario</FormLabel><Input value={expenseForm.counterparty} onChange={(e) => setExpenseForm({ ...expenseForm, counterparty: e.target.value })} /></FormControl>
              <FormControl gridColumn={{ md: 'span 2' }}><FormLabel>Notas</FormLabel><Textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} /></FormControl>
            </SimpleGrid>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={expenseDisc.onClose}>Cancelar</Button><Button colorScheme="brand" onClick={saveExpense} isLoading={saving}>Guardar</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Ingreso manual */}
      <Modal isOpen={incomeDisc.isOpen} onClose={incomeDisc.onClose} size="lg">
        <ModalOverlay /><ModalContent>
          <ModalHeader>Registrar ingreso manual (otro)</ModalHeader><ModalCloseButton />
          <ModalBody>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
              <FormControl isRequired><FormLabel>Fecha</FormLabel><Input type="date" value={incomeForm.movement_date} onChange={(e) => setIncomeForm({ ...incomeForm, movement_date: e.target.value })} /></FormControl>
              <FormControl isRequired><FormLabel>Monto</FormLabel><Input type="number" min={0} step="0.01" value={incomeForm.amount} onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })} /></FormControl>
              <FormControl isRequired gridColumn={{ md: 'span 2' }}><FormLabel>Concepto</FormLabel><Input value={incomeForm.description} onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })} /></FormControl>
              <FormControl isRequired><FormLabel>Medio de pago</FormLabel><Select value={incomeForm.payment_method} onChange={(e) => setIncomeForm({ ...incomeForm, payment_method: e.target.value })}><option value="efectivo">Efectivo (cobrado)</option><option value="transferencia">Transferencia (pendiente verificación)</option><option value="cuenta_corriente">Cuenta corriente (pendiente cobro)</option></Select></FormControl>
              <FormControl><FormLabel>Referencia</FormLabel><Input value={incomeForm.reference} onChange={(e) => setIncomeForm({ ...incomeForm, reference: e.target.value })} /></FormControl>
              <FormControl gridColumn={{ md: 'span 2' }}><FormLabel>Contraparte / cliente</FormLabel><Input value={incomeForm.counterparty} onChange={(e) => setIncomeForm({ ...incomeForm, counterparty: e.target.value })} /></FormControl>
              <FormControl gridColumn={{ md: 'span 2' }}><FormLabel>Notas</FormLabel><Textarea value={incomeForm.notes} onChange={(e) => setIncomeForm({ ...incomeForm, notes: e.target.value })} /></FormControl>
            </SimpleGrid>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={incomeDisc.onClose}>Cancelar</Button><Button colorScheme="brand" onClick={saveIncome} isLoading={saving}>Registrar</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Nueva categoría */}
      <Modal isOpen={categoryDisc.isOpen} onClose={categoryDisc.onClose}>
        <ModalOverlay /><ModalContent>
          <ModalHeader>Nueva categoría de egreso</ModalHeader><ModalCloseButton />
          <ModalBody>
            <FormControl isRequired><FormLabel>Nombre</FormLabel><Input value={categoryForm.name} onChange={(e) => setCategoryForm({ name: e.target.value })} placeholder="Ej: Insumos" /></FormControl>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={categoryDisc.onClose}>Cancelar</Button><Button colorScheme="brand" onClick={createCategory}>Crear</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Anular movimiento */}
      <Modal isOpen={voidDisc.isOpen} onClose={voidDisc.onClose}>
        <ModalOverlay /><ModalContent>
          <ModalHeader>Anular movimiento</ModalHeader><ModalCloseButton />
          <ModalBody>
            <Text mb={3} fontSize="sm">Se marcará como anulado y no sumará en los totales. {voidTarget?.origin_type && ['factura','pedido','reparacion'].includes(voidTarget.origin_type) ? 'Este movimiento proviene de un origen automático; anulalo solo si corresponde.' : ''}</Text>
            <FormControl><FormLabel>Motivo (opcional)</FormLabel><Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} /></FormControl>
          </ModalBody>
          <ModalFooter><Button variant="ghost" mr={3} onClick={voidDisc.onClose}>Cancelar</Button><Button colorScheme="orange" onClick={doVoid}>Anular</Button></ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
