import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Checkbox,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  GridItem,
  HStack,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Select,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FiRefreshCw, FiSave, FiSearch } from 'react-icons/fi';
import api from '../../api/client';
import EmptyState from '../EmptyState';
import { FiTool } from 'react-icons/fi';
import RepairPartsEditor from './RepairPartsEditor';
import {
  ACTIVE_REPAIR_STATUSES,
  DEFAULT_STATUSES,
  formatCurrency,
  formatDateTime,
  statusColor,
  statusLabel,
} from './constants';

function toForm(repair) {
  return {
    diagnosis: repair.diagnosis || '',
    labor_price: repair.labor_price ?? 0,
    labor_iva_enabled: Boolean(repair.labor_iva_enabled),
    labor_iva_rate: repair.labor_iva_rate ?? 21,
    notes: repair.notes || '',
    status: repair.status || 'pendiente',
    assigned_to: repair.assigned_to || '',
    parts: (repair.parts || []).map((part) => ({
      product_id: part.product_id,
      product_name: part.product_name || part.description,
      product_stock: part.product_stock ?? 0,
      original_quantity: part.quantity,
      quantity: part.quantity,
      unit_price: part.unit_price,
    })),
  };
}

// Espacio de trabajo para diagnosticar, cargar repuestos y actualizar el estado.
export default function ReparacionTab({ onChanged }) {
  const toast = useToast();
  const [repairs, setRepairs] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [repair, setRepair] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [statuses, setStatuses] = useState(
    DEFAULT_STATUSES.map((name, index) => ({ id: `default-${index}`, name }))
  );
  const [technicians, setTechnicians] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setListLoading(true);
    try {
      const responses = await Promise.all(
        ACTIVE_REPAIR_STATUSES.map((status) =>
          api.get('/technical-repairs', {
            params: { status, limit: 100, sort_by: 'received_at', sort_dir: 'desc' },
          })
        )
      );
      const merged = responses.flatMap((response) => response.data.repairs || []);
      const unique = [];
      const seen = new Set();
      merged.forEach((item) => {
        if (seen.has(item.id)) return;
        seen.add(item.id);
        unique.push(item);
      });
      unique.sort((a, b) => new Date(b.received_at) - new Date(a.received_at));
      setRepairs(unique);
    } catch (error) {
      toast({
        title: 'No se pudieron cargar las boletas activas',
        description: error.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setListLoading(false);
    }
  }, [toast]);

  const fetchStatuses = useCallback(async () => {
    try {
      const { data } = await api.get('/repair-catalogs/status');
      if (data.items?.length) setStatuses(data.items);
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

  const fetchCatalog = useCallback(async (searchText = '') => {
    setCatalogLoading(true);
    try {
      const { data } = await api.get('/technical-repairs/parts-catalog', {
        params: searchText ? { search: searchText } : {},
      });
      setCatalog(data.products || []);
    } catch (error) {
      console.error(error);
      setCatalog([]);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadDetail = useCallback(
    async (id) => {
      setDetailLoading(true);
      try {
        const { data } = await api.get(`/technical-repairs/${id}`);
        setRepair(data.repair);
        setForm(toForm(data.repair));
      } catch (error) {
        toast({
          title: 'No se pudo abrir la boleta',
          description: error.response?.data?.error,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setDetailLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchList();
    fetchStatuses();
    fetchTechnicians();
    fetchCatalog('');
  }, [fetchList, fetchStatuses, fetchTechnicians, fetchCatalog]);

  const filteredRepairs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return repairs;
    return repairs.filter((item) =>
      [item.ticket_number, item.client_name, item.article, item.brand, item.model]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [repairs, search]);

  const partsTotal = useMemo(
    () =>
      (form?.parts || []).reduce(
        (acc, line) => acc + Number(line.quantity || 0) * Number(line.unit_price || 0),
        0
      ),
    [form]
  );
  const laborBase = Number(form?.labor_price || 0);
  const laborIvaAmount =
    form?.labor_iva_enabled ? laborBase * (Number(form?.labor_iva_rate || 0) / 100) : 0;
  const total = laborBase + laborIvaAmount + partsTotal;

  const handleSave = async () => {
    if (!selectedId || !form) return;
    setSaving(true);
    try {
      const payload = {
        diagnosis: form.diagnosis,
        labor_price: form.labor_price === '' ? 0 : Number(form.labor_price),
        labor_iva_enabled: Boolean(form.labor_iva_enabled),
        labor_iva_rate:
          form.labor_iva_rate === '' || form.labor_iva_rate === undefined
            ? 21
            : Number(form.labor_iva_rate),
        notes: form.notes,
        status: form.status,
        assigned_to: form.assigned_to === '' ? null : Number(form.assigned_to),
        parts: form.parts.map((line) => {
          const part = {
            product_id: line.product_id,
            quantity: Number(line.quantity),
          };
          if (line.unit_price !== '' && line.unit_price !== null && line.unit_price !== undefined) {
            part.unit_price = Number(line.unit_price);
          }
          return part;
        }),
      };

      const { data } = await api.put(`/technical-repairs/${selectedId}`, payload);
      setRepair(data.repair);
      setForm(toForm(data.repair));
      await fetchList();
      onChanged?.();
      toast({ title: 'Reparación guardada', status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      toast({
        title: 'No se pudo guardar la reparación',
        description: error.response?.data?.error,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Grid templateColumns={{ base: '1fr', xl: '360px 1fr' }} gap={4} alignItems="start">
      <GridItem>
        <Card>
          <CardBody>
            <VStack align="stretch" spacing={3}>
              <HStack justify="space-between">
                <Heading size="sm">Boletas activas</Heading>
                <Button size="xs" leftIcon={<FiRefreshCw />} variant="ghost" onClick={fetchList}>
                  Actualizar
                </Button>
              </HStack>
              <InputGroup>
                <InputLeftElement pointerEvents="none">
                  <FiSearch color="gray" />
                </InputLeftElement>
                <Input
                  placeholder="Buscar por boleta, cliente o equipo"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </InputGroup>

              {listLoading ? (
                <HStack justify="center" py={6}>
                  <Spinner />
                </HStack>
              ) : filteredRepairs.length === 0 ? (
                <Text fontSize="sm" color="fg.muted">
                  No hay boletas pendientes, en proceso o reparadas.
                </Text>
              ) : (
                <VStack align="stretch" spacing={2} maxH="70vh" overflowY="auto">
                  {filteredRepairs.map((item) => (
                    <Box
                      key={item.id}
                      as="button"
                      textAlign="left"
                      p={3}
                      borderWidth="1px"
                      borderRadius="md"
                      borderColor={selectedId === item.id ? 'brand.400' : 'border.subtle'}
                      bg={selectedId === item.id ? 'brand.50' : 'transparent'}
                      _dark={{ bg: selectedId === item.id ? 'whiteAlpha.100' : 'transparent' }}
                      onClick={() => {
                        setSelectedId(item.id);
                        loadDetail(item.id);
                      }}
                    >
                      <HStack justify="space-between" mb={1}>
                        <Text fontWeight="semibold" fontSize="sm">
                          {item.ticket_number}
                        </Text>
                        <Badge colorScheme={statusColor(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                      </HStack>
                      <Text fontSize="sm">{item.client_name}</Text>
                      <Text fontSize="xs" color="fg.muted">
                        {[item.article, item.brand, item.model].filter(Boolean).join(' ')}
                      </Text>
                    </Box>
                  ))}
                </VStack>
              )}
            </VStack>
          </CardBody>
        </Card>
      </GridItem>

      <GridItem>
        {!selectedId ? (
          <Card>
            <CardBody>
              <EmptyState
                icon={FiTool}
                title="Elegí una boleta"
                description="Seleccioná una reparación activa para cargar diagnóstico, repuestos y mano de obra."
              />
            </CardBody>
          </Card>
        ) : detailLoading || !form || !repair ? (
          <Card>
            <CardBody>
              <HStack justify="center" py={10}>
                <Spinner />
              </HStack>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody>
              <VStack align="stretch" spacing={5}>
                <HStack justify="space-between" flexWrap="wrap" gap={3}>
                  <Box>
                    <Heading size="md">{repair.ticket_number}</Heading>
                    <Text color="fg.muted">
                      {repair.client_name} —{' '}
                      {[repair.article, repair.brand, repair.model].filter(Boolean).join(' ')}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      Recibido: {formatDateTime(repair.received_at)}
                    </Text>
                  </Box>
                  <Badge fontSize="sm" px={3} py={1} colorScheme={statusColor(form.status)}>
                    {statusLabel(form.status)}
                  </Badge>
                </HStack>

                <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4}>
                  <FormControl>
                    <FormLabel>Estado</FormLabel>
                    <Select
                      value={form.status}
                      onChange={(event) => setForm({ ...form, status: event.target.value })}
                    >
                      {statuses.map((item) => (
                        <option key={item.id || item.name} value={item.name}>
                          {statusLabel(item.name)}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <FormLabel>Técnico asignado</FormLabel>
                    <Select
                      value={form.assigned_to}
                      onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}
                    >
                      <option value="">Sin asignar</option>
                      {technicians.map((tech) => (
                        <option key={tech.id} value={tech.id}>
                          {tech.name}
                        </option>
                      ))}
                    </Select>
                  </FormControl>
                </SimpleGrid>

                <FormControl>
                  <FormLabel>Diagnóstico</FormLabel>
                  <Textarea
                    rows={4}
                    value={form.diagnosis}
                    onChange={(event) => setForm({ ...form, diagnosis: event.target.value })}
                    placeholder="Detalle del diagnóstico técnico"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Notas</FormLabel>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    placeholder="Observaciones internas"
                  />
                </FormControl>

                <Divider />

                <RepairPartsEditor
                  parts={form.parts}
                  onChange={(parts) => setForm({ ...form, parts })}
                  catalog={catalog}
                  catalogLoading={catalogLoading}
                  onSearch={fetchCatalog}
                  disabled={saving}
                />

                <Divider />

                <SimpleGrid columns={{ base: 1, md: 2, lg: 4 }} spacing={4} alignItems="end">
                  <FormControl>
                    <FormLabel>Mano de obra</FormLabel>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.labor_price}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          labor_price: event.target.value === '' ? '' : Number(event.target.value),
                        })
                      }
                    />
                  </FormControl>
                  <FormControl>
                    <FormLabel>IVA sobre mano de obra</FormLabel>
                    <VStack align="start" spacing={2}>
                      <Checkbox
                        isChecked={Boolean(form.labor_iva_enabled)}
                        onChange={(event) =>
                          setForm({ ...form, labor_iva_enabled: event.target.checked })
                        }
                      >
                        Agregar IVA
                      </Checkbox>
                      {form.labor_iva_enabled && (
                        <HStack>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step="0.01"
                            value={form.labor_iva_rate}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                labor_iva_rate:
                                  event.target.value === '' ? '' : Number(event.target.value),
                              })
                            }
                            maxW="120px"
                          />
                          <Text fontSize="sm" color="fg.muted">
                            %
                          </Text>
                        </HStack>
                      )}
                    </VStack>
                  </FormControl>
                  <Box>
                    <Text fontSize="sm" color="fg.muted">
                      Repuestos
                    </Text>
                    <Text fontWeight="semibold">{formatCurrency(partsTotal)}</Text>
                    {form.labor_iva_enabled && (
                      <Text fontSize="sm" color="fg.muted" mt={1}>
                        IVA mano de obra: {formatCurrency(laborIvaAmount)}
                      </Text>
                    )}
                  </Box>
                  <Box>
                    <Text fontSize="sm" color="fg.muted">
                      Total
                    </Text>
                    <Heading size="md">{formatCurrency(total)}</Heading>
                  </Box>
                </SimpleGrid>

                <HStack justify="flex-end">
                  <Button
                    leftIcon={<FiSave />}
                    colorScheme="brand"
                    onClick={handleSave}
                    isLoading={saving}
                  >
                    Guardar reparación
                  </Button>
                </HStack>
              </VStack>
            </CardBody>
          </Card>
        )}
      </GridItem>
    </Grid>
  );
}
