import {
  Badge, Box, Button, Card, CardBody, Center, Container, Divider, FormControl, FormLabel,
  Grid, GridItem, Heading, HStack, IconButton, Input, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Spinner, Table,
  TableContainer, Tbody, Td, Text, Textarea, Th, Thead, Tr, VStack, useDisclosure, useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiDownload, FiEdit2, FiEye, FiFileText, FiPlus, FiRefreshCw, FiSearch, FiTrash2, FiXCircle, FiCheckCircle } from 'react-icons/fi';
import api from '../api/client';
import EmptyState from '../components/EmptyState';

const STATUS_COLOR = { borrador: 'yellow', emitida: 'green', anulada: 'red' };
const STATUS_LABEL = { borrador: 'Borrador', emitida: 'Emitida', anulada: 'Anulada' };
const ARCA_STATUS_COLOR = { pending: 'yellow', approved: 'green', rejected: 'red' };
const ARCA_STATUS_LABEL = { pending: 'Pendiente', approved: 'Aprobada', rejected: 'Rechazada' };
const DOC_TIPOS = [
  { value: 80, label: 'CUIT (80)' },
  { value: 96, label: 'DNI (96)' },
  { value: 99, label: 'Consumidor Final (99)' },
];
const COND_IVA = [
  { value: 1, label: 'IVA Responsable Inscripto' },
  { value: 4, label: 'IVA Sujeto Exento' },
  { value: 5, label: 'Consumidor Final' },
  { value: 6, label: 'Responsable Monotributo' },
  { value: 13, label: 'Monotributista Social' },
  { value: 15, label: 'IVA No Alcanzado' },
  { value: 16, label: 'Monotributista Trab. Indep. Promovido' },
];

function round2(n) { return Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100; }
function money(n) { return `$ ${round2(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(d) { if (!d) return '-'; const dt = new Date(d); return Number.isNaN(dt.getTime()) ? String(d) : dt.toLocaleString('es-AR'); }

const emptyReceiver = { name: '', doc_type: '', doc_number: '', condicion_iva: '', address: '', email: '', phone: '' };
const emptyItem = () => ({ source_type: 'manual', product_id: null, repair_id: null, description: '', quantity: 1, unit_price: 0, vat_rate: 21, discount: 0 });

function calcItem(it) {
  const qty = round2(it.quantity || 0);
  const price = round2(it.unit_price || 0);
  const discount = round2(it.discount || 0);
  const subtotal = round2(qty * price - discount);
  const vat = round2(subtotal * (Number(it.vat_rate || 0) / 100));
  return { ...it, line_subtotal: subtotal, vat_amount: vat, line_total: round2(subtotal + vat) };
}
function calcTotals(items) {
  const list = items.map(calcItem);
  return {
    subtotal: round2(list.reduce((a, i) => a + i.line_subtotal, 0)),
    tax_total: round2(list.reduce((a, i) => a + i.vat_amount, 0)),
    discount_total: round2(list.reduce((a, i) => a + Number(i.discount || 0), 0)),
    total: round2(list.reduce((a, i) => a + i.line_total, 0)),
  };
}

export default function Invoicing() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const preloadHandledRef = useRef(false);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [selected, setSelected] = useState(null);
  const detailDisc = useDisclosure();
  const formDisc = useDisclosure();
  const voidDisc = useDisclosure();
  const arcaDisc = useDisclosure();
  const [voidReason, setVoidReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [arcaForm, setArcaForm] = useState({ cbte_tipo: 6, concepto: 1, docTipo: 99, docNro: '0', condIva: 5, servicio: { desde: '', hasta: '', vtoPago: '' } });
  const [arcaLoading, setArcaLoading] = useState(false);

  // form state
  const [editingId, setEditingId] = useState(null);
  const [receiver, setReceiver] = useState({ ...emptyReceiver });
  const [items, setItems] = useState([emptyItem()]);
  const [notes, setNotes] = useState('');
  const [billingClientId, setBillingClientId] = useState(null);
  const [fiscalForm, setFiscalForm] = useState({ cbte_tipo: 6, concepto: 1, docTipo: 99, docNro: '0', condIva: 5 });

  const inferFiscalFromReceiver = (r, prev = {}) => {
    const docNum = String(r?.doc_number || r?.docNro || '').replace(/\D/g, '');
    let docTipo = prev.docTipo || 99;
    if (docNum.length === 11) docTipo = 80;
    else if (docNum.length >= 7 && docNum.length <= 8) docTipo = 96;
    else if (!docNum) docTipo = 99;
    const docNro = docTipo === 99 ? '0' : (docNum || prev.docNro || '0');
    const txt = String(r?.condicion_iva || '').toLowerCase();
    let condIva = prev.condIva || 5;
    if (txt.includes('inscripto') && !txt.includes('no')) condIva = 1;
    else if (txt.includes('monotrib')) condIva = 6;
    else if (txt.includes('exento')) condIva = 4;
    else if (txt.includes('consumidor') || txt.includes('final')) condIva = 5;
    let cbte_tipo = prev.cbte_tipo || 6;
    if (condIva === 1) cbte_tipo = 1;
    else if (cbte_tipo === 1 && ![1, 6, 13, 16].includes(condIva)) cbte_tipo = 6;
    return { ...prev, cbte_tipo, docTipo, docNro, condIva };
  };

  // search helpers
  const [clientSearch, setClientSearch] = useState('');
  const [clientOptions, setClientOptions] = useState({ repair_clients: [], online_clients: [], billing: [] });
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [repairSearch, setRepairSearch] = useState('');
  const [repairResults, setRepairResults] = useState([]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      const { data } = await api.get('/invoices', { params });
      setInvoices(data.invoices || []);
    } catch (err) {
      toast({ title: 'Error al cargar facturas', status: 'error' });
    } finally {
      setLoading(false);
    }
  }, [filters, toast]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const totals = useMemo(() => calcTotals(items), [items]);

  const openNew = () => {
    setEditingId(null);
    setReceiver({ ...emptyReceiver });
    setItems([emptyItem()]);
    setNotes('');
    setBillingClientId(null);
    setFiscalForm({ cbte_tipo: 6, concepto: 1, docTipo: 99, docNro: '0', condIva: 5 });
    formDisc.onOpen();
  };

  const openEdit = async (inv) => {
    try {
      const { data } = await api.get(`/invoices/${inv.id}`);
      const invoice = data.invoice;
      setEditingId(invoice.id);
      const rs = invoice.receiver_snapshot || { ...emptyReceiver };
      setReceiver(rs);
      setItems((invoice.items || []).map((it) => ({
        source_type: it.source_type, product_id: it.product_id, repair_id: it.repair_id,
        description: it.description, quantity: Number(it.quantity), unit_price: Number(it.unit_price),
        vat_rate: Number(it.vat_rate), discount: Number(it.discount || 0), metadata: it.metadata,
      })));
      setNotes(invoice.notes || '');
      setBillingClientId(invoice.billing_client_id || null);
      setFiscalForm(inferFiscalFromReceiver(rs, {
        cbte_tipo: invoice.cbte_tipo || 6,
        concepto: invoice.concepto || 1,
        docTipo: invoice.receptor_doc_tipo || 99,
        docNro: invoice.receptor_doc_nro || rs.doc_number || '0',
        condIva: invoice.receptor_condicion_iva_id || 5,
      }));
      formDisc.onOpen();
    } catch { toast({ title: 'No se pudo cargar la factura', status: 'error' }); }
  };

  const openDetail = async (inv) => {
    try {
      const { data } = await api.get(`/invoices/${inv.id}`);
      setSelected(data.invoice);
      const rs = data.invoice.receiver_snapshot || {};
      setArcaForm({
        cbte_tipo: data.invoice.cbte_tipo || 6,
        concepto: data.invoice.concepto || 1,
        docTipo: data.invoice.receptor_doc_tipo || (rs.doc_number?.replace(/\D/g, '').length === 11 ? 80 : (rs.doc_number ? 96 : 99)),
        docNro: data.invoice.receptor_doc_nro || rs.doc_number || '0',
        condIva: data.invoice.receptor_condicion_iva_id || 5,
        servicio: { desde: '', hasta: '', vtoPago: '' },
      });
      detailDisc.onOpen();
    } catch { toast({ title: 'No se pudo cargar el detalle', status: 'error' }); }
  };

  const saveDraft = async (issueAfter = false) => {
    if (!receiver.name?.trim()) return toast({ title: 'Ingresá el nombre del receptor', status: 'warning' });
    if (!items.length || !items.some((i) => i.description?.trim())) return toast({ title: 'Agregá al menos un ítem con descripción', status: 'warning' });
    setSaving(true);
    try {
      const payload = {
        billing_client_id: billingClientId,
        receiver_snapshot: receiver,
        notes,
        items: items.map(calcItem).map((i) => ({
          source_type: i.source_type, product_id: i.product_id, repair_id: i.repair_id,
          description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price),
          vat_rate: Number(i.vat_rate), discount: Number(i.discount || 0), metadata: i.metadata || null,
        })),
      };
      let id = editingId;
      if (editingId) {
        await api.put(`/invoices/${editingId}`, payload);
      } else {
        const { data } = await api.post('/invoices', payload);
        id = data.invoice.id;
        setEditingId(id);
      }
      if (issueAfter && id) {
        const fiscal = inferFiscalFromReceiver(receiver, fiscalForm);
        try {
          const { data } = await api.post(`/invoices/${id}/arca-authorize`, {
            cbte_tipo: Number(fiscal.cbte_tipo || 6),
            concepto: Number(fiscal.concepto || 1),
            receptor: {
              docTipo: Number(fiscal.docTipo || 99),
              docNro: String(fiscal.docNro || (Number(fiscal.docTipo) === 99 ? '0' : '')),
              condIva: Number(fiscal.condIva || 5),
              name: receiver.name || '',
              address: receiver.address || '',
            },
          });
          toast({ title: data.message || 'Comprobante autorizado por ARCA', status: 'success', description: data.arca?.cae ? `CAE: ${data.arca.cae}` : undefined });
          formDisc.onClose();
        } catch (err) {
          const details = err.response?.data?.details;
          toast({
            title: 'Borrador guardado, pero no se pudo autorizar en ARCA',
            description: err.response?.data?.error || (Array.isArray(details) ? details.join(' | ') : details) || 'Podés reintentar desde el detalle (Autorizar ARCA).',
            status: 'warning',
            duration: 9000,
          });
          // queda guardado para reintento manual
          formDisc.onClose();
          try { await openDetail({ id }); } catch (_) {}
        }
      } else {
        toast({ title: 'Borrador guardado', status: 'success' });
      }
      loadInvoices();
    } catch (err) {
      toast({ title: err.response?.data?.error || 'Error al guardar', status: 'error' });
    } finally { setSaving(false); }
  };

  const issueInvoice = async (id) => {
    try {
      await api.post(`/invoices/${id}/issue`);
      toast({ title: 'Factura emitida', status: 'success' });
      loadInvoices(); detailDisc.onClose();
    } catch (err) { toast({ title: err.response?.data?.error || 'Error al emitir', status: 'error' }); }
  };

  const confirmVoid = async () => {
    if (!selected) return;
    try {
      await api.post(`/invoices/${selected.id}/void`, { reason: voidReason });
      toast({ title: 'Factura anulada', status: 'success' });
      setVoidReason(''); voidDisc.onClose(); detailDisc.onClose(); loadInvoices();
    } catch (err) { toast({ title: err.response?.data?.error || 'Error al anular', status: 'error' }); }
  };

  const authorizeArca = async () => {
    if (!selected) return;
    setArcaLoading(true);
    try {
      const payload = {
        cbte_tipo: Number(arcaForm.cbte_tipo),
        concepto: Number(arcaForm.concepto),
        receptor: {
          docTipo: Number(arcaForm.docTipo),
          docNro: String(arcaForm.docNro || '0'),
          condIva: Number(arcaForm.condIva),
          name: selected.receiver_snapshot?.name || '',
          address: selected.receiver_snapshot?.address || '',
        },
      };
      if (Number(arcaForm.concepto) !== 1) payload.servicio = arcaForm.servicio;
      const { data } = await api.post(`/invoices/${selected.id}/arca-authorize`, payload);
      toast({ title: data.message || 'Comprobante autorizado', status: 'success', description: data.arca?.cae ? `CAE: ${data.arca.cae}` : undefined });
      arcaDisc.onClose();
      await openDetail({ id: selected.id });
      loadInvoices();
    } catch (err) {
      const details = err.response?.data?.details;
      toast({ title: err.response?.data?.error || 'Error al autorizar en ARCA', description: Array.isArray(details) ? details.join(' | ') : details, status: 'error', duration: 8000 });
    } finally { setArcaLoading(false); }
  };

  const removeInvoice = async (id) => {
    if (!window.confirm('¿Eliminar este borrador?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast({ title: 'Borrador eliminado', status: 'success' });
      loadInvoices();
    } catch (err) { toast({ title: err.response?.data?.error || 'Error al eliminar', status: 'error' }); }
  };

  const downloadPdf = async (id, number) => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      window.open(url, '_blank');
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
    } catch { toast({ title: 'No se pudo generar el PDF', status: 'error' }); }
  };

  const searchClientSources = async () => {
    try {
      const [src, bill] = await Promise.all([
        api.get('/billing-clients/sources', { params: { search: clientSearch } }),
        api.get('/billing-clients', { params: { search: clientSearch } }),
      ]);
      setClientOptions({ ...(src.data || {}), billing: bill.data?.clients || [] });
    } catch { toast({ title: 'Error al buscar clientes', status: 'error' }); }
  };

  const applyReceiver = (data, id = null) => {
    const next = {
      name: data.name || '', doc_type: data.doc_type || '', doc_number: data.doc_number || data.dni || '',
      condicion_iva: data.condicion_iva || '', address: data.address || '', email: data.email || '', phone: data.phone || '',
    };
    setReceiver(next);
    setBillingClientId(id);
    setFiscalForm((prev) => inferFiscalFromReceiver(next, prev));
  };

  const searchProducts = async () => {
    try {
      const { data } = await api.get('/products', { params: { search: productSearch, limit: 20 } });
      setProductResults(data.products || []);
    } catch { toast({ title: 'Error al buscar productos', status: 'error' }); }
  };

  const addProductItem = async (id) => {
    try {
      const { data } = await api.get(`/invoices/preload/product/${id}`);
      setItems((prev) => [...prev.filter((i) => i.description?.trim() || prev.length === 1), data.item]);
    } catch { toast({ title: 'No se pudo agregar el producto', status: 'error' }); }
  };

  const searchRepairs = async () => {
    try {
      const { data } = await api.get('/technical-repairs', { params: { search: repairSearch, limit: 20 } });
      setRepairResults(data.repairs || []);
    } catch { toast({ title: 'Error al buscar reparaciones', status: 'error' }); }
  };

  const addRepairItems = async (id) => {
    try {
      const { data } = await api.get(`/invoices/preload/repair/${id}`);
      setItems((prev) => [...prev.filter((i) => i.description?.trim() || prev.length === 1), ...(data.items || [])]);
      if (data.receiver?.name) {
        setReceiver((r) => ({ ...r, ...Object.fromEntries(Object.entries(data.receiver).filter(([, v]) => v)) }));
      }
      return data;
    } catch {
      toast({ title: 'No se pudo precargar la reparación', status: 'error' });
      return null;
    }
  };

  useEffect(() => {
    const repairId = searchParams.get('preloadRepair');
    if (!repairId || preloadHandledRef.current) return;
    preloadHandledRef.current = true;
    (async () => {
      openNew();
      const data = await addRepairItems(repairId);
      if (data?.receiver) {
        const next = {
          name: data.receiver.name || '', doc_type: data.receiver.doc_type || '', doc_number: data.receiver.doc_number || '',
          condicion_iva: data.receiver.condicion_iva || '', address: data.receiver.address || '', email: data.receiver.email || '',
          phone: data.receiver.phone || '',
        };
        setReceiver((prev) => ({ ...prev, ...next }));
        setFiscalForm((prev) => inferFiscalFromReceiver(next, prev));
      }
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete('preloadRepair');
      setSearchParams(nextParams, { replace: true });
    })();
  }, [searchParams, setSearchParams]);

  const updateItem = (idx, field, value) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  };
  const removeItem = (idx) => setItems((prev) => (prev.length === 1 ? [emptyItem()] : prev.filter((_, i) => i !== idx)));

  return (
    <Container maxW="7xl" py={8}>
      <HStack justify="space-between" mb={6} flexWrap="wrap" gap={3}>
        <VStack align="start" spacing={0}>
          <Heading size="lg">Facturación</Heading>
          <Text color="fg.muted">Comprobantes de venta (ARS)</Text>
        </VStack>
        <HStack>
          <IconButton icon={<FiRefreshCw />} aria-label="Actualizar" onClick={loadInvoices} variant="outline" />
          <Button leftIcon={<FiPlus />} colorScheme="brand" onClick={openNew}>Nueva factura</Button>
        </HStack>
      </HStack>

      <Card mb={4}><CardBody>
        <HStack spacing={3} flexWrap="wrap">
          <Input placeholder="Buscar por Nº o cliente" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} maxW="320px" />
          <Select placeholder="Todos los estados" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} maxW="220px">
            <option value="borrador">Borrador</option>
            <option value="emitida">Emitida</option>
            <option value="anulada">Anulada</option>
          </Select>
          <Button leftIcon={<FiSearch />} onClick={loadInvoices}>Filtrar</Button>
        </HStack>
      </CardBody></Card>

      <Card>
        <CardBody>
          {loading ? <Center py={10}><Spinner /></Center> : invoices.length === 0 ? (
            <EmptyState icon={FiFileText} title="Sin facturas" description="Creá tu primera factura." />
          ) : (
            <TableContainer>
              <Table size="sm">
                <Thead><Tr>
                  <Th>Nº</Th><Th>Fiscal</Th><Th>Fecha</Th><Th>Cliente</Th><Th>Estado</Th><Th>ARCA</Th><Th isNumeric>Total</Th><Th>Acciones</Th>
                </Tr></Thead>
                <Tbody>
                  {invoices.map((inv) => (
                    <Tr key={inv.id}>
                      <Td fontWeight="semibold">{inv.number}</Td>
                      <Td>{inv.cbte_numero ? `${String(inv.pto_vta || 0).padStart(4,'0')}-${String(inv.cbte_numero).padStart(8,'0')}` : '-'}</Td>
                      <Td>{fmtDate(inv.created_at)}</Td>
                      <Td>{inv.billing_client_name || inv.receiver_snapshot?.name || '-'}</Td>
                      <Td><Badge colorScheme={STATUS_COLOR[inv.status]}>{STATUS_LABEL[inv.status] || inv.status}</Badge></Td>
                      <Td>
                        {inv.arca_status ? (
                          <VStack align="start" spacing={0}>
                            <Badge colorScheme={ARCA_STATUS_COLOR[inv.arca_status]}>{ARCA_STATUS_LABEL[inv.arca_status] || inv.arca_status}</Badge>
                            {inv.arca_cae && <Text fontSize="xs" color="fg.muted">CAE: {inv.arca_cae}</Text>}
                          </VStack>
                        ) : <Text color="fg.muted">-</Text>}
                      </Td>
                      <Td isNumeric>{money(inv.total)}</Td>
                      <Td>
                        <HStack spacing={1}>
                          <IconButton size="sm" icon={<FiEye />} aria-label="Ver" onClick={() => openDetail(inv)} />
                          {inv.status === 'borrador' && <IconButton size="sm" icon={<FiEdit2 />} aria-label="Editar" onClick={() => openEdit(inv)} />}
                          <IconButton size="sm" icon={<FiDownload />} aria-label="PDF" onClick={() => downloadPdf(inv.id, inv.number)} />
                          {inv.status === 'borrador' && <IconButton size="sm" icon={<FiTrash2 />} aria-label="Eliminar" colorScheme="red" variant="ghost" onClick={() => removeInvoice(inv.id)} />}
                        </HStack>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableContainer>
          )}
        </CardBody>
      </Card>

      {/* Detalle */}
      <Modal isOpen={detailDisc.isOpen} onClose={detailDisc.onClose} size="4xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Factura {selected?.number}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {selected && (
              <VStack align="stretch" spacing={4}>
                <HStack justify="space-between" flexWrap="wrap" gap={2}>
                  <HStack>
                    <Badge colorScheme={STATUS_COLOR[selected.status]} fontSize="md">{STATUS_LABEL[selected.status]}</Badge>
                    {selected.arca_status && <Badge colorScheme={ARCA_STATUS_COLOR[selected.arca_status]}>ARCA: {ARCA_STATUS_LABEL[selected.arca_status] || selected.arca_status}</Badge>}
                  </HStack>
                  <Text color="fg.muted">{fmtDate(selected.cbte_fecha || selected.issued_at || selected.created_at)}</Text>
                </HStack>
                {selected.arca_status && (
                  <Box p={3} borderWidth="1px" borderRadius="md">
                    <Text fontWeight="semibold" mb={1}>Datos fiscales electrónicos (ARCA)</Text>
                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={2} fontSize="sm">
                      <Text>Tipo: {selected.cbte_tipo === 1 ? 'Factura A (1)' : selected.cbte_tipo === 6 ? 'Factura B (6)' : (selected.cbte_tipo || '-')}</Text>
                      <Text>Pto. Vta.: {selected.pto_vta || '-'}</Text>
                      <Text>Nº fiscal: {selected.cbte_numero ? `${String(selected.pto_vta || 0).padStart(4,'0')}-${String(selected.cbte_numero).padStart(8,'0')}` : '-'}</Text>
                      <Text>Concepto: {selected.concepto || 1}</Text>
                      <Text>CAE: {selected.arca_cae || '-'}</Text>
                      <Text>Vto. CAE: {selected.arca_cae_vto ? fmtDate(selected.arca_cae_vto) : '-'}</Text>
                    </SimpleGrid>
                    {selected.arca_errors && <Text mt={2} color="red.500" fontSize="sm">Error: {selected.arca_errors}</Text>}
                  </Box>
                )}
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <Box><Text fontWeight="semibold">Emisor</Text><Text fontSize="sm">{selected.issuer_snapshot?.razon_social || '-'}</Text><Text fontSize="sm">CUIT: {selected.issuer_snapshot?.cuit || '-'}</Text></Box>
                  <Box><Text fontWeight="semibold">Receptor</Text><Text fontSize="sm">{selected.receiver_snapshot?.name || '-'}</Text><Text fontSize="sm">{selected.receiver_snapshot?.doc_type} {selected.receiver_snapshot?.doc_number}</Text></Box>
                </SimpleGrid>
                <TableContainer>
                  <Table size="sm"><Thead><Tr><Th>Descripción</Th><Th isNumeric>Cant.</Th><Th isNumeric>P. Unit.</Th><Th isNumeric>IVA %</Th><Th isNumeric>Total</Th></Tr></Thead>
                    <Tbody>
                      {(selected.items || []).map((it) => (
                        <Tr key={it.id}><Td>{it.description}</Td><Td isNumeric>{it.quantity}</Td><Td isNumeric>{money(it.unit_price)}</Td><Td isNumeric>{it.vat_rate}%</Td><Td isNumeric>{money(it.line_total)}</Td></Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
                <Box alignSelf="flex-end" minW="240px">
                  <HStack justify="space-between"><Text>Subtotal</Text><Text>{money(selected.subtotal)}</Text></HStack>
                  <HStack justify="space-between"><Text>IVA</Text><Text>{money(selected.tax_total)}</Text></HStack>
                  <Divider my={1} />
                  <HStack justify="space-between"><Text fontWeight="bold">Total</Text><Text fontWeight="bold">{money(selected.total)}</Text></HStack>
                </Box>
                {selected.notes && <Text fontSize="sm" color="fg.muted">Notas: {selected.notes}</Text>}
                {selected.status === 'anulada' && <Text color="red.500" fontSize="sm">Anulada: {selected.void_reason || 'sin motivo'} ({fmtDate(selected.voided_at)})</Text>}
              </VStack>
            )}
          </ModalBody>
          <ModalFooter>
            <HStack spacing={2} flexWrap="wrap">
              {selected && <Button leftIcon={<FiDownload />} onClick={() => downloadPdf(selected.id, selected.number)}>PDF</Button>}
              {selected?.status === 'borrador' && <Button colorScheme="green" leftIcon={<FiCheckCircle />} onClick={() => issueInvoice(selected.id)}>Emitir (interna)</Button>}
              {selected?.status === 'borrador' && <Button leftIcon={<FiEdit2 />} onClick={() => { detailDisc.onClose(); openEdit(selected); }}>Editar</Button>}
              {selected && selected.status !== 'anulada' && selected.arca_status !== 'approved' && (
                <Button colorScheme="blue" onClick={() => arcaDisc.onOpen()}>Autorizar ARCA</Button>
              )}
              {selected?.status === 'emitida' && <Button colorScheme="red" variant="outline" leftIcon={<FiXCircle />} onClick={() => voidDisc.onOpen()}>Anular</Button>}
              <Button variant="ghost" onClick={detailDisc.onClose}>Cerrar</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Anular */}
      <Modal isOpen={voidDisc.isOpen} onClose={voidDisc.onClose}>
        <ModalOverlay /><ModalContent>
          <ModalHeader>Anular factura</ModalHeader><ModalCloseButton />
          <ModalBody>
            <FormControl>
              <FormLabel>Motivo (opcional)</FormLabel>
              <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={voidDisc.onClose}>Cancelar</Button>
            <Button colorScheme="red" onClick={confirmVoid}>Anular</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Autorizar ARCA */}
      <Modal isOpen={arcaDisc.isOpen} onClose={arcaDisc.onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Autorizar comprobante en ARCA</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <Text fontSize="sm" color="fg.muted">Se solicitará CAE en homologación/producción según configuración. Requiere CUIT emisor, punto de venta y certificados configurados.</Text>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                <FormControl>
                  <FormLabel>Tipo comprobante</FormLabel>
                  <Select value={arcaForm.cbte_tipo} onChange={(e) => setArcaForm({ ...arcaForm, cbte_tipo: Number(e.target.value) })}>
                    <option value={6}>Factura B (6)</option>
                    <option value={1}>Factura A (1)</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Concepto</FormLabel>
                  <Select value={arcaForm.concepto} onChange={(e) => setArcaForm({ ...arcaForm, concepto: Number(e.target.value) })}>
                    <option value={1}>Productos (1)</option>
                    <option value={2}>Servicios (2)</option>
                    <option value={3}>Productos y servicios (3)</option>
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Tipo documento receptor</FormLabel>
                  <Select value={arcaForm.docTipo} onChange={(e) => {
                    const v = Number(e.target.value);
                    setArcaForm({ ...arcaForm, docTipo: v, docNro: v === 99 ? '0' : arcaForm.docNro });
                  }}>
                    {DOC_TIPOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </Select>
                </FormControl>
                <FormControl>
                  <FormLabel>Nº documento</FormLabel>
                  <Input value={arcaForm.docNro} onChange={(e) => setArcaForm({ ...arcaForm, docNro: e.target.value })} isDisabled={Number(arcaForm.docTipo) === 99} />
                </FormControl>
                <FormControl gridColumn={{ md: 'span 2' }}>
                  <FormLabel>Condición IVA receptor (ARCA)</FormLabel>
                  <Select value={arcaForm.condIva} onChange={(e) => setArcaForm({ ...arcaForm, condIva: Number(e.target.value) })}>
                    {COND_IVA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </Select>
                </FormControl>
              </SimpleGrid>
              {Number(arcaForm.concepto) !== 1 && (
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <FormControl isRequired><FormLabel>Servicio desde</FormLabel><Input type="date" value={arcaForm.servicio.desde} onChange={(e) => setArcaForm({ ...arcaForm, servicio: { ...arcaForm.servicio, desde: e.target.value } })} /></FormControl>
                  <FormControl isRequired><FormLabel>Servicio hasta</FormLabel><Input type="date" value={arcaForm.servicio.hasta} onChange={(e) => setArcaForm({ ...arcaForm, servicio: { ...arcaForm.servicio, hasta: e.target.value } })} /></FormControl>
                  <FormControl isRequired><FormLabel>Vto. pago</FormLabel><Input type="date" value={arcaForm.servicio.vtoPago} onChange={(e) => setArcaForm({ ...arcaForm, servicio: { ...arcaForm.servicio, vtoPago: e.target.value } })} /></FormControl>
                </SimpleGrid>
              )}
              {selected?.arca_status === 'rejected' && selected?.arca_errors && (
                <Box p={2} bg="red.50" _dark={{ bg: 'red.900' }} borderRadius="md">
                  <Text fontSize="sm" color="red.600">Último rechazo: {selected.arca_errors}</Text>
                </Box>
              )}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={arcaDisc.onClose}>Cancelar</Button>
            <Button colorScheme="blue" onClick={authorizeArca} isLoading={arcaLoading}>Solicitar CAE</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Formulario borrador */}
      <Modal isOpen={formDisc.isOpen} onClose={formDisc.onClose} size="6xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editingId ? 'Editar borrador' : 'Nueva factura'}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={5}>
              <Card variant="outline"><CardBody>
                <Heading size="sm" mb={3}>Receptor (cliente de facturación)</Heading>
                <HStack mb={3} flexWrap="wrap">
                  <Input placeholder="Buscar cliente (facturación, reparación u online)" value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} maxW="420px" />
                  <Button onClick={searchClientSources} leftIcon={<FiSearch />}>Buscar</Button>
                  <Button variant="outline" onClick={() => { setReceiver({ ...emptyReceiver }); setBillingClientId(null); }}>Limpiar</Button>
                </HStack>
                {(clientOptions.billing?.length || clientOptions.repair_clients?.length || clientOptions.online_clients?.length) ? (
                  <SimpleGrid columns={{ base: 1, md: 3 }} spacing={2} mb={3}>
                    <Box>
                      <Text fontSize="xs" fontWeight="bold" mb={1}>Facturación</Text>
                      <VStack align="stretch" spacing={1} maxH="140px" overflowY="auto">
                        {(clientOptions.billing || []).map((c) => (
                          <Button key={`b-${c.id}`} size="xs" variant="ghost" justifyContent="flex-start" onClick={() => applyReceiver(c, c.id)}>{c.name} {c.doc_number ? `(${c.doc_number})` : ''}</Button>
                        ))}
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontSize="xs" fontWeight="bold" mb={1}>Servicio técnico</Text>
                      <VStack align="stretch" spacing={1} maxH="140px" overflowY="auto">
                        {(clientOptions.repair_clients || []).map((c) => (
                          <Button key={`r-${c.id}`} size="xs" variant="ghost" justifyContent="flex-start" onClick={() => applyReceiver({ ...c, doc_type: c.doc_type || 'DNI' })}>{c.name} {c.doc_number ? `(${c.doc_number})` : ''}</Button>
                        ))}
                      </VStack>
                    </Box>
                    <Box>
                      <Text fontSize="xs" fontWeight="bold" mb={1}>Compras online</Text>
                      <VStack align="stretch" spacing={1} maxH="140px" overflowY="auto">
                        {(clientOptions.online_clients || []).map((c, i) => (
                          <Button key={`o-${i}`} size="xs" variant="ghost" justifyContent="flex-start" onClick={() => applyReceiver(c)}>{c.name} {c.email ? `(${c.email})` : ''}</Button>
                        ))}
                      </VStack>
                    </Box>
                  </SimpleGrid>
                ) : null}
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <FormControl isRequired><FormLabel>Nombre / Razón social</FormLabel><Input value={receiver.name} onChange={(e) => setReceiver({ ...receiver, name: e.target.value })} /></FormControl>
                  <FormControl><FormLabel>Tipo doc.</FormLabel><Input value={receiver.doc_type || ''} onChange={(e) => setReceiver({ ...receiver, doc_type: e.target.value })} placeholder="DNI / CUIT" /></FormControl>
                  <FormControl><FormLabel>Nº documento</FormLabel><Input value={receiver.doc_number || ''} onChange={(e) => {
                    const next = { ...receiver, doc_number: e.target.value };
                    setReceiver(next);
                    setFiscalForm((prev) => inferFiscalFromReceiver(next, prev));
                  }} /></FormControl>
                  <FormControl><FormLabel>Condición IVA</FormLabel><Input value={receiver.condicion_iva || ''} onChange={(e) => {
                    const next = { ...receiver, condicion_iva: e.target.value };
                    setReceiver(next);
                    setFiscalForm((prev) => inferFiscalFromReceiver(next, prev));
                  }} placeholder="Consumidor Final / RI / Monotributo..." /></FormControl>
                  <FormControl><FormLabel>Domicilio</FormLabel><Input value={receiver.address || ''} onChange={(e) => setReceiver({ ...receiver, address: e.target.value })} /></FormControl>
                  <FormControl><FormLabel>Email</FormLabel><Input value={receiver.email || ''} onChange={(e) => setReceiver({ ...receiver, email: e.target.value })} /></FormControl>
                  <FormControl><FormLabel>Teléfono</FormLabel><Input value={receiver.phone || ''} onChange={(e) => setReceiver({ ...receiver, phone: e.target.value })} /></FormControl>
                </SimpleGrid>
              </CardBody></Card>

              <Card variant="outline"><CardBody>
                <Heading size="sm" mb={1}>Datos fiscales ARCA (para “Guardar y emitir”)</Heading>
                <Text fontSize="sm" color="fg.muted" mb={3}>Se usan para solicitar el CAE automáticamente. Si hay error o falta conexión, el borrador queda guardado para reintentar desde el detalle (Autorizar ARCA).</Text>
                <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={3}>
                  <FormControl>
                    <FormLabel>Tipo comprobante</FormLabel>
                    <Select value={fiscalForm.cbte_tipo} onChange={(e) => {
                      const v = Number(e.target.value);
                      setFiscalForm((prev) => {
                        const next = { ...prev, cbte_tipo: v };
                        if (v === 1 && ![1, 6, 13, 16].includes(Number(next.condIva))) next.condIva = 1;
                        if (v === 6 && Number(next.condIva) === 1) next.condIva = 5;
                        return next;
                      });
                    }}>
                      <option value={6}>Factura B (6)</option>
                      <option value={1}>Factura A (1)</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Concepto</FormLabel>
                    <Select value={fiscalForm.concepto} onChange={(e) => setFiscalForm({ ...fiscalForm, concepto: Number(e.target.value) })}>
                      <option value={1}>Productos (1)</option>
                      <option value={2}>Servicios (2)</option>
                      <option value={3}>Productos y servicios (3)</option>
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Tipo doc. receptor (ARCA)</FormLabel>
                    <Select value={fiscalForm.docTipo} onChange={(e) => {
                      const v = Number(e.target.value);
                      setFiscalForm((prev) => ({ ...prev, docTipo: v, docNro: v === 99 ? '0' : (prev.docNro === '0' ? String(receiver.doc_number || '').replace(/\D/g, '') : prev.docNro) }));
                    }}>
                      {DOC_TIPOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Nº doc. receptor</FormLabel>
                    <Input value={fiscalForm.docNro} onChange={(e) => setFiscalForm({ ...fiscalForm, docNro: e.target.value })} isDisabled={Number(fiscalForm.docTipo) === 99} />
                  </FormControl>
                  <FormControl gridColumn={{ base: 'auto', lg: 'span 2' }}>
                    <FormLabel>Condición IVA receptor (ARCA)</FormLabel>
                    <Select value={fiscalForm.condIva} onChange={(e) => {
                      const v = Number(e.target.value);
                      setFiscalForm((prev) => {
                        const next = { ...prev, condIva: v };
                        if (v === 1 && next.cbte_tipo === 6) next.cbte_tipo = 1;
                        if (next.cbte_tipo === 1 && ![1, 6, 13, 16].includes(v)) next.cbte_tipo = 6;
                        return next;
                      });
                    }}>
                      {COND_IVA.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </Select>
                  </FormControl>
                </SimpleGrid>
                {Number(fiscalForm.concepto) !== 1 && (
                  <Text mt={2} fontSize="sm" color="orange.500">Para concepto Servicios/Productos y servicios, completá las fechas de servicio desde “Autorizar ARCA” si el envío automático las requiere.</Text>
                )}
              </CardBody></Card>

              <Card variant="outline"><CardBody>
                <Heading size="sm" mb={3}>Agregar ítems</Heading>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} mb={4}>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Desde producto</Text>
                    <HStack mb={2}><Input placeholder="Buscar producto" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} /><Button onClick={searchProducts}>Buscar</Button></HStack>
                    <VStack align="stretch" spacing={1} maxH="140px" overflowY="auto">
                      {productResults.map((p) => (
                        <Button key={p.id} size="xs" variant="outline" justifyContent="space-between" onClick={() => addProductItem(p.id)}>
                          <span>{p.name}</span><span>{money(p.price)}</span>
                        </Button>
                      ))}
                    </VStack>
                  </Box>
                  <Box>
                    <Text fontSize="sm" fontWeight="semibold" mb={2}>Desde reparación</Text>
                    <HStack mb={2}><Input placeholder="Buscar boleta/cliente" value={repairSearch} onChange={(e) => setRepairSearch(e.target.value)} /><Button onClick={searchRepairs}>Buscar</Button></HStack>
                    <VStack align="stretch" spacing={1} maxH="140px" overflowY="auto">
                      {repairResults.map((r) => (
                        <Button key={r.id} size="xs" variant="outline" justifyContent="space-between" onClick={() => addRepairItems(r.id)}>
                          <span>{r.ticket_number} - {r.client_name}</span><span>{r.status}</span>
                        </Button>
                      ))}
                    </VStack>
                  </Box>
                </SimpleGrid>
                <Button size="sm" mb={3} onClick={() => setItems((prev) => [...prev, emptyItem()])} leftIcon={<FiPlus />}>Línea manual</Button>

                <TableContainer>
                  <Table size="sm">
                    <Thead><Tr><Th>Origen</Th><Th minW="260px">Descripción</Th><Th isNumeric>Cant.</Th><Th isNumeric>P. Unit.</Th><Th isNumeric>IVA %</Th><Th isNumeric>Dto.</Th><Th isNumeric>Total</Th><Th></Th></Tr></Thead>
                    <Tbody>
                      {items.map((it, idx) => {
                        const c = calcItem(it);
                        return (
                          <Tr key={idx}>
                            <Td><Badge>{it.source_type}</Badge></Td>
                            <Td><Input size="sm" value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} /></Td>
                            <Td isNumeric><Input size="sm" type="number" min={0} step="0.01" w="80px" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} /></Td>
                            <Td isNumeric><Input size="sm" type="number" min={0} step="0.01" w="110px" value={it.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} /></Td>
                            <Td isNumeric><Input size="sm" type="number" min={0} max={100} step="0.01" w="80px" value={it.vat_rate} onChange={(e) => updateItem(idx, 'vat_rate', e.target.value)} /></Td>
                            <Td isNumeric><Input size="sm" type="number" min={0} step="0.01" w="90px" value={it.discount || 0} onChange={(e) => updateItem(idx, 'discount', e.target.value)} /></Td>
                            <Td isNumeric fontWeight="semibold">{money(c.line_total)}</Td>
                            <Td><IconButton size="sm" icon={<FiTrash2 />} aria-label="Quitar" variant="ghost" colorScheme="red" onClick={() => removeItem(idx)} /></Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableContainer>

                <Box mt={4} alignSelf="flex-end" ml="auto" maxW="320px">
                  <HStack justify="space-between"><Text>Subtotal</Text><Text>{money(totals.subtotal)}</Text></HStack>
                  <HStack justify="space-between"><Text>IVA</Text><Text>{money(totals.tax_total)}</Text></HStack>
                  <Divider my={2} />
                  <HStack justify="space-between"><Text fontWeight="bold">Total</Text><Text fontWeight="bold" fontSize="lg">{money(totals.total)}</Text></HStack>
                </Box>
              </CardBody></Card>

              <FormControl>
                <FormLabel>Notas</FormLabel>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={formDisc.onClose}>Cancelar</Button>
            <Button mr={3} onClick={() => saveDraft(false)} isLoading={saving}>Guardar borrador</Button>
            <Button colorScheme="green" onClick={() => saveDraft(true)} isLoading={saving} leftIcon={<FiCheckCircle />}>Guardar y emitir (ARCA)</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}
