import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Badge, Box, Button, Card, CardBody, Divider, FormControl, FormLabel, Grid, GridItem,
  Heading, HStack, IconButton, Input, Modal, ModalBody, ModalCloseButton, ModalContent,
  ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Spinner, Stat, StatLabel,
  StatNumber, Tab, TabList, TabPanel, TabPanels, Table, TableContainer, Tabs, Tbody, Td,
  Text, Textarea, Th, Thead, Tooltip, Tr, VStack, useDisclosure, useToast, Center,
} from '@chakra-ui/react';
import { FiCheck, FiEdit2, FiEye, FiPlus, FiRefreshCw, FiSlash, FiTrash2 } from 'react-icons/fi';
import api from '../../api/client';

const money = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const todayYmd = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const prevDayYmd = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const defaultSummaryDatesForSession = (openSession) => {
  if (openSession && openSession.status === 'abierta') {
    const d = String(openSession.session_date || '').slice(0, 10) || todayYmd();
    return { date_from: d, date_to: d };
  }
  const prev = prevDayYmd();
  return { date_from: prev, date_to: prev };
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
  const [pendingIncomes, setPendingIncomes] = useState([]);
  const [loadingPending, setLoadingPending] = useState(false);

  const [filters, setFilters] = useState({
    date_from: todayYmd(),
    date_to: todayYmd(),
    movement_type: '',
    status: '',
    origin_type: '',
    payment_method: '',
    category_id: '',
    search: '',
  });
  const filtersInitializedRef = useRef(false);
  const [sessionDetailTarget, setSessionDetailTarget] = useState(null);
  const sessionDetailDisc = useDisclosure();
  const [movementDetailTarget, setMovementDetailTarget] = useState(null);
  const movementDetailDisc = useDisclosure();

  // modals
  const openDisc = useDisclosure();
  const closeDisc = useDisclosure();
  const expenseDisc = useDisclosure();
  const incomeDisc = useDisclosure();
  const categoryDisc = useDisclosure();
  const voidDisc = useDisclosure();
  const deleteDisc = useDisclosure();

  const [openForm, setOpenForm] = useState({ session_date: todayYmd(), opening_balance: 0, notes: '' });
  const [closeForm, setCloseForm] = useState({ counted_cash: '', notes: '' });
  const [expenseForm, setExpenseForm] = useState({ id: null, movement_date: todayYmd(), amount: '', description: '', payment_method: 'efectivo', category_id: '', reference: '', counterparty: '', notes: '' });
  const [incomeForm, setIncomeForm] = useState({ movement_date: todayYmd(), amount: '', description: '', payment_method: 'efectivo', reference: '', counterparty: '', notes: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '' });
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadPendingIncomes = useCallback(async () => {
    setLoadingPending(true);
    try {
      const { data } = await api.get('/cash/movements', { params: { movement_type: 'ingreso', payment_method: 'transferencia', limit: 200 } });
      const merged = [...(data.movements || [])];
      merged.sort((a, b) => {
        const da = new Date(a.movement_date || a.created_at || 0).getTime();
        const db = new Date(b.movement_date || b.created_at || 0).getTime();
        if (db !== da) return db - da;
        return (b.id || 0) - (a.id || 0);
      });
      setPendingIncomes(merged);
    } catch (err) {
      toast({ title: 'Error al cargar ingresos por transferencia', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setLoadingPending(false);
    }
  }, [toast]);

  const loadAll = useCallback(async (page = 1, filtersOverride = null) => {
    setLoading(true);
    try {
      const effectiveFilters = filtersOverride || filters;
      const params = { ...effectiveFilters, page, limit: 20 };
      Object.keys(params).forEach((k) => { if (params[k] === '' || params[k] == null) delete params[k]; });
      const sumParams = {};
      if (effectiveFilters.date_from) sumParams.date_from = effectiveFilters.date_from;
      if (effectiveFilters.date_to) sumParams.date_to = effectiveFilters.date_to;
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
      return curRes.data;
    } catch (err) {
      toast({ title: 'Error al cargar Caja', description: err.response?.data?.error || err.message, status: 'error' });
      return null;
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => {
    const init = async () => {
      try {
        const curRes = await api.get('/cash/session/current');
        const openSess = curRes.data.open || null;
        const defaults = defaultSummaryDatesForSession(openSess);
        const initialFilters = {
          date_from: defaults.date_from,
          date_to: defaults.date_to,
          movement_type: '',
          status: '',
          origin_type: '',
          payment_method: '',
          category_id: '',
          search: '',
        };
        filtersInitializedRef.current = true;
        setFilters(initialFilters);
        await loadAll(1, initialFilters);
        await loadPendingIncomes();
      } catch (err) {
        toast({ title: 'Error al cargar Caja', description: err.response?.data?.error || err.message, status: 'error' });
        await loadAll(1);
        await loadPendingIncomes();
      }
    };
    init();
  }, []); // eslint-disable-line
  // reload when filters applied manually via button; initial load done with session-based defaults

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
      loadPendingIncomes();
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Error al registrar ingreso', status: 'error' });
    } finally { setSaving(false); }
  };

  const confirmPending = async (id) => {
    try {
      await api.post(`/cash/movements/${id}/confirm`);
      toast({ title: 'Cobro confirmado', status: 'success' });
      loadAll(pagination.page);
      loadPendingIncomes();
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
      loadPendingIncomes();
    } catch (err) {
      toast({ title: err.response?.data?.error || 'No se pudo anular', status: 'error' });
    }
  };

  const askDelete = (m) => { setDeleteTarget(m); deleteDisc.onOpen(); };
  const doDeleteMovement = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/cash/movements/${deleteTarget.id}`);
      toast({ title: 'Movimiento eliminado', status: 'success' });
      deleteDisc.onClose();
      setDeleteTarget(null);
      loadAll(pagination.page);
      loadPendingIncomes();
    } catch (err) {
      toast({ title: err.response?.data?.error || 'No se pudo eliminar', status: 'error' });
    }
  };

  const openSessionAction = async () => {
    setSaving(true);
    try {
      const openedDate = todayYmd();
      await api.post('/cash/sessions/open', {
        session_date: openedDate,
        opening_balance: Number(openForm.opening_balance || 0),
        notes: openForm.notes || null,
      });
      toast({ title: 'Sesión de caja abierta', status: 'success' });
      openDisc.onClose();
      const newFilters = { ...filters, date_from: openedDate, date_to: openedDate };
      setFilters(newFilters);
      await loadAll(1, newFilters);
      loadPendingIncomes();
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
      const prev = prevDayYmd();
      const newFilters = { ...filters, date_from: prev, date_to: prev };
      setFilters(newFilters);
      await loadAll(1, newFilters);
      loadPendingIncomes();
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

  const cajaAbierta = currentSession?.status === 'abierta';
  const isStaleOpen = currentSession?.status === 'abierta' && String(currentSession.session_date || '').slice(0, 10) < todayYmd();
  const openSessionFromHeader = () => {
    setOpenForm({ session_date: todayYmd(), opening_balance: 0, notes: '' });
    openDisc.onOpen();
  };
  const openSessionDetail = (session) => {
    setSessionDetailTarget(session || null);
    sessionDetailDisc.onOpen();
  };
  const openMovementDetail = (movement) => {
    setMovementDetailTarget(movement || null);
    movementDetailDisc.onOpen();
  };

  return (
    <Box>
      <HStack justify="space-between" mb={6} flexWrap="wrap" gap={3}>
        <HStack spacing={3} align="center" flexWrap="wrap">
          <Heading size="lg" fontWeight="700" letterSpacing="-0.02em">Caja</Heading>
          <Badge colorScheme={cajaAbierta ? 'green' : 'red'} fontSize="sm" px={2} py={1}>
            {cajaAbierta ? 'Abierta' : 'Cerrada'}
          </Badge>
        </HStack>
        <HStack flexWrap="wrap">
          <Button leftIcon={<FiPlus />} variant="outline" onClick={() => incomeDisc.onOpen()} isDisabled={isStaleOpen}>Ingreso manual</Button>
          <Button leftIcon={<FiPlus />} variant="outline" onClick={openSessionFromHeader} isDisabled={cajaAbierta}>Abrir sesión</Button>
          <IconButton aria-label="Actualizar" icon={<FiRefreshCw />} onClick={() => { loadAll(pagination.page); loadPendingIncomes(); }} variant="outline" />
          <Button leftIcon={<FiPlus />} colorScheme="brand" onClick={() => openExpense(null)} isDisabled={isStaleOpen}>Nuevo egreso</Button>
        </HStack>
      </HStack>

      {isStaleOpen && (
        <Card mb={4} borderColor="orange.300" borderWidth="1px">
          <CardBody>
            <HStack justify="space-between" flexWrap="wrap" gap={3}>
              <Box>
                <Text fontWeight="600" color="orange.600">Cierre pendiente de la sesión anterior</Text>
                <Text fontSize="sm" color="fg.muted">
                  Hay una sesión abierta del día {fmtDate(currentSession.session_date)}. Debés cerrarla antes de realizar movimientos.
                </Text>
              </Box>
              <Button colorScheme="orange" onClick={() => closeDisc.onOpen()}>Cerrar sesión anterior</Button>
            </HStack>
          </CardBody>
        </Card>
      )}

      <Tabs colorScheme="brand" onChange={(index) => { if (index === 1) loadPendingIncomes(); }}>
        <TabList overflowX="auto" flexWrap={{ base: 'nowrap', md: 'wrap' }}>
          <Tab>Resumen</Tab>
          <Tab>Ingresos por transferencia</Tab>
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
                <Card bg={bg}><CardBody><Stat><StatLabel>Ingresos por transferencia (cobrados)</StatLabel><StatNumber color="green.500">{money(summary.ingresos_cobrados_transferencia)}</StatNumber></Stat></CardBody></Card>
                <Card bg={bg}><CardBody><Stat><StatLabel>Transferencias pendientes</StatLabel><StatNumber color="orange.500">{money(summary.ingresos_pendientes_transferencia)}</StatNumber><Text fontSize="xs" color="fg.muted">Verif.: {money(summary.pendientes_verificacion_transferencia)}</Text></Stat></CardBody></Card>
                <Card bg={bg}><CardBody><Stat><StatLabel>Egresos</StatLabel><StatNumber color="red.500">{money(summary.egresos_total)}</StatNumber></Stat></CardBody></Card>
                <Card bg={bg}><CardBody><Stat><StatLabel>Saldo neto (cobrados - egresos)</StatLabel><StatNumber color="brand.600">{money(summary.saldo_neto)}</StatNumber></Stat></CardBody></Card>
                <Card bg={bg} gridColumn={{ base: 'auto', lg: 'span 2' }} borderColor="brand.200" borderWidth="1px">
                  <CardBody>
                    <HStack justify="space-between" align="flex-start" flexWrap="wrap" gap={3}>
                      {cashBalance ? (
                        <Stat>
                          <StatLabel>Saldo efectivo que debería haber (sesión {cashBalance.session_status === 'abierta' ? 'abierta' : 'del día'} {fmtDate(cashBalance.session_date)})</StatLabel>
                          <StatNumber color="teal.600">{money(cashBalance.expected_cash)}</StatNumber>
                          <Text fontSize="xs" color="fg.muted" mt={1}>
                            Apertura {money(cashBalance.opening_balance)} + ingresos efectivo cobrados {money(cashBalance.ingresos_efectivo)} − egresos efectivo {money(cashBalance.egresos_efectivo)}
                          </Text>
                        </Stat>
                      ) : cajaAbierta ? (
                        <Box>
                          <Text fontWeight="600">Sesión de caja abierta</Text>
                          <Text fontSize="sm" color="fg.muted">Fecha: {fmtDate(currentSession?.session_date)}</Text>
                        </Box>
                      ) : (
                        <Box>
                          <Text fontWeight="600">Saldo de caja actual</Text>
                          <Text fontSize="sm" color="fg.muted">No hay una sesión de caja abierta.</Text>
                        </Box>
                      )}
                      <Button colorScheme="orange" onClick={() => closeDisc.onOpen()} alignSelf="center" isDisabled={!cajaAbierta}>Cerrar caja</Button>
                    </HStack>
                  </CardBody>
                </Card>
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
              <HStack justify="space-between" flexWrap="wrap" gap={3} mb={4}>
                <Box>
                  <Heading size="sm" mb={1}>Ingresos por transferencia</Heading>
                  <Text fontSize="sm" color="fg.muted">Historial de pagos por transferencia, en cualquier estado. Podés confirmar los que estén pendientes.</Text>
                </Box>
                <HStack spacing={2} flexWrap="wrap">
                  {summary && (
                    <>
                      <Badge colorScheme="orange" px={2} py={1}>Verificación: {money(summary.pendientes_verificacion_transferencia)}</Badge>
                      <Badge colorScheme="gray" px={2} py={1}>Total pendientes: {money(summary.ingresos_pendientes_transferencia)}</Badge>
                    </>
                  )}
                  <IconButton aria-label="Actualizar ingresos pendientes" icon={<FiRefreshCw />} onClick={() => { loadPendingIncomes(); loadAll(pagination.page); }} variant="outline" />
                </HStack>
              </HStack>
              {loadingPending ? <Center py={10}><Spinner /></Center> : pendingIncomes.length === 0 ? (
                <Text color="fg.muted" py={6} textAlign="center">No hay ingresos por transferencia registrados.</Text>
              ) : (
                <TableContainer>
                  <Table size="sm" sx={{ 'th, td': { px: 2, py: 2 }, 'th:last-child, td:last-child': { pr: 1 } }}>
                    <Thead><Tr><Th whiteSpace="nowrap">Fecha</Th><Th>Concepto</Th><Th whiteSpace="nowrap">Estado</Th><Th isNumeric whiteSpace="nowrap">Monto</Th><Th whiteSpace="nowrap">Acciones</Th></Tr></Thead>
                    <Tbody>
                      {pendingIncomes.map((m) => (
                        <Tr key={m.id}>
                          <Td whiteSpace="nowrap">{fmtDate(m.movement_date)}</Td>
                          <Td>
                            <Text fontWeight="500" noOfLines={2}>{m.description}</Text>
                            <Text fontSize="xs" color="fg.muted" noOfLines={1}>{[m.reference, m.counterparty, m.category_name].filter(Boolean).join(' · ')}</Text>
                          </Td>
                          <Td whiteSpace="nowrap"><Badge colorScheme={STATUS_COLOR[m.status] || 'gray'}>{STATUS_LABEL[m.status] || m.status}</Badge></Td>
                          <Td isNumeric whiteSpace="nowrap" fontWeight="600" color="green.600">+{money(m.amount)}</Td>
                          <Td>
                            <HStack spacing={1}>
                              <Tooltip label="Ver detalle" hasArrow>
                                <IconButton aria-label="Ver detalle" icon={<FiEye />} size="sm" variant="ghost" onClick={() => openMovementDetail(m)} />
                              </Tooltip>
                              {['pendiente_verificacion', 'pendiente_cobro'].includes(m.status) && (
                                <Tooltip label="Confirmar cobro" hasArrow>
                                  <IconButton aria-label="Confirmar cobro" icon={<FiCheck />} size="sm" variant="ghost" colorScheme="green" onClick={() => confirmPending(m.id)} />
                                </Tooltip>
                              )}
                            </HStack>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              )}
            </CardBody></Card>
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
                                <IconButton size="sm" aria-label="Eliminar" icon={<FiTrash2 />} colorScheme="red" variant="ghost" onClick={() => askDelete(m)} />
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
              <Button leftIcon={<FiPlus />} colorScheme="brand" size="sm" onClick={() => openExpense(null)} isDisabled={isStaleOpen}>Registrar egreso</Button>
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
            <Card w="full"><CardBody>
              <Heading size="sm" mb={4}>Histórico de cierres</Heading>
              {(() => {
                const closedSessions = sessions.filter((s) => s.status === 'cerrada');
                if (closedSessions.length === 0) {
                  return <Text color="fg.muted">No hay cierres registrados.</Text>;
                }
                return (
                  <TableContainer>
                    <Table size="sm">
                      <Thead><Tr><Th>Fecha</Th><Th isNumeric>Apertura</Th><Th isNumeric>Esperado</Th><Th isNumeric>Contado</Th><Th isNumeric>Diferencia</Th><Th>Cerrada</Th><Th>Detalle</Th></Tr></Thead>
                      <Tbody>
                        {closedSessions.map((s) => (
                          <Tr key={s.id}>
                            <Td>{fmtDate(s.session_date)}</Td>
                            <Td isNumeric>{money(s.opening_balance)}</Td>
                            <Td isNumeric>{s.expected_cash != null ? money(s.expected_cash) : '-'}</Td>
                            <Td isNumeric>{s.counted_cash != null ? money(s.counted_cash) : '-'}</Td>
                            <Td isNumeric color={s.difference != null ? (Number(s.difference) === 0 ? 'green.500' : 'orange.500') : undefined}>{s.difference != null ? money(s.difference) : '-'}</Td>
                            <Td>{fmtDateTime(s.closed_at)}</Td>
                            <Td><Button size="xs" variant="outline" onClick={() => openSessionDetail(s)}>Ver más detalle</Button></Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                );
              })()}
            </CardBody></Card>
          </TabPanel>
        </TabPanels>
      </Tabs>

      {/* Abrir sesión */}
      <Modal isOpen={openDisc.isOpen} onClose={openDisc.onClose}>
        <ModalOverlay /><ModalContent>
          <ModalHeader>Abrir sesión de caja</ModalHeader><ModalCloseButton />
          <ModalBody>
            <VStack spacing={3}>
              <FormControl><FormLabel>Fecha</FormLabel><Input type="date" value={todayYmd()} isReadOnly /></FormControl>
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

      {/* Detalle de sesión/cierre */}
      <Modal isOpen={sessionDetailDisc.isOpen} onClose={() => { sessionDetailDisc.onClose(); setSessionDetailTarget(null); }} size="lg">
        <ModalOverlay /><ModalContent>
          <ModalHeader>Detalle de sesión / cierre</ModalHeader><ModalCloseButton />
          <ModalBody>
            {sessionDetailTarget ? (() => {
              const s = sessionDetailTarget;
              const snap = typeof s.totals_snapshot === 'string' ? (() => { try { return JSON.parse(s.totals_snapshot); } catch { return null; } })() : (s.totals_snapshot || null);
              const state = s.cash_state || (snap ? {
                opening_balance: s.opening_balance,
                ingresos_efectivo: snap.ingresos_efectivo,
                egresos_efectivo: snap.egresos_efectivo,
                ingresos_cobrados: snap.ingresos_cobrados,
                ingresos_pendientes: snap.ingresos_pendientes,
                egresos_total: snap.egresos_total,
                expected_cash: s.expected_cash ?? snap.expected_cash,
              } : null);
              return (
                <VStack align="stretch" spacing={3}>
                  <HStack justify="space-between"><Text>Fecha</Text><Text fontWeight="600">{fmtDate(s.session_date)}</Text></HStack>
                  <HStack justify="space-between"><Text>Estado</Text><Badge colorScheme={s.status === 'abierta' ? 'green' : 'gray'}>{s.status}</Badge></HStack>
                  <HStack justify="space-between"><Text>Saldo inicial</Text><Text>{money(s.opening_balance)}</Text></HStack>
                  {state && (
                    <>
                      <Divider />
                      <Heading size="xs">Movimientos / efectivo</Heading>
                      <HStack justify="space-between"><Text>Ingresos en efectivo (cobrados)</Text><Text>{money(state.ingresos_efectivo)}</Text></HStack>
                      <HStack justify="space-between"><Text>Egresos en efectivo</Text><Text>{money(state.egresos_efectivo)}</Text></HStack>
                      <HStack justify="space-between"><Text fontWeight="600">Efectivo esperado</Text><Text fontWeight="700">{money(state.expected_cash)}</Text></HStack>
                      {(state.ingresos_cobrados != null || state.ingresos_pendientes != null || state.egresos_total != null) && (
                        <>
                          <Divider />
                          <Heading size="xs">Totales del período/sesión</Heading>
                          {state.ingresos_cobrados != null && <HStack justify="space-between"><Text>Ingresos cobrados</Text><Text>{money(state.ingresos_cobrados)}</Text></HStack>}
                          {state.ingresos_pendientes != null && <HStack justify="space-between"><Text>Ingresos pendientes</Text><Text>{money(state.ingresos_pendientes)}</Text></HStack>}
                          {state.egresos_total != null && <HStack justify="space-between"><Text>Egresos totales</Text><Text>{money(state.egresos_total)}</Text></HStack>}
                        </>
                      )}
                    </>
                  )}
                  {s.status === 'cerrada' && (
                    <>
                      <Divider />
                      <Heading size="xs">Cierre</Heading>
                      <HStack justify="space-between"><Text>Efectivo contado</Text><Text>{money(s.counted_cash)}</Text></HStack>
                      <HStack justify="space-between"><Text>Diferencia</Text><Text fontWeight="700" color={Number(s.difference) === 0 ? 'green.500' : 'orange.500'}>{money(s.difference)}</Text></HStack>
                      <HStack justify="space-between"><Text>Cerrada</Text><Text>{fmtDateTime(s.closed_at)}</Text></HStack>
                    </>
                  )}
                  {s.notes && (<><Divider /><Text fontSize="sm"><strong>Notas:</strong> {s.notes}</Text></>)}
                </VStack>
              );
            })() : <Text color="fg.muted">Sin datos.</Text>}
          </ModalBody>
          <ModalFooter><Button onClick={() => { sessionDetailDisc.onClose(); setSessionDetailTarget(null); }}>Cerrar</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Detalle de movimiento */}
      <Modal isOpen={movementDetailDisc.isOpen} onClose={() => { movementDetailDisc.onClose(); setMovementDetailTarget(null); }} size="lg">
        <ModalOverlay /><ModalContent>
          <ModalHeader>Detalle de ingreso</ModalHeader><ModalCloseButton />
          <ModalBody>
            {movementDetailTarget ? (() => {
              const m = movementDetailTarget;
              const rows = [
                ['Fecha', fmtDate(m.movement_date)],
                ['Tipo', m.movement_type === 'ingreso' ? 'Ingreso' : m.movement_type === 'egreso' ? 'Egreso' : m.movement_type],
                ['Estado', STATUS_LABEL[m.status] || m.status],
                ['Origen', `${ORIGIN_LABEL[m.origin_type] || m.origin_type}${m.origin_id ? ` #${m.origin_id}` : ''}`],
                ['Descripción', m.description || '—'],
                ['Medio de pago', PM_LABEL[m.payment_method] || m.payment_method || '—'],
                ['Monto', money(m.amount)],
                ['Categoría', m.category_name || '—'],
                ['Referencia', m.reference || '—'],
                ['Contraparte', m.counterparty || '—'],
                ['Sesión de caja', m.cash_session_id ? `#${m.cash_session_id}` : '—'],
                ['Acreditado', m.accredited_at ? fmtDateTime(m.accredited_at) : '—'],
                ['Anulado', m.voided_at ? fmtDateTime(m.voided_at) : '—'],
                ['Motivo anulación', m.void_reason || '—'],
                ['Notas', m.notes || '—'],
              ];
              return (
                <VStack align="stretch" spacing={2}>
                  {rows.map(([label, value]) => (
                    <HStack key={label} justify="space-between" align="start">
                      <Text fontSize="sm" color="fg.muted">{label}</Text>
                      <Text fontSize="sm" fontWeight="500" textAlign="right" maxW="70%">{value}</Text>
                    </HStack>
                  ))}
                </VStack>
              );
            })() : <Text color="fg.muted">Sin datos.</Text>}
          </ModalBody>
          <ModalFooter><Button onClick={() => { movementDetailDisc.onClose(); setMovementDetailTarget(null); }}>Cerrar</Button></ModalFooter>
        </ModalContent>
      </Modal>

      {/* Eliminar egreso manual */}
      <Modal isOpen={deleteDisc.isOpen} onClose={() => { deleteDisc.onClose(); setDeleteTarget(null); }}>
        <ModalOverlay /><ModalContent>
          <ModalHeader>Eliminar egreso manual</ModalHeader><ModalCloseButton />
          <ModalBody>
            <Text fontSize="sm">¿Eliminar este egreso manual? Esta acción no se puede deshacer.</Text>
            {deleteTarget?.description && <Text fontSize="sm" color="fg.muted" mt={2}>{deleteTarget.description} — {money(deleteTarget.amount)}</Text>}
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={() => { deleteDisc.onClose(); setDeleteTarget(null); }}>Cancelar</Button>
            <Button colorScheme="red" onClick={doDeleteMovement}>Eliminar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
