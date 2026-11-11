import {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  Box, Button, Container, Heading, HStack, Input, InputGroup, InputLeftElement,
  Icon, Spinner, Center, Text, VStack, Select, Flex, Grid, GridItem, Textarea,
  Card, CardBody, CardFooter, Divider, Badge, Tabs, Tab, TabList, TabPanels,
  TabPanel, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody,
  ModalCloseButton, FormControl, FormLabel, Link, Image as ChakraImage,
} from '@chakra-ui/react';
import {
  FiSearch, FiX, FiPlus, FiEdit, FiTrash2, FiSave, FiImage, FiRefreshCw,
  FiUsers, FiClipboardList,
} from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import EmptyState from '../components/EmptyState';
import useDebounce from '../hooks/useDebounce';

const PAGE_SIZE = 20;
const STATUSES = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'reparado', label: 'Reparado' },
  { value: 'entregado', label: 'Entregado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export default function TechnicalRepairs() {
  const { user, isTecnico } = useAuth();
  const [params, setParams] = useSearchParams();
  const [repairs, setRepairs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [openImageModal, setOpenImageModal] = useState(false);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const loaderRef = useRef(null);

  const search = params.get('search') || '';
  const status = params.get('status') || '';
  const [searchInput, setSearchInput] = useState(search);
  const [statusInput, setStatusInput] = useState(status);
  const debouncedSearch = useDebounce(searchInput, 400);
  const debouncedStatus = useDebounce(statusInput, 400);

  // Formulario (alta/edicion)
  const [form, setForm] = useState({
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
  });

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debouncedSearch) next.set('search', debouncedSearch); else next.delete('search');
    if (debouncedStatus) next.set('status', debouncedStatus); else next.delete('status');
    setParams(next, { replace: true });
  }, [debouncedSearch, debouncedStatus, params]);

  const fetchPage = useCallback(async (pageNum) => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (search) q.set('search', search);
      if (status) q.set('status', status);
      q.set('limit', String(PAGE_SIZE));
      q.set('page', String(pageNum));
      const res = await api.get(`/technical-repairs?${q}`);
      setRepairs(res.data.repairs || []);
      setPagination(res.data.pagination || { page: pageNum, pages: 1, total: 0 });
    } catch (err) {
      console.error(err);
      setRepairs([]);
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    setEditingId(null);
    setForm({
      ticket_number: '', status: 'pendiente', client_name: '', client_address: '',
      client_id: '', client_email: '', client_phone: '', article: '', brand: '',
      model: '', serial_number: '', damage_reported: '', notes: '', image_url: '',
      probable_repair_date: '',
    });
    setImagePreview(null);
    setSelectedRepair(null);
    fetchPage(1);
  }, [search, status, fetchPage]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.client_name || !form.damage_reported) {
      alert('Nombre del cliente y daño reportado son obligatorios');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ticket_number: form.ticket_number || undefined,
        status: form.status,
        client_name: form.client_name,
        client_address: form.client_address || undefined,
        client_id: form.client_id || undefined,
        client_email: form.client_email || undefined,
        client_phone: form.client_phone || undefined,
        article: form.article || undefined,
        brand: form.brand || undefined,
        model: form.model || undefined,
        serial_number: form.serial_number || undefined,
        damage_reported: form.damage_reported,
        notes: form.notes || undefined,
        image_url: form.image_url || undefined,
        probable_repair_date: form.probable_repair_date || undefined,
      };
      if (editingId) {
        await api.put(`/technical-repairs/${editingId}`, payload);
      } else {
        await api.post('/technical-repairs', payload);
      }
      setEditingId(null);
      setImagePreview(null);
      setForm({
        ticket_number: '', status: 'pendiente', client_name: '', client_address: '',
        client_id: '', client_email: '', client_phone: '', article: '', brand: '',
        model: '', serial_number: '', damage_reported: '', notes: '', image_url: '',
        probable_repair_date: '',
      });
      fetchPage(1);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo guardar la orden');
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
      status: repair.status,
      client_name: repair.client_name,
      client_address: repair.client_address || '',
      client_id: repair.client_id || '',
      client_email: repair.client_email || '',
      client_phone: repair.client_phone || '',
      article: repair.article || '',
      brand: repair.brand || '',
      model: repair.model || '',
      serial_number: repair.serial_number || '',
      damage_reported: repair.damage_reported,
      notes: repair.notes || '',
      image_url: repair.image_url || '',
      probable_repair_date: repair.probable_repair_date
        ? new Date(repair.probable_repair_date).toISOString().slice(0, 16)
        : '',
    });
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta orden de reparación?')) return;
    try {
      await api.delete(`/technical-repairs/${id}`);
      fetchPage(1);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo eliminar');
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
      setForm((f) => ({ ...f, image_url: data.url }));
      setImagePreview(data.url);
    } catch (err) {
      alert(err.response?.data?.error || 'No se pudo subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Solo se permiten imágenes');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target.result);
    reader.readAsDataURL(file);
    handleImageUpload(file);
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (s) => {
    const map = {
      pendiente: 'yellow',
      en_proceso: 'blue',
      reparado: 'green',
      entregado: 'teal',
      cancelado: 'red',
    };
    return <Badge colorScheme={map[s] || 'gray'}>{s.replace('_', ' ')}</Badge>;
  };

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
      <HeaderBar />
      <VStack spacing={4}>
        {/* Búsqueda y estado */}
        <HStack spacing={3} flexWrap="wrap" align="center">
          <InputGroup flex="1" minW="240px">
            <InputLeftElement><Icon as={FiSearch} color="fg.muted" /></InputLeftElement>
            <Input
              placeholder="Buscar boleta, cliente, artículo..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              bg="bg.surface"
            />
          </InputGroup>
          <Select
            minW="160px"
            value={statusInput}
            onChange={(e) => setStatusInput(e.target.value)}
            bg="bg.surface"
          >
            <option value="">Todos los estados</option>
            {STATUSES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </Select>
          {(search || status) && (
            <Button variant="ghost" leftIcon={<FiX />} size="sm" onClick={() => { setSearchInput(''); setStatusInput(''); setParams({}); }}>
              Limpiar
            </Button>
          )}
        </HStack>

        {/* Tarjeta de edición / alta */}
        <Card>
          <CardBody padding={6}>
            <VStack spacing={4}>
              <HStack justify="space-between" align="start" wrap="wrap">
                <VStack spacing={1}>
                  <Heading as="h4" size="sm">Orden de reparación</Heading>
                  <Text color="fg.muted" fontSize="sm">
                    {editingId ? 'Editando boleta #' + selectedRepair?.ticket_number : 'Nueva orden de reparación'}
                  </Text>
                </VStack>
                <Button
                  leftIcon={<FiPlus />}
                  onClick={() => {
                    setEditingId(null);
                    setSelectedRepair(null);
                    setImagePreview(null);
                    setForm({
                      ticket_number: '', status: 'pendiente', client_name: '', client_address: '',
                      client_id: '', client_email: '', client_phone: '', article: '', brand: '',
                      model: '', serial_number: '', damage_reported: '', notes: '', image_url: '',
                      probable_repair_date: '',
                    });
                  }}
                >
                  {editingId ? 'Cancelar edición' : 'Nueva orden'}
                </Button>
              </HStack>

              <form onSubmit={handleSave}>
                <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }} gap={4}>
                  <FormControl isRequired>
                    <FormLabel>Nº de Boleta</FormLabel>
                    <Input value={form.ticket_number} onChange={e => setForm({ ...form, ticket_number: e.target.value })} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Estado</FormLabel>
                    <Select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                      {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </Select>
                  </FormControl>
                  <FormControl isRequired>
                    <FormLabel>Fecha de recepción</FormLabel>
                    <Input type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Fecha prob. de reparación</FormLabel>
                    <Input type="datetime-local" value={form.probable_repair_date} onChange={e => setForm({ ...form, probable_repair_date: e.target.value })} />
                  </FormControl>

                  <FormControl isRequired colSpan={2}>
                    <FormLabel>Cliente</FormLabel>
                    <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} />
                  </FormControl>
                  <FormControl colSpan={2}>
                    <FormLabel>Domicilio</FormLabel>
                    <Input value={form.client_address} onChange={e => setForm({ ...form, client_address: e.target.value })} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Num ID / DNI</FormLabel>
                    <Input value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Email</FormLabel>
                    <Input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Teléfono</FormLabel>
                    <Input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} />
                  </FormControl>

                  <FormControl colSpan={2}>
                    <FormLabel>Artículo</FormLabel>
                    <Input value={form.article} onChange={e => setForm({ ...form, article: e.target.value })} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Marca</FormLabel>
                    <Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Modelo</FormLabel>
                    <Input value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
                  </FormControl>
                  <FormControl>
                    <FormLabel>Nº de serie</FormLabel>
                    <Input value={form.serial_number} onChange={e => setForm({ ...form, serial_number: e.target.value })} />
                  </FormControl>

                  <FormControl isRequired colSpan={3}>
                    <FormLabel>Daño reportado</FormLabel>
                    <Textarea
                      value={form.damage_reported}
                      onChange={e => setForm({ ...form, damage_reported: e.target.value })}
                      minRows={3}
                    />
                  </FormControl>

                  <FormControl colSpan={3}>
                    <FormLabel>Notas</FormLabel>
                    <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} minRows={2} />
                  </FormControl>

                  {/* Imagen del equipo */}
                  <FormControl colSpan={2}>
                    <FormLabel>Imagen del equipo</FormLabel>
                    <HStack spacing={3} align="center">
                      <Input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={handleImageChange}
                        isDisabled={uploading}
                      />
                      {imagePreview && (
                        <Button
                          size="sm"
                          leftIcon={<FiImage />}
                          onClick={() => {
                            setSelectedRepair({ image_url: imagePreview, id: editingId || 0 });
                            setOpenImageModal(true);
                          }}
                        >
                          Ver imagen
                        </Button>
                      )}
                      {form.image_url && (
                        <Link href={form.image_url} isExternal size="sm" color="brand.500">
                          Abrir imagen
                        </Link>
                      )}
                    </HStack>
                    {uploading && <Text fontSize="xs" color="fg.muted">Subiendo imagen...</Text>}
                  </FormControl>
                </Grid>

                <HStack spacing={3} mt={2}>
                  <Button type="submit" isLoading={saving} colorScheme="brand" disabled={saving}>
                    {editingId ? 'Guardar cambios' : 'Crear orden'}
                  </Button>
                  {editingId && (
                    <Button variant="outline" onClick={() => handleDelete(editingId)} colorScheme="red">
                      Eliminar
                    </Button>
                  )}
                </HStack>
              </form>
            </VStack>
          </CardBody>
        </Card>

        {/* Listado de boletas */}
        <Card>
          <CardBody padding={6}>
            <HStack justify="space-between" align="center" mb={4}>
              <Heading as="h4" size="sm">Listado de Nº de Boleta</Heading>
              <Text fontSize="sm" color="fg.muted">
                {pagination.total} boleta{pagination.total !== 1 ? 's' : ''}
              </Text>
            </HStack>

            {loading ? (
              <Center py={10}><Spinner color="brand.500" /></Center>
            ) : repairs.length === 0 ? (
              <EmptyState
                icon={FiClipboardList}
                title="Sin boletas"
                description="No hay órdenes de reparación con los filtros aplicados."
              />
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid', color: 'fg.muted', fontSize: 'sm' }}>
                    <th style={{ padding: '12px 8px' }}>Nº Boleta</th>
                    <th style={{ padding: '12px 8px' }}>Cliente</th>
                    <th style={{ padding: '12px 8px' }}>Artículo</th>
                    <th style={{ padding: '12px 8px' }}>Estado</th>
                    <th style={{ padding: '12px 8px' }}>Fecha recepción</th>
                    <th style={{ padding: '12px 8px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {repairs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid', borderColor: 'border.subtle' }}>
                      <td style={{ padding: '10px 8px', fontWeight: '600' }}>{r.ticket_number}</td>
                      <td style={{ padding: '10px 8px' }}>{r.client_name}</td>
                      <td style={{ padding: '10px 8px' }}>{r.article || '-'}</td>
                      <td style={{ padding: '10px 8px' }}>{statusBadge(r.status)}</td>
                      <td style={{ padding: '10px 8px', fontSize: 'sm', color: 'fg.muted' }}>{formatDate(r.received_at)}</td>
                      <td style={{ padding: '10px 8px' }}>
                        <HStack spacing={2}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(r)}
                            leftIcon={<FiEdit />}
                            color="brand.500"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(r.id)}
                            leftIcon={<FiTrash2 />}
                            color="red.500"
                          />
                        </HStack>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                Página {pagination.page} de {pagination.pages}
              </Text>
              <Button
                size="sm"
                variant="outline"
                isDisabled={!pagination.hasMore && pagination.page >= pagination.pages || loading}
                onClick={() => fetchPage(pagination.page + 1)}
              >
                Siguiente
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {/* Modal para ver imagen */}
        <Modal isOpen={openImageModal} onClose={() => setOpenImageModal(false)} size="xl">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Imagen del equipo</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Center>
                {selectedRepair?.image_url ? (
                  <ChakraImage src={selectedRepair.image_url} alt="Equipo" maxW="100%" maxH="60vh" borderRadius="md" border="1px solid" borderColor="border.subtle" />
                ) : imagePreview ? (
                  <ChakraImage src={imagePreview} alt="Equipo" maxW="100%" maxH="60vh" borderRadius="md" border="1px solid" borderColor="border.subtle" />
                ) : null}
              </Center>
            </ModalBody>
            <CardFooter>
              <HStack justify="end">
                <Button onClick={() => setOpenImageModal(false)}>Cerrar</Button>
              </HStack>
            </CardFooter>
          </ModalContent>
        </Modal>
      </VStack>
    </Container>
  );
}

function HeaderBar() {
  return (
    <HStack justify="space-between" align="center" mb={6}>
      <VStack align="start" spacing={1}>
        <Heading as="h2" size="lg" letterSpacing="-0.02em">Servicio Técnico</Heading>
        <Text color="fg.muted" fontSize="sm">Órdenes de reparación de equipos</Text>
      </VStack>
      <HStack spacing={2}>
        <Button leftIcon={<FiRefreshCw />} size="sm">Actualizar</Button>
      </HStack>
    </HStack>
  );
}
