import { useEffect, useState } from 'react';
import {
  Box, Heading, Button, Table, Thead, Tbody, Tr, Th, Td, Badge, Spinner, Center, Text, IconButton, useToast, HStack,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel, Input, Select, VStack, useDisclosure,
} from '@chakra-ui/react';
import { FiTrash2, FiPlus, FiUser } from 'react-icons/fi';
import api from '../../api/client';
import { useAuth } from '../../context/AuthContext';

const emptyUser = { name: '', email: '', password: '', role: 'customer', dni: '', phone: '', address: '' };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyUser);
  const toast = useToast();
  const bg = 'bg.surface';
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const { isOpen, onOpen, onClose } = useDisclosure();

  const load = () => {
    setLoading(true);
    api.get('/users').then(r => setUsers(r.data.users || [])).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const createUser = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      toast({ title: 'Completá nombre, email y contraseña', status: 'warning' });
      return;
    }
    setSaving(true);
    try {
      await api.post('/users', { ...form, name: form.name.trim(), email: form.email.trim() });
      toast({ title: 'Usuario creado', status: 'success' });
      setForm(emptyUser);
      onClose();
      load();
    } catch (err) {
      toast({ title: 'No se pudo crear', description: err.response?.data?.error || err.message, status: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('¿Eliminar usuario?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast({ title: 'Eliminado', status: 'info' });
      load();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error, status: 'error' });
    }
  };

  const canRemove = (u) => {
    if (isSuperAdmin) return u.role !== 'superadmin' || u.id !== user?.id;
    return u.role !== 'admin' && u.role !== 'superadmin';
  };

  if (loading) return <Center py={10}><Spinner color="brand.500" /></Center>;

  return (
    <Box>
      <HStack justify="space-between" mb={6} wrap="wrap" gap={3}>
        <Heading size="lg" fontWeight="700" letterSpacing="-0.02em">Usuarios</Heading>
        {isSuperAdmin && (
          <Button leftIcon={<FiPlus />} colorScheme="accent" onClick={onOpen} borderRadius="full">
            Crear usuario
          </Button>
        )}
      </HStack>
      <Box bg={bg} borderRadius="lg" borderWidth="1px" borderColor="border.subtle" boxShadow="shadow-card" overflowX="auto">
        <Table size="sm">
          <Thead><Tr><Th>Nombre</Th><Th>Email</Th><Th>DNI</Th><Th>Rol</Th><Th></Th></Tr></Thead>
          <Tbody>
            {users.map(u => (
              <Tr key={u.id}>
                <Td fontWeight="500">{u.name}</Td>
                <Td color="fg.muted">{u.email}</Td>
                <Td>{u.dni || '—'}</Td>
                <Td>
                  <Badge
                    colorScheme={
                      u.role === 'superadmin' ? 'brand'
                        : u.role === 'admin' ? 'accent'
                        : u.role === 'tecnico' ? 'blue'
                        : 'gray'
                    }
                    variant="subtle"
                    borderRadius="full"
                  >
                    {u.role === 'tecnico' ? 'Técnico' : u.role}
                  </Badge>
                </Td>
                <Td>
                  {canRemove(u) && (
                    <IconButton size="sm" icon={<FiTrash2 />} colorScheme="red" variant="ghost" onClick={() => remove(u.id)} aria-label="Eliminar" />
                  )}
                </Td>
              </Tr>
            ))}
            {users.length === 0 && (
              <Tr><Td colSpan={5}><Text color="fg.muted" py={6} textAlign="center">No hay usuarios.</Text></Td></Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Crear usuario</ModalHeader>
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <FormControl isRequired><FormLabel>Nombre</FormLabel>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoComplete="name" />
              </FormControl>
              <FormControl isRequired><FormLabel>Email</FormLabel>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} autoComplete="email" />
              </FormControl>
              <FormControl isRequired><FormLabel>Contraseña (mín. 8)</FormLabel>
                <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} autoComplete="new-password" />
              </FormControl>
              <FormControl isRequired><FormLabel>Rol</FormLabel>
                <Select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  <option value="customer">Cliente</option>
                  <option value="admin">Administrador</option>
                  <option value="tecnico">Técnico</option>
                </Select>
              </FormControl>
              <FormControl><FormLabel>DNI</FormLabel>
                <Input value={form.dni} onChange={e => setForm({ ...form, dni: e.target.value })} />
              </FormControl>
              <FormControl><FormLabel>Teléfono</FormLabel>
                <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
              </FormControl>
              <FormControl><FormLabel>Dirección</FormLabel>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
              </FormControl>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" mr={2} onClick={onClose}>Cancelar</Button>
            <Button colorScheme="accent" leftIcon={<FiUser />} isLoading={saving} onClick={createUser} borderRadius="full">Crear</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
