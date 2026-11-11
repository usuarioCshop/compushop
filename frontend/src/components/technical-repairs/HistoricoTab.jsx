import {
  Badge,
  Box,
  Button,
  Card,
  CardBody,
  Center,
  Divider,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Heading,
  Icon,
  IconButton,
  Image as ChakraImage,
  Input,
  InputGroup,
  InputLeftElement,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
  SimpleGrid,
  Spinner,
  Table,
  TableContainer,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import {
  FiChevronDown,
  FiChevronUp,
  FiClipboard,
  FiDownload,
  FiEdit,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import api from '../../api/client';
import EmptyState from '../EmptyState';
import useDebounce from '../../hooks/useDebounce';
import {
  DEFAULT_STATUSES,
  PAGE_SIZE,
  buildFilterParams,
  downloadBlob,
  formatCurrency,
  formatDateOnly,
  formatDateTime,
  statusColor,
  statusLabel,
} from './constants';

// Listado historico de boletas con filtros, detalle, exportacion y acciones.
export default function HistoricoTab({ onChanged, onEdit }) {
  const toast = useToast();
  const [repairs, setRepairs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

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

  const [statusOptions, setStatusOptions] = useState(
    DEFAULT_STATUSES.map((name, index) => ({ id: `default-${index}`, name }))
  );

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRepair, setDetailRepair] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchStatuses = useCallback(async () => {
    try {
      const { data } = await api.get('/repair-catalogs/status');
      if (data.items?.length) setStatusOptions(data.items);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const fetchPage = useCallback(
    async (pageNum) => {
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
      } catch (error) {
        console.error(error);
        setRepairs([]);
        toast({
          title: 'No se pudo cargar el historial',
          description: error.response?.data?.error,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [search, status, receivedFrom, receivedTo, probableFrom, probableTo, sortBy, sortDir, toast]
  );

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    fetchPage(1);
  }, [fetchPage]);

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

  const openDetail = async (id) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailRepair(null);
    try {
      const { data } = await api.get(`/technical-repairs/${id}`);
      setDetailRepair(data.repair);
    } catch (error) {
      toast({
        title: 'No se pudo abrir la boleta',
        description: error.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta orden de reparación?')) return;
    try {
      await api.delete(`/technical-repairs/${id}`);
      toast({ title: 'Boleta eliminada', status: 'success', duration: 3000, isClosable: true });
      fetchPage(pagination.page);
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
      downloadBlob(response, 'reparaciones.csv');
      toast({ title: 'CSV exportado', status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      toast({
        title: 'No se pudo exportar',
        description: error.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  return (
    <>
      <VStack spacing={4} align="stretch">
        <HStack justify="flex-end" spacing={2} flexWrap="wrap">
          <Button leftIcon={<FiDownload />} size="sm" variant="outline" onClick={handleExport}>
            Exportar CSV
          </Button>
          <Button
            leftIcon={<FiRefreshCw />}
            size="sm"
            onClick={() => {
              fetchStatuses();
              fetchPage(pagination.page);
            }}
          >
            Actualizar
          </Button>
        </HStack>

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
            <HStack justify="space-between" align="center" mb={4} flexWrap="wrap" gap={2}>
              <Heading as="h4" size="sm">
                Histórico de Órdenes
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
              <>
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
                        <Tr key={r.id} onClick={() => openDetail(r.id)} cursor="pointer" _hover={{ bg: 'bg.subtle' }}>
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
                                  onEdit?.(r);
                                }}
                              />
                              <IconButton
                                aria-label="Eliminar"
                                icon={<FiTrash2 />}
                                size="sm"
                                variant="ghost"
                                colorScheme="red"
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
                <HStack justify="center" spacing={3} mt={4}>
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
              </>
            )}
          </CardBody>
        </Card>
      </VStack>

      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} size="3xl" scrollBehavior="inside">
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
                <DetailItem label="Diagnóstico" value={detailRepair.diagnosis} />
                <DetailItem label="Notas" value={detailRepair.notes} />
                {detailRepair.parts?.length > 0 && (
                  <Box>
                    <Text fontSize="xs" color="fg.muted" textTransform="uppercase" mb={2}>
                      Repuestos
                    </Text>
                    <TableContainer>
                      <Table size="sm">
                        <Thead>
                          <Tr>
                            <Th>Producto</Th>
                            <Th isNumeric>Cant.</Th>
                            <Th isNumeric>Precio</Th>
                            <Th isNumeric>Subtotal</Th>
                          </Tr>
                        </Thead>
                        <Tbody>
                          {detailRepair.parts.map((part) => (
                            <Tr key={part.id || part.product_id}>
                              <Td>{part.product_name || part.description}</Td>
                              <Td isNumeric>{part.quantity}</Td>
                              <Td isNumeric>{formatCurrency(part.unit_price)}</Td>
                              <Td isNumeric>
                                {formatCurrency(Number(part.quantity) * Number(part.unit_price))}
                              </Td>
                            </Tr>
                          ))}
                        </Tbody>
                      </Table>
                    </TableContainer>
                  </Box>
                )}
                <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                  <DetailItem label="Mano de obra" value={formatCurrency(detailRepair.labor_price || 0)} />
                  <DetailItem label="Repuestos" value={formatCurrency(detailRepair.parts_total || 0)} />
                  <DetailItem label="Total" value={formatCurrency(detailRepair.total || 0)} />
                </SimpleGrid>
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
                onClick={() => {
                  if (detailRepair) onEdit?.(detailRepair);
                  setDetailOpen(false);
                }}
                isDisabled={!detailRepair}
              >
                Editar
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
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
  const display =
    value === null || value === undefined || value === '' ? '-' : value;
  return (
    <Box>
      <Text fontSize="xs" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
        {label}
      </Text>
      <Box mt={1}>{typeof display === 'string' || typeof display === 'number' ? <Text>{display}</Text> : display}</Box>
    </Box>
  );
}
