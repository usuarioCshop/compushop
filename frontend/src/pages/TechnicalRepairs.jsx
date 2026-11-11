import { useCallback, useEffect, useState } from 'react';
import {
  Badge, Box, Button, Card, CardBody, Center, Container, Divider, FormControl,
  FormLabel, Grid, GridItem, Heading, HStack, Icon, IconButton, Image as ChakraImage,
  Input, InputGroup, InputLeftElement, Link, Modal, ModalBody, ModalCloseButton,
  ModalContent, ModalFooter, ModalHeader, ModalOverlay, Select, SimpleGrid, Spinner,
  Table, TableContainer, Tbody, Td, Text, Textarea, Th, Thead, Tr, useToast, VStack,
} from '@chakra-ui/react';
import {
  FiChevronDown, FiChevronUp, FiClipboard, FiDownload, FiEdit, FiImage, FiPlus,
  FiRefreshCw, FiSearch, FiTrash2, FiUserPlus, FiX,
} from 'react-icons/fi';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import useDebounce from '../hooks/useDebounce';

const PAGE_SIZE = 20;
const DEFAULT_STATUSES = ['pendiente', 'en_proceso', 'reparado', 'entregado', 'cancelado'];

const emptyForm = {
  ticket_number: '',
  status: 'pendiente',
  client_name: '',
  client_address: '',
  client_id: '',
  client_email: '',
  client_phone: '',
  article: '',
  brand: '',
  model: '',
  serial_number: '',
  damage_reported: '',
  notes: '',
  image_url: '',
  probable_repair_date: '',
  assigned_to: '',
};

const statusLabel = (name) => {
  if (!name) return '';
  return name.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};

const statusColor = (status) => {
  const map = {
    pendiente: 'yellow',
    en_proceso: 'blue',
    reparado: 'green',
    entregado: 'teal',
    cancelado: 'red',
  };
  return map[status] || 'gray';
};

const formatDateTime = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateOnly = (iso) => {
  if (!iso) return '-';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const toDateInput = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

const toDateTimeInput = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const validateForm = (values) => {
  if (!values.client_name.trim() || values.client_name.trim().length < 2) {
    return 'El nombre del cliente debe tener al menos 2 caracteres';
  }
  if (!values.damage_reported.trim() || values.damage_reported.trim().length < 3) {
    return 'El daño reportado debe tener al menos 3 caracteres';
  }
  if (values.client_email.trim() && !isEmail(values.client_email.trim())) {
    return 'El email del cliente no es válido';
  }
  return null;
};

function buildFilterParams({
  search,
  status,
  receivedFrom,
  receivedTo,
  probableFrom,
  probableTo,
  sortBy,
  sortDir,
}) {
  const q = new URLSearchParams();
  if (search) q.set('search', search);
  if (status) q.set('status', status);
  if (receivedFrom) q.set('received_from', receivedFrom);
  if (receivedTo) q.set('received_to', receivedTo);
  if (probableFrom) q.set('probable_from', probableFrom);
  if (probableTo) q.set('probable_to', probableTo);
  q.set('sort_by', sortBy);
  q.set('sort_dir', sortDir);
  return q;
}

export default function TechnicalRepairs() {
  const { isTecnico } = useAuth();
  const toast = useToast();

  const [repairs, setRepairs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [openImageModal, setOpenImageModal] = useState(false);
  const [receivedAtDefault] = useState(() => toDateTimeInput(new Date().toISOString()));

  const [searchInput, setSearchInput] = useState('');
  const [statusInput, setStatusInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 400);
  const debouncedStatus = useDebounce(statusInput, 400);
  const search = debouncedSearch;
  const status = debouncedStatus;

  const [receivedFrom, setReceivedFrom] = useState('');
  const [receivedTo, setReceivedTo] = useState('');
  const [probableFrom, setProbableFrom] = useState('');
  const [probableTo, setProbableTo] = useState('');
  const [sortBy, setSortBy] = useState('received_at');
  const [sortDir, setSortDir] = useState('desc');

  const [form, setForm] = useState({ ...emptyForm });
  const [catalogs, setCatalogs] = useState({ article: [], brand: [], status: [] });
  const [technicians, setTechnicians] = useState([]);

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [catalogType, setCatalogType] = useState('article');
  const [catalogName, setCatalogName] = useState('');
  const [catalogSaving, setCatalogSaving] = useState(false);

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [clientForm, setClientForm] = useState({ name: '', address: '', dni: '', email: '', phone: '' });
  const [clientSaving, setClientSaving] = useState(false);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRepair, setDetailRepair] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchCatalogs = async () => {
    try {
      const [articleRes, brandRes, statusRes] = await Promise.all([
        api.get('/repair-catalogs/article'),
        api.get('/repair-catalogs/brand'),
        api.get('/repair-catalogs/status'),
      ]);
      setCatalogs({
        article: articleRes.data.items || [],
        brand: brandRes.data.items || [],
        status: statusRes.data.items || [],
      });
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const { data } = await api.get('/technical-repairs/technicians');
      setTechnicians(data.technicians || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadNextTicket = async () => {
    try {
      const { data } = await api.get('/technical-repairs/next-ticket');
      setForm((prev) => ({ ...prev, ticket_number: data.ticket_number || '' }));
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setSelectedRepair(null);
    setImagePreview(null);
    setForm({ ...emptyForm });
  };

  const fetchPage = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const q = buildFilterParams({
        search,
        status,
        receivedFrom,
        receivedTo,
        probableFrom,
        probableTo,
        sortBy,
        sortDir,
      });
      q.set('limit', String(PAGE_SIZE));
      q.set('page', String(pageNum));

      const { data } = await api.get(`/technical-repairs?${q.toString()}`);
      setRepairs(data.repairs || []);
      setPagination(data.pagination || { page: pageNum, pages: 1, total: 0 });
    } catch (err) {
      console.error(err);
      setRepairs([]);
      toast({
        title: 'No se pudo cargar el listado',
        description: err.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, receivedFrom, receivedTo, probableFrom, probableTo, sortBy, sortDir]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

  useEffect(() => {
    fetchCatalogs();
    fetchTechnicians();
    loadNextTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();

    const validationError = validateForm(form);
    if (validationError) {
      toast({
        title: 'Revisá el formulario',
        description: validationError,
        status: 'warning',
        duration: 4000,
        isClosable: true,
      });
      return;
    }

    setSaving(true);
    const wasEditing = Boolean(editingId);
    try {
      const payload = {
        ticket_number: form.ticket_number.trim() || undefined,
        status: form.status,
        client_name: form.client_name.trim(),
        client_address: form.client_address.trim(),
        client_id: form.client_id.trim(),
        client_email: form.client_email.trim(),
        client_phone: form.client_phone.trim(),
        article: form.article,
        brand: form.brand,
        model: form.model.trim(),
        serial_number: form.serial_number.trim(),
        damage_reported: form.damage_reported.trim(),
        notes: form.notes.trim(),
        image_url: form.image_url,
        probable_repair_date: form.probable_repair_date,
        assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
      };

      if (editingId) {
        await api.put(`/technical-repairs/${editingId}`, payload);
      } else {
        await api.post('/technical-repairs', payload);
      }

      toast({
        title: wasEditing ? 'Boleta actualizada' : 'Boleta creada',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });

      resetForm();
      loadNextTicket();
      fetchPage(1);
    } catch (err) {
      const detalles = err.response?.data?.detalles;
      const description = detalles?.length
        ? detalles.map((d) => `${d.campo}: ${d.mensaje}`).join(' · ')
        : err.response?.data?.error || 'No se pudo guardar la orden';

      toast({
        title: 'Error al guardar',
        description,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (repair) => {
    setEditingId(repair.id);
    setSelectedRepair(repair);
    setImagePreview(repair.image_url || null);
    setForm({
      ticket_number: repair.ticket_number || '',
      status: repair.status || 'pendiente',
      client_name: repair.client_name || '',
      client_address: repair.client_address || '',
      client_id: repair.client_id || '',
      client_email: repair.client_email || '',
      client_phone: repair.client_phone || '',
      article: repair.article || '',
      brand: repair.brand || '',
      model: repair.model || '',
      serial_number: repair.serial_number || '',
      damage_reported: repair.damage_reported || '',
      notes: repair.notes || '',
      image_url: repair.image_url || '',
      probable_repair_date: toDateInput(repair.probable_repair_date),
      assigned_to: repair.assigned_to ? String(repair.assigned_to) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta orden de reparación?')) return;

    try {
      await api.delete(`/technical-repairs/${id}`);
      toast({ title: 'Boleta eliminada', status: 'success', duration: 3000, isClosable: true });
      if (editingId === id) resetForm();
      fetchPage(pagination.page);
    } catch (err) {
      toast({
        title: 'No se pudo eliminar',
        description: err.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/upload/repair-image', fd, {
        headers: { 'Content-Type': undefined },
      });
      setForm((prev) => ({ ...prev, image_url: data.url }));
      setImagePreview(data.url);
    } catch (err) {
      toast({
        title: 'No se pudo subir la imagen',
        description: err.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Archivo inválido',
        description: 'Solo se permiten imágenes',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    handleImageUpload(file);
  };

  const openCatalogModal = (type) => {
    setCatalogType(type);
    setCatalogName('');
    setCatalogModalOpen(true);
  };

  const handleCreateCatalogItem = async () => {
    const name = catalogName.trim();
    if (!name) {
      toast({ title: 'Falta el nombre', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setCatalogSaving(true);
    try {
      const { data } = await api.post(`/repair-catalogs/${catalogType}`, { name });
      await fetchCatalogs();
      setForm((prev) => ({ ...prev, [catalogType]: data.item.name }));
      setCatalogModalOpen(false);
      toast({
        title: 'Ítem agregado',
        description: `${data.item.name} se agregó al catálogo`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      toast({
        title: 'No se pudo agregar',
        description: err.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setCatalogSaving(false);
    }
  };

  const searchClients = async (term) => {
    setClientSearching(true);
    try {
      const q = new URLSearchParams();
      if (term.trim()) q.set('search', term.trim());
      const { data } = await api.get(`/repair-clients?${q.toString()}`);
      const clients = data.clients || [];
      setClientResults(clients);

      // Si no hay resultados, acercamos el termino buscado al alta rapida.
      if (clients.length === 0 && term.trim()) {
        setClientForm((prev) => (prev.name.trim() ? prev : { ...prev, name: term.trim() }));
      }
    } catch (err) {
      console.error(err);
      toast({
        title: 'No se pudo buscar clientes',
        description: err.response?.data?.error,
        status: 'error',
        duration: 3000,
        isClosable: true,
      });
    } finally {
      setClientSearching(false);
    }
  };

  const openClientModal = () => {
    const initial = form.client_name || '';
    setClientSearch(initial);
    setClientForm({
      name: form.client_name || '',
      address: form.client_address || '',
      dni: form.client_id || '',
      email: form.client_email || '',
      phone: form.client_phone || '',
    });
    setClientResults([]);
    setClientModalOpen(true);
    searchClients(initial);
  };

  const handleUseClient = (client) => {
    setForm((prev) => ({
      ...prev,
      client_name: client.name || '',
      client_address: client.address || '',
      client_id: client.dni || '',
      client_email: client.email || '',
      client_phone: client.phone || '',
    }));
    setClientModalOpen(false);
    toast({
      title: 'Cliente cargado',
      description: client.name,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  };

  const handleSaveClient = async () => {
    const name = clientForm.name.trim();
    if (!name) {
      toast({ title: 'Falta el nombre del cliente', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    const email = clientForm.email.trim();
    if (email && !isEmail(email)) {
      toast({ title: 'Email inválido', description: 'Revisá el email del cliente.', status: 'warning', duration: 3000, isClosable: true });
      return;
    }

    setClientSaving(true);
    try {
      const { data } = await api.post('/repair-clients', {
        name,
        address: clientForm.address.trim(),
        dni: clientForm.dni.trim(),
        email: clientForm.email.trim(),
        phone: clientForm.phone.trim(),
      });
      handleUseClient(data.client);
    } catch (err) {
      toast({
        title: 'No se pudo guardar el cliente',
        description: err.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setClientSaving(false);
    }
  };

  const openDetail = async (id) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRepair(null);
    try {
      const { data } = await api.get(`/technical-repairs/${id}`);
      setDetailRepair(data.repair);
    } catch (err) {
      toast({
        title: 'No se pudo abrir la boleta',
        description: err.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleEditFromDetail = () => {
    if (!detailRepair) return;
    handleEdit(detailRepair);
    setDetailOpen(false);
  };

  const handleExport = async () => {
    try {
      const q = buildFilterParams({
        search,
        status,
        receivedFrom,
        receivedTo,
        probableFrom,
        probableTo,
        sortBy,
        sortDir,
      });
      const response = await api.get(`/technical-repairs/export?${q.toString()}`, {
        responseType: 'blob',
      });

      const disposition = response.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : 'reparaciones.csv';

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({ title: 'CSV exportado', status: 'success', duration: 3000, isClosable: true });
    } catch (err) {
      toast({
        title: 'No se pudo exportar',
        description: err.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const sortIcon = (field) => {
    if (sortBy !== field) return <Icon as={FiChevronDown} opacity={0.3} />;
    return <Icon as={sortDir === 'asc' ? FiChevronUp : FiChevronDown} />;
  };

  const clearFilters = () => {
    setSearchInput('');
    setStatusInput('');
    setReceivedFrom('');
    setReceivedTo('');
    setProbableFrom('');
    setProbableTo('');
    setSortBy('received_at');
    setSortDir('desc');
  };

  const handleRefresh = () => {
    fetchPage(pagination.page);
    fetchCatalogs();
    fetchTechnicians();
    if (!editingId) loadNextTicket();
  };

  const statusOptions = catalogs.status.length
    ? catalogs.status
    : DEFAULT_STATUSES.map((name, index) => ({ id: `default-${index}`, name }));

  if (!isTecnico) {
    return (
      <Container maxW="4xl" py={20} textAlign="center">
        <Text fontSize="lg" color="fg.muted">
          No tenés permisos para acceder a Servicio Técnico.
        </Text>
      </Container>
    );
  }

  return (
    <Container maxW="9xl" py={6} px={4}>
      <HeaderBar onRefresh={handleRefresh} onExport={handleExport} />

      <VStack spacing={4} align="stretch">
        <Card>
          <CardBody>
            <VStack spacing={4} align="stretch">
              <HStack spacing={3} flexWrap="wrap" align="center">
                <InputGroup flex="1" minW="240px">
                  <InputLeftElement>
                    <Icon as={FiSearch} color="fg.muted" />
                  </InputLeftElement>
                  <Input
                    placeholder="Buscar boleta, cliente, artículo..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    bg="bg.surface"
                  />
                </InputGroup>
                <Select
                  minW="190px"
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  bg="bg.surface"
                  placeholder="Todos los estados"
                >
                  {statusOptions.map((item) => (
                    <option key={item.id} value={item.name}>
                      {statusLabel(item.name)}
                    </option>
                  ))}
                </Select>
              </HStack>

              <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }} gap={3}>
                <FormControl>
                  <FormLabel fontSize="sm">Recibida desde</FormLabel>
                  <Input type="date" value={receivedFrom} onChange={(e) => setReceivedFrom(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Recibida hasta</FormLabel>
                  <Input type="date" value={receivedTo} onChange={(e) => setReceivedTo(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Probable desde</FormLabel>
                  <Input type="date" value={probableFrom} onChange={(e) => setProbableFrom(e.target.value)} />
                </FormControl>
                <FormControl>
                  <FormLabel fontSize="sm">Probable hasta</FormLabel>
                  <Input type="date" value={probableTo} onChange={(e) => setProbableTo(e.target.value)} />
                </FormControl>
              </Grid>

              <HStack justify="flex-end">
                <Button type="button" size="sm" variant="ghost" leftIcon={<FiX />} onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              </HStack>
            </VStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody padding={6}>
            <VStack spacing={4} align="stretch">
              <HStack justify="space-between" align="start" wrap="wrap" gap={3}>
                <VStack spacing={1} align="start">
                  <Heading as="h4" size="sm">
                    Orden de reparación
                  </Heading>
                  <Text color="fg.muted" fontSize="sm">
                    {editingId
                      ? `Editando boleta ${selectedRepair?.ticket_number || ''}`
                      : 'Nueva orden de reparación'}
                  </Text>
                </VStack>
                <Button
                  type="button"
                  leftIcon={<FiPlus />}
                  onClick={() => {
                    resetForm();
                    loadNextTicket();
                  }}
                >
                  {editingId ? 'Cancelar edición' : 'Nueva orden'}
                </Button>
              </HStack>

              <form onSubmit={handleSave}>
                <Grid
                  templateColumns={{
                    base: '1fr',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)',
                    lg: 'repeat(4, 1fr)',
                  }}
                  gap={4}
                >
                  <FormControl>
                    <FormLabel>Nº de Boleta</FormLabel>
                    <Input
                      value={form.ticket_number}
                      onChange={(e) => setForm({ ...form, ticket_number: e.target.value })}
                    />
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel>Estado</FormLabel>
                    <CatalogSelect
                      type="status"
                      value={form.status}
                      options={statusOptions}
                      onChange={(value) => setForm({ ...form, status: value })}
                      onAdd={() => openCatalogModal('status')}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Fecha de recepción</FormLabel>
                    <Input
                      type="datetime-local"
                      value={
                        editingId && selectedRepair?.received_at
                          ? toDateTimeInput(selectedRepair.received_at)
                          : receivedAtDefault
                      }
                      isReadOnly
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Fecha prob. de reparación</FormLabel>
                    <Input
                      type="date"
                      value={form.probable_repair_date}
                      onChange={(e) => setForm({ ...form, probable_repair_date: e.target.value })}
                    />
                  </FormControl>

                  <GridItem colSpan={2}>
                    <FormControl isRequired>
                      <FormLabel>Cliente</FormLabel>
                      <HStack spacing={2}>
                        <Input
                          value={form.client_name}
                          onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                        />
                        <IconButton
                          type="button"
                          aria-label="Buscar cliente"
                          icon={<FiSearch />}
                          onClick={openClientModal}
                          variant="outline"
                        />
                      </HStack>
                    </FormControl>
                  </GridItem>

                  <GridItem colSpan={2}>
                    <FormControl>
                      <FormLabel>Domicilio</FormLabel>
                      <Input
                        value={form.client_address}
                        onChange={(e) => setForm({ ...form, client_address: e.target.value })}
                      />
                    </FormControl>
                  </GridItem>

                  <FormControl>
                    <FormLabel>Num ID / DNI</FormLabel>
                    <Input
                      value={form.client_id}
                      onChange={(e) => setForm({ ...form, client_id: e.target.value })}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input
                      type="email"
                      value={form.client_email}
                      onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Teléfono</FormLabel>
                    <Input
                      value={form.client_phone}
                      onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                    />
                  </FormControl>

                  <GridItem colSpan={2}>
                    <FormControl>
                      <FormLabel>Artículo</FormLabel>
                      <CatalogSelect
                        type="article"
                        value={form.article}
                        options={catalogs.article}
                        onChange={(value) => setForm({ ...form, article: value })}
                        onAdd={() => openCatalogModal('article')}
                        placeholder="Seleccionar artículo"
                      />
                    </FormControl>
                  </GridItem>

                  <FormControl>
                    <FormLabel>Marca</FormLabel>
                    <CatalogSelect
                      type="brand"
                      value={form.brand}
                      options={catalogs.brand}
                      onChange={(value) => setForm({ ...form, brand: value })}
                      onAdd={() => openCatalogModal('brand')}
                      placeholder="Seleccionar marca"
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Modelo</FormLabel>
                    <Input
                      value={form.model}
                      onChange={(e) => setForm({ ...form, model: e.target.value })}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Nº de serie</FormLabel>
                    <Input
                      value={form.serial_number}
                      onChange={(e) => setForm({ ...form, serial_number: e.target.value })}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel>Técnico asignado</FormLabel>
                    <Select
                      value={form.assigned_to}
                      onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                      placeholder="Sin asignar"
                    >
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name} ({tech.role})
                        </option>
                      ))}
                    </Select>
                  </FormControl>

                  <GridItem colSpan={{ base: 1, md: 2, lg: 3 }}>
                    <FormControl isRequired>
                      <FormLabel>Daño reportado</FormLabel>
                      <Textarea
                        value={form.damage_reported}
                        onChange={(e) => setForm({ ...form, damage_reported: e.target.value })}
                        minRows={3}
                      />
                    </FormControl>
                  </GridItem>

                  <GridItem colSpan={{ base: 1, md: 2, lg: 3 }}>
                    <FormControl>
                      <FormLabel>Notas</FormLabel>
                      <Textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        minRows={2}
                      />
                    </FormControl>
                  </GridItem>

                  <GridItem colSpan={{ base: 1, md: 2 }}>
                    <FormControl>
                      <FormLabel>Imagen del equipo</FormLabel>
                      <HStack spacing={3} align="center" flexWrap="wrap">
                        <Input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={handleImageChange}
                          isDisabled={uploading}
                        />
                        {imagePreview && (
                          <Button
                            type="button"
                            size="sm"
                            leftIcon={<FiImage />}
                            onClick={() => setOpenImageModal(true)}
                          >
                            Ver imagen
                          </Button>
                        )}
                        {form.image_url && (
                          <Link href={form.image_url} isExternal color="brand.500">
                            Abrir imagen
                          </Link>
                        )}
                      </HStack>
                      {uploading && (
                        <Text fontSize="xs" color="fg.muted">
                          Subiendo imagen...
                        </Text>
                      )}
                    </FormControl>
                  </GridItem>
                </Grid>

                <HStack spacing={3} mt={4}>
                  <Button type="submit" isLoading={saving} colorScheme="brand" disabled={saving}>
                    {editingId ? 'Guardar cambios' : 'Crear orden'}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleDelete(editingId)}
                      colorScheme="red"
                    >
                      Eliminar
                    </Button>
                  )}
                </HStack>
              </form>
            </VStack>
          </CardBody>
        </Card>

        <Card>
          <CardBody padding={6}>
            <HStack justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
              <Heading as="h4" size="sm">
                Listado de Nº de Boleta
              </Heading>
              <Text fontSize="sm" color="fg.muted">
                {pagination.total} boleta{pagination.total !== 1 ? 's' : ''}
              </Text>
            </HStack>

            {loading ? (
              <Center py={10}>
                <Spinner color="brand.500" />
              </Center>
            ) : repairs.length === 0 ? (
              <EmptyState
                icon={FiClipboard}
                title="Sin boletas"
                description="No hay órdenes de reparación con los filtros aplicados."
              />
            ) : (
              <TableContainer>
                <Table size="sm" variant="simple">
                  <Thead>
                    <Tr>
                      <SortableTh label="Nº Boleta" field="ticket_number" sortBy={sortBy} sortIcon={sortIcon} onSort={toggleSort} />
                      <SortableTh label="Cliente" field="client_name" sortBy={sortBy} sortIcon={sortIcon} onSort={toggleSort} />
                      <SortableTh label="Artículo" field="article" sortBy={sortBy} sortIcon={sortIcon} onSort={toggleSort} />
                      <SortableTh label="Estado" field="status" sortBy={sortBy} sortIcon={sortIcon} onSort={toggleSort} />
                      <SortableTh label="Técnico" field="assigned_to" sortBy={sortBy} sortIcon={sortIcon} onSort={toggleSort} />
                      <SortableTh label="Fecha recepción" field="received_at" sortBy={sortBy} sortIcon={sortIcon} onSort={toggleSort} />
                      <Th>Acciones</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {repairs.map((r) => (
                      <Tr
                        key={r.id}
                        onClick={() => openDetail(r.id)}
                        cursor="pointer"
                        _hover={{ bg: 'bg.subtle' }}
                      >
                        <Td fontWeight="600">{r.ticket_number}</Td>
                        <Td>{r.client_name}</Td>
                        <Td>{r.article || '-'}</Td>
                        <Td>
                          <Badge colorScheme={statusColor(r.status)}>{statusLabel(r.status)}</Badge>
                        </Td>
                        <Td>{r.assigned_to_name || '-'}</Td>
                        <Td fontSize="sm" color="fg.muted">
                          {formatDateTime(r.received_at)}
                        </Td>
                        <Td>
                          <HStack spacing={1}>
                            <IconButton
                              aria-label="Editar"
                              icon={<FiEdit />}
                              size="sm"
                              variant="ghost"
                              color="brand.500"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(r);
                              }}
                            />
                            <IconButton
                              aria-label="Eliminar"
                              icon={<FiTrash2 />}
                              size="sm"
                              variant="ghost"
                              color="red.500"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(r.id);
                              }}
                            />
                          </HStack>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableContainer>
            )}

            <HStack spacing={3} mt={6} align="center" justify="center">
              <Button
                size="sm"
                variant="outline"
                isDisabled={pagination.page <= 1 || loading}
                onClick={() => fetchPage(pagination.page - 1)}
              >
                Anterior
              </Button>
              <Text fontSize="sm" color="fg.muted" mx={2}>
                Página {pagination.page} de {Math.max(pagination.pages, 1)}
              </Text>
              <Button
                size="sm"
                variant="outline"
                isDisabled={pagination.page >= Math.max(pagination.pages, 1) || loading}
                onClick={() => fetchPage(pagination.page + 1)}
              >
                Siguiente
              </Button>
            </HStack>
          </CardBody>
        </Card>
      </VStack>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} size="2xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Boleta {detailRepair?.ticket_number || ''}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            {detailLoading ? (
              <Center py={10}>
                <Spinner color="brand.500" />
              </Center>
            ) : detailRepair ? (
              <VStack align="stretch" spacing={4}>
                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <DetailItem
                    label="Estado"
                    value={
                      <Badge colorScheme={statusColor(detailRepair.status)}>
                        {statusLabel(detailRepair.status)}
                      </Badge>
                    }
                  />
                  <DetailItem label="Técnico asignado" value={detailRepair.assigned_to_name || 'Sin asignar'} />
                  <DetailItem label="Fecha de recepción" value={formatDateTime(detailRepair.received_at)} />
                  <DetailItem label="Fecha probable" value={formatDateOnly(detailRepair.probable_repair_date)} />
                  <DetailItem label="Cliente" value={detailRepair.client_name} />
                  <DetailItem label="DNI" value={detailRepair.client_id} />
                  <DetailItem label="Teléfono" value={detailRepair.client_phone} />
                  <DetailItem label="Email" value={detailRepair.client_email} />
                  <DetailItem label="Domicilio" value={detailRepair.client_address} />
                  <DetailItem label="Artículo" value={detailRepair.article} />
                  <DetailItem label="Marca" value={detailRepair.brand} />
                  <DetailItem label="Modelo" value={detailRepair.model} />
                  <DetailItem label="Nº de serie" value={detailRepair.serial_number} />
                </SimpleGrid>
                <Divider />
                <DetailItem label="Daño reportado" value={detailRepair.damage_reported} />
                <DetailItem label="Notas" value={detailRepair.notes} />
                {detailRepair.image_url && (
                  <Box>
                    <Text fontSize="xs" color="fg.muted" textTransform="uppercase" mb={2}>
                      Imagen del equipo
                    </Text>
                    <ChakraImage
                      src={detailRepair.image_url}
                      alt="Equipo"
                      maxH="360px"
                      borderRadius="md"
                      border="1px solid"
                      borderColor="border.subtle"
                    />
                  </Box>
                )}
              </VStack>
            ) : null}
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="outline" onClick={() => setDetailOpen(false)}>
                Cerrar
              </Button>
              <Button
                colorScheme="brand"
                leftIcon={<FiEdit />}
                onClick={handleEditFromDetail}
                isDisabled={!detailRepair}
              >
                Editar
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={catalogModalOpen} onClose={() => setCatalogModalOpen(false)} size="sm">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            Agregar {catalogType === 'article' ? 'artículo' : catalogType === 'brand' ? 'marca' : 'estado'}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <FormControl isRequired>
              <FormLabel>Nombre</FormLabel>
              <Input
                value={catalogName}
                onChange={(e) => setCatalogName(e.target.value)}
                placeholder={catalogType === 'status' ? 'Ej: listo para entregar' : 'Ej: Tablet'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCreateCatalogItem();
                  }
                }}
              />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="outline" onClick={() => setCatalogModalOpen(false)}>
                Cancelar
              </Button>
              <Button colorScheme="brand" isLoading={catalogSaving} onClick={handleCreateCatalogItem}>
                Agregar
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={clientModalOpen} onClose={() => setClientModalOpen(false)} size="2xl" scrollBehavior="inside">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Buscar o cargar cliente</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack align="stretch" spacing={4}>
              <FormControl>
                <FormLabel>Buscar por nombre, DNI, email o teléfono</FormLabel>
                <HStack>
                  <InputGroup>
                    <InputLeftElement>
                      <Icon as={FiSearch} color="fg.muted" />
                    </InputLeftElement>
                    <Input
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          searchClients(clientSearch);
                        }
                      }}
                      placeholder="Ej: Juan Pérez o 30123456"
                    />
                  </InputGroup>
                  <Button leftIcon={<FiSearch />} onClick={() => searchClients(clientSearch)} isLoading={clientSearching}>
                    Buscar
                  </Button>
                </HStack>
              </FormControl>

              <Box maxH="220px" overflowY="auto" borderWidth="1px" borderRadius="md" borderColor="border.subtle">
                {clientSearching ? (
                  <Center py={6}>
                    <Spinner size="sm" />
                  </Center>
                ) : clientResults.length === 0 ? (
                  <Text p={4} fontSize="sm" color="fg.muted">
                    No se encontraron clientes. Podés cargarlo abajo.
                  </Text>
                ) : (
                  <VStack align="stretch" spacing={0} divider={<Divider />}>
                    {clientResults.map((client) => (
                      <HStack key={client.id} justify="space-between" p={3} _hover={{ bg: 'bg.subtle' }}>
                        <Box>
                          <Text fontWeight="600">{client.name}</Text>
                          <Text fontSize="xs" color="fg.muted">
                            {[client.dni, client.phone, client.email].filter(Boolean).join(' · ') ||
                              'Sin datos de contacto'}
                          </Text>
                        </Box>
                        <Button size="sm" colorScheme="brand" variant="outline" onClick={() => handleUseClient(client)}>
                          Usar
                        </Button>
                      </HStack>
                    ))}
                  </VStack>
                )}
              </Box>

              <Divider />

              <VStack align="stretch" spacing={3}>
                <HStack>
                  <Icon as={FiUserPlus} />
                  <Text fontWeight="600">Nuevo cliente</Text>
                </HStack>
                <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
                  <FormControl isRequired>
                    <FormLabel>Nombre</FormLabel>
                    <Input
                      value={clientForm.name}
                      onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>DNI</FormLabel>
                    <Input
                      value={clientForm.dni}
                      onChange={(e) => setClientForm({ ...clientForm, dni: e.target.value })}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Teléfono</FormLabel>
                    <Input
                      value={clientForm.phone}
                      onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input
                      type="email"
                      value={clientForm.email}
                      onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    />
                  </FormControl>
                  <GridItem colSpan={{ base: 1, md: 2 }}>
                    <FormControl>
                      <FormLabel>Domicilio</FormLabel>
                      <Input
                        value={clientForm.address}
                        onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                      />
                    </FormControl>
                  </GridItem>
                </Grid>
              </VStack>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="outline" onClick={() => setClientModalOpen(false)}>
                Cerrar
              </Button>
              <Button
                colorScheme="brand"
                leftIcon={<FiUserPlus />}
                isLoading={clientSaving}
                onClick={handleSaveClient}
              >
                Guardar cliente
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={openImageModal} onClose={() => setOpenImageModal(false)} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Imagen del equipo</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Center>
              {imagePreview ? (
                <ChakraImage
                  src={imagePreview}
                  alt="Equipo"
                  maxW="100%"
                  maxH="60vh"
                  borderRadius="md"
                  border="1px solid"
                  borderColor="border.subtle"
                />
              ) : null}
            </Center>
          </ModalBody>
          <ModalFooter>
            <Button onClick={() => setOpenImageModal(false)}>Cerrar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Container>
  );
}

function HeaderBar({ onRefresh, onExport }) {
  return (
    <HStack justify="space-between" align="center" mb={6} flexWrap="wrap" gap={3}>
      <VStack align="start" spacing={1}>
        <Heading as="h2" size="lg" letterSpacing="-0.02em">
          Servicio Técnico
        </Heading>
        <Text color="fg.muted" fontSize="sm">
          Órdenes de reparación de equipos
        </Text>
      </VStack>
      <HStack spacing={2}>
        <Button leftIcon={<FiDownload />} size="sm" variant="outline" onClick={onExport}>
          Exportar CSV
        </Button>
        <Button leftIcon={<FiRefreshCw />} size="sm" onClick={onRefresh}>
          Actualizar
        </Button>
      </HStack>
    </HStack>
  );
}

function CatalogSelect({ type, value, options, onChange, onAdd, placeholder }) {
  const names = options.map((item) => item.name);
  const hasValue = value && !names.includes(value);

  return (
    <HStack spacing={2}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} bg="bg.surface">
        {hasValue && (
          <option value={value}>{type === 'status' ? statusLabel(value) : value}</option>
        )}
        {options.map((item) => (
          <option key={item.id} value={item.name}>
            {type === 'status' ? statusLabel(item.name) : item.name}
          </option>
        ))}
      </Select>
      <IconButton
        type="button"
        aria-label={`Agregar ${type}`}
        icon={<FiPlus />}
        onClick={onAdd}
        variant="outline"
      />
    </HStack>
  );
}

function SortableTh({ label, field, sortBy, sortIcon, onSort }) {
  return (
    <Th cursor="pointer" userSelect="none" onClick={() => onSort(field)} whiteSpace="nowrap">
      <HStack spacing={1}>
        <Text as="span">{label}</Text>
        {sortIcon(field)}
      </HStack>
    </Th>
  );
}

function DetailItem({ label, value }) {
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <Text mt={1}>{value || '-'}</Text>
    </Box>
  );
}
