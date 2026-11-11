import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Heading,
  Icon,
  IconButton,
  Image as ChakraImage,
  Input,
  InputGroup,
  InputLeftElement,
  Link,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  Spinner,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { FiImage, FiPlus, FiRefreshCw, FiSearch, FiUserPlus } from 'react-icons/fi';
import api from '../../api/client';
import {
  DEFAULT_STATUSES,
  emptyForm,
  isEmail,
  statusLabel,
  toDateInput,
  toDateTimeInput,
  validateForm,
} from './constants';

// Alta y edicion de boletas (datos del cliente y equipo).
export default function EntradaTab({ onChanged, editRepair, onEditDone }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [selectedRepair, setSelectedRepair] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [openImageModal, setOpenImageModal] = useState(false);
  const [receivedAtDefault, setReceivedAtDefault] = useState(() =>
    toDateTimeInput(new Date().toISOString())
  );

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

  const fetchCatalogs = useCallback(async () => {
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
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchTechnicians = useCallback(async () => {
    try {
      const { data } = await api.get('/technical-repairs/technicians');
      setTechnicians(data.technicians || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadNextTicket = useCallback(async () => {
    try {
      const { data } = await api.get('/technical-repairs/next-ticket');
      setForm((prev) => ({ ...prev, ticket_number: data.ticket_number || '' }));
    } catch (error) {
      console.error(error);
    }
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setSelectedRepair(null);
    setImagePreview(null);
    setForm({ ...emptyForm });
    setReceivedAtDefault(toDateTimeInput(new Date().toISOString()));
  }, []);

  useEffect(() => {
    fetchCatalogs();
    fetchTechnicians();
    loadNextTicket();
  }, [fetchCatalogs, fetchTechnicians, loadNextTicket]);

  useEffect(() => {
    if (!editRepair) return;
    setEditingId(editRepair.id);
    setSelectedRepair(editRepair);
    setImagePreview(editRepair.image_url || null);
    setForm({
      ticket_number: editRepair.ticket_number || '',
      status: editRepair.status || 'pendiente',
      client_name: editRepair.client_name || '',
      client_address: editRepair.client_address || '',
      client_id: editRepair.client_id || '',
      client_email: editRepair.client_email || '',
      client_phone: editRepair.client_phone || '',
      article: editRepair.article || '',
      brand: editRepair.brand || '',
      model: editRepair.model || '',
      serial_number: editRepair.serial_number || '',
      damage_reported: editRepair.damage_reported || '',
      notes: editRepair.notes || '',
      image_url: editRepair.image_url || '',
      probable_repair_date: toDateInput(editRepair.probable_repair_date),
      assigned_to: editRepair.assigned_to ? String(editRepair.assigned_to) : '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [editRepair]);

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
      onEditDone?.();
      onChanged?.();
    } catch (error) {
      const detalles = error.response?.data?.detalles;
      const description = detalles?.length
        ? detalles.map((d) => `${d.campo}: ${d.mensaje}`).join(' · ')
        : error.response?.data?.error || 'No se pudo guardar la orden';
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

  const handleDelete = async () => {
    if (!editingId) return;
    if (!window.confirm('¿Eliminar esta orden de reparación?')) return;
    try {
      await api.delete(`/technical-repairs/${editingId}`);
      toast({ title: 'Boleta eliminada', status: 'success', duration: 3000, isClosable: true });
      resetForm();
      loadNextTicket();
      onEditDone?.();
      onChanged?.();
    } catch (error) {
      toast({
        title: 'No se pudo eliminar',
        description: error.response?.data?.error,
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
    } catch (error) {
      toast({
        title: 'No se pudo subir la imagen',
        description: error.response?.data?.error,
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
      if (catalogType === 'article' || catalogType === 'brand' || catalogType === 'status') {
        setForm((prev) => ({ ...prev, [catalogType]: data.item.name }));
      }
      setCatalogModalOpen(false);
      toast({
        title: 'Ítem agregado',
        description: `${data.item.name} se agregó al catálogo`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      toast({
        title: 'No se pudo agregar',
        description: error.response?.data?.error,
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
      if (clients.length === 0 && term.trim()) {
        setClientForm((prev) => (prev.name.trim() ? prev : { ...prev, name: term.trim() }));
      }
    } catch (error) {
      console.error(error);
      toast({
        title: 'No se pudo buscar clientes',
        description: error.response?.data?.error,
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
      toast({
        title: 'Email inválido',
        description: 'Revisá el email del cliente.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      });
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
    } catch (error) {
      toast({
        title: 'No se pudo guardar el cliente',
        description: error.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setClientSaving(false);
    }
  };

  const statusOptions = catalogs.status.length
    ? catalogs.status
    : DEFAULT_STATUSES.map((name, index) => ({ id: `default-${index}`, name }));

  return (
    <>
      <VStack spacing={4} align="stretch">
        <HStack justify="flex-end" spacing={2} flexWrap="wrap">
          <Button
            leftIcon={<FiRefreshCw />}
            size="sm"
            variant="outline"
            onClick={() => {
              fetchCatalogs();
              fetchTechnicians();
              if (!editingId) loadNextTicket();
            }}
          >
            Actualizar datos
          </Button>
        </HStack>

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
                    onEditDone?.();
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

                  <GridItem colSpan={{ base: 1, md: 2 }}>
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

                  <GridItem colSpan={{ base: 1, md: 2 }}>
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

                  <GridItem colSpan={{ base: 1, md: 2 }}>
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
                        minH="90px"
                      />
                    </FormControl>
                  </GridItem>

                  <GridItem colSpan={{ base: 1, md: 2, lg: 3 }}>
                    <FormControl>
                      <FormLabel>Notas</FormLabel>
                      <Textarea
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        minH="80px"
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
                    <Button type="button" variant="outline" onClick={handleDelete} colorScheme="red">
                      Eliminar
                    </Button>
                  )}
                </HStack>
              </form>
            </VStack>
          </CardBody>
        </Card>
      </VStack>

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
    </>
  );
}

function CatalogSelect({ type, value, options, onChange, onAdd, placeholder }) {
  const names = options.map((item) => item.name);
  const hasValue = value && !names.includes(value);

  return (
    <HStack spacing={2}>
      <Select value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} bg="bg.surface">
        {hasValue && <option value={value}>{type === 'status' ? statusLabel(value) : value}</option>}
        {options.map((item) => (
          <option key={item.id} value={item.name}>
            {type === 'status' ? statusLabel(item.name) : item.name}
          </option>
        ))}
      </Select>
      <IconButton type="button" aria-label={`Agregar ${type}`} icon={<FiPlus />} onClick={onAdd} variant="outline" />
    </HStack>
  );
}
