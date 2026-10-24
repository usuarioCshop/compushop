import { useEffect, useRef, useState } from 'react';
import {
  Box, Heading, Button, Table, Thead, Tbody, Tr, Th, Td, IconButton, useToast, useDisclosure,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel,
  Input, Textarea, NumberInput, NumberInputField, Select, Switch, HStack, Spinner, Center, Badge,
  VStack, Text, List, ListItem,
} from '@chakra-ui/react';
import { FiPlus, FiEdit, FiTrash2, FiUpload } from 'react-icons/fi';
import api from '../../api/client';

const formatPrice = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

const empty = { name: '', description: '', price: 0, stock: 0, category_id: '', brand: '', image: '', is_active: true, is_promo: false };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isImportOpen, onOpen: onImportOpen, onClose: onImportClose } = useDisclosure();
  const [importing, setImporting] = useState(false);
  const [reporte, setReporte] = useState(null);
  const fileRef = useRef(null);
  const toast = useToast();
  const bg = 'bg.surface';

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get('/products?active=all&limit=100'),
      api.get('/categories'),
    ]).then(([p, c]) => {
      setProducts(p.data.products || []);
      setCategories(c.data.categories || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditId(null); setForm(empty); onOpen(); };
  const openEdit = (p) => {
    setEditId(p.id);
    setForm({ name: p.name, description: p.description || '', price: p.price, stock: p.stock, category_id: p.category_id || '', brand: p.brand || '', image: p.image || '', is_active: p.is_active, is_promo: !!p.is_promo });
    onOpen();
  };

  const save = async () => {
    try {
      const payload = { ...form, price: Number(form.price), stock: Number(form.stock), category_id: form.category_id ? Number(form.category_id) : null };
      if (editId) await api.put(`/products/${editId}`, payload);
      else await api.post('/products', payload);
      toast({ title: editId ? 'Actualizado' : 'Creado', status: 'success' });
      onClose();
      load();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error, status: 'error' });
    }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar producto?')) return;
    await api.delete(`/products/${id}`);
    toast({ title: 'Eliminado', status: 'info' });
    load();
  };

  const onSelectFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    setReporte(null);
    try {
      const res = await api.post('/products/import', formData, { headers: { 'Content-Type': undefined } });
      setReporte(res.data.reporte);
      toast({ title: 'Importación finalizada', status: 'success' });
      load();
    } catch (err) {
      toast({ title: 'Error al importar', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) return <Center py={10}><Spinner /></Center>;

  return (
    <Box>
      <HStack justify="space-between" mb={6} flexWrap="wrap" gap={2}>
        <Heading size="lg">Productos</Heading>
        <HStack>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={onSelectFile} />
          <Button leftIcon={<FiUpload />} variant="outline" onClick={() => fileRef.current?.click()} isLoading={importing}>Importar Productos</Button>
          <Button leftIcon={<FiPlus />} colorScheme="brand" onClick={openCreate}>Nuevo</Button>
        </HStack>
      </HStack>
      <Box bg={bg} borderRadius="xl" borderWidth="1px" overflowX="auto">
        <Table size="sm">
          <Thead><Tr><Th>Nombre</Th><Th>Precio</Th><Th>Stock</Th><Th>Promo</Th><Th>Activo</Th><Th></Th></Tr></Thead>
          <Tbody>
            {products.map(p => (
              <Tr key={p.id}>
                <Td>{p.name}</Td>
                <Td>{formatPrice(p.price)}</Td>
                <Td><Badge colorScheme={p.stock <= 5 ? 'orange' : 'green'}>{p.stock}</Badge></Td>
                <Td>{p.is_promo ? <Badge colorScheme="purple">Sí</Badge> : 'No'}</Td>
                <Td>{p.is_active ? 'Sí' : 'No'}</Td>
                <Td>
                  <HStack>
                    <IconButton size="sm" icon={<FiEdit />} onClick={() => openEdit(p)} aria-label="Editar" />
                    <IconButton size="sm" icon={<FiTrash2 />} colorScheme="red" variant="ghost" onClick={() => remove(p.id)} aria-label="Eliminar" />
                  </HStack>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{editId ? 'Editar producto' : 'Nuevo producto'}</ModalHeader>
          <ModalBody>
            <FormControl mb={3} isRequired><FormLabel>Nombre</FormLabel><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></FormControl>
            <FormControl mb={3}><FormLabel>Descripción</FormLabel><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FormControl>
            <HStack mb={3}>
              <FormControl isRequired><FormLabel>Precio</FormLabel><NumberInput value={form.price} onChange={v => setForm({ ...form, price: v })}><NumberInputField /></NumberInput></FormControl>
              <FormControl><FormLabel>Stock</FormLabel><NumberInput value={form.stock} onChange={v => setForm({ ...form, stock: v })}><NumberInputField /></NumberInput></FormControl>
            </HStack>
            <FormControl mb={3}><FormLabel>Categoría</FormLabel>
              <Select placeholder="Seleccionar" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FormControl>
            <FormControl mb={3}><FormLabel>Marca</FormLabel><Input value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} /></FormControl>
            <FormControl mb={3}><FormLabel>URL imagen</FormLabel><Input value={form.image} onChange={e => setForm({ ...form, image: e.target.value })} /></FormControl>
            <HStack justify="space-between">
              <FormControl display="flex" alignItems="center"><FormLabel mb={0}>Activo</FormLabel><Switch isChecked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /></FormControl>
              <FormControl display="flex" alignItems="center"><FormLabel mb={0}>En promoción</FormLabel><Switch isChecked={!!form.is_promo} onChange={e => setForm({ ...form, is_promo: e.target.checked })} /></FormControl>
            </HStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={3} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="brand" onClick={save}>Guardar</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {reporte && (
        <Modal isOpen onClose={() => setReporte(null)} size="lg">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Informe de importación</ModalHeader>
            <ModalBody>
              <HStack spacing={6} mb={4}>
                <Badge colorScheme="green" p={2}>Creados: {reporte.creados}</Badge>
                <Badge colorScheme="blue" p={2}>Actualizados: {reporte.actualizados}</Badge>
                <Badge colorScheme="red" p={2}>Errores: {reporte.errores?.length || 0}</Badge>
              </HStack>
              {reporte.errores?.length > 0 && (
                <Box>
                  <Text fontWeight="bold" mb={2}>Detalle de errores</Text>
                  <Box maxH="300px" overflowY="auto" borderWidth="1px" borderRadius="md">
                    <List spacing={1}>
                      {reporte.errores.map((e, idx) => (
                        <ListItem key={idx} p={2} borderBottomWidth="1px">
                          <Text fontSize="sm"><strong>Fila {e.fila}:</strong> {e.motivo}</Text>
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </Box>
              )}
            </ModalBody>
            <ModalFooter>
              <Button onClick={() => setReporte(null)}>Cerrar</Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
    </Box>
  );
}
