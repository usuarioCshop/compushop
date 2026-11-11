import {
  Box,
  Button,
  Card,
  CardBody,
  FormControl,
  FormLabel,
  HStack,
  Heading,
  Input,
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
import { FiDownload, FiSearch } from 'react-icons/fi';
import api from '../../api/client';
import EmptyState from '../EmptyState';
import { FiBarChart2 } from 'react-icons/fi';
import { DEFAULT_STATUSES, downloadBlob, formatCurrency, statusLabel } from './constants';

const GROUP_OPTIONS = [
  { value: 'status', label: 'Por estado' },
  { value: 'client', label: 'Por cliente' },
  { value: 'equipment', label: 'Por equipo' },
  { value: 'part', label: 'Por repuesto' },
];

const emptyFilters = {
  received_from: '',
  received_to: '',
  status: '',
  client: '',
  article: '',
  brand: '',
  part: '',
};

function buildParams(groupBy, filters) {
  const params = { group_by: groupBy };
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params[key] = value;
  });
  return params;
}

// Informes agrupados de servicio tecnico con filtros y exportacion CSV.
export default function InformesTab() {
  const toast = useToast();
  const [groupBy, setGroupBy] = useState('status');
  const [filters, setFilters] = useState(emptyFilters);
  const [statuses, setStatuses] = useState(
    DEFAULT_STATUSES.map((name, index) => ({ id: `default-${index}`, name }))
  );
  const [report, setReport] = useState({ rows: [], totals: null });
  const [loading, setLoading] = useState(false);

  const fetchStatuses = useCallback(async () => {
    try {
      const { data } = await api.get('/repair-catalogs/status');
      if (data.items?.length) setStatuses(data.items);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const generate = useCallback(
    async (nextGroupBy = groupBy, nextFilters = filters) => {
      setLoading(true);
      try {
        const { data } = await api.get('/technical-repairs/reports', {
          params: buildParams(nextGroupBy, nextFilters),
        });
        setReport({ rows: data.rows || [], totals: data.totals || null });
      } catch (error) {
        toast({
          title: 'No se pudo generar el reporte',
          description: error.response?.data?.error,
          status: 'error',
          duration: 4000,
          isClosable: true,
        });
      } finally {
        setLoading(false);
      }
    },
    [groupBy, filters, toast]
  );

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  useEffect(() => {
    generate('status', emptyFilters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExport = async () => {
    try {
      const response = await api.get('/technical-repairs/reports/export', {
        params: buildParams(groupBy, filters),
        responseType: 'blob',
      });
      downloadBlob(response, `reporte-${groupBy}.csv`);
      toast({ title: 'Reporte exportado', status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      toast({
        title: 'No se pudo exportar el reporte',
        description: error.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    }
  };

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return (
    <VStack align="stretch" spacing={4}>
      <Card>
        <CardBody>
          <VStack align="stretch" spacing={4}>
            <Heading size="sm">Informes</Heading>
            <SimpleGrid columns={{ base: 1, md: 3, lg: 4 }} spacing={3}>
              <FormControl>
                <FormLabel>Criterio</FormLabel>
                <Select
                  value={groupBy}
                  onChange={(event) => {
                    const next = event.target.value;
                    setGroupBy(next);
                    generate(next, filters);
                  }}
                >
                  {GROUP_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Recibido desde</FormLabel>
                <Input
                  type="date"
                  value={filters.received_from}
                  onChange={(event) => setFilter('received_from', event.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Recibido hasta</FormLabel>
                <Input
                  type="date"
                  value={filters.received_to}
                  onChange={(event) => setFilter('received_to', event.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Estado</FormLabel>
                <Select
                  value={filters.status}
                  onChange={(event) => setFilter('status', event.target.value)}
                >
                  <option value="">Todos</option>
                  {statuses.map((item) => (
                    <option key={item.id || item.name} value={item.name}>
                      {statusLabel(item.name)}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <FormLabel>Cliente</FormLabel>
                <Input
                  placeholder="Nombre o DNI"
                  value={filters.client}
                  onChange={(event) => setFilter('client', event.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Artículo</FormLabel>
                <Input
                  placeholder="Ej: Notebook"
                  value={filters.article}
                  onChange={(event) => setFilter('article', event.target.value)}
                />
              </FormControl>
              <FormControl>
                <FormLabel>Marca</FormLabel>
                <Input
                  placeholder="Ej: HP"
                  value={filters.brand}
                  onChange={(event) => setFilter('brand', event.target.value)}
                />
              </FormControl>
              {groupBy === 'part' && (
                <FormControl>
                  <FormLabel>Repuesto</FormLabel>
                  <Input
                    placeholder="Nombre del repuesto"
                    value={filters.part}
                    onChange={(event) => setFilter('part', event.target.value)}
                  />
                </FormControl>
              )}
            </SimpleGrid>
            <HStack spacing={2} flexWrap="wrap">
              <Button leftIcon={<FiSearch />} colorScheme="brand" onClick={() => generate()}>
                Generar reporte
              </Button>
              <Button leftIcon={<FiDownload />} variant="outline" onClick={handleExport}>
                Exportar CSV
              </Button>
            </HStack>
          </VStack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          {loading ? (
            <HStack justify="center" py={10}>
              <Spinner />
            </HStack>
          ) : report.rows.length === 0 ? (
            <EmptyState
              icon={FiBarChart2}
              title="Sin datos"
              description="No hay resultados para los filtros seleccionados."
            />
          ) : (
            <ReportTable groupBy={groupBy} rows={report.rows} totals={report.totals} />
          )}
        </CardBody>
      </Card>
    </VStack>
  );
}

function ReportTable({ groupBy, rows, totals }) {
  if (groupBy === 'part') {
    return (
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              <Th>Repuesto</Th>
              <Th>Marca</Th>
              <Th isNumeric>Cantidad usada</Th>
              <Th isNumeric>Boletas</Th>
              <Th isNumeric>Total repuestos</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map((row, index) => (
              <Tr key={`${row.product_id || row.description}-${index}`}>
                <Td>{row.description}</Td>
                <Td>{row.brand || '-'}</Td>
                <Td isNumeric>{row.quantity}</Td>
                <Td isNumeric>{row.repairs}</Td>
                <Td isNumeric>{formatCurrency(row.parts_total)}</Td>
              </Tr>
            ))}
            {totals && (
              <Tr fontWeight="bold">
                <Td>Total</Td>
                <Td />
                <Td isNumeric>{totals.quantity}</Td>
                <Td isNumeric>{totals.repairs}</Td>
                <Td isNumeric>{formatCurrency(totals.parts_total)}</Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>
    );
  }

  const firstColumns =
    groupBy === 'client'
      ? ['Cliente', 'DNI']
      : groupBy === 'equipment'
        ? ['Artículo', 'Marca', 'Modelo']
        : ['Estado'];

  const renderRow = (row, index) => {
    if (groupBy === 'client') {
      return (
        <Tr key={`${row.client_name}-${row.client_id || index}`}>
          <Td>{row.client_name}</Td>
          <Td>{row.client_id || '-'}</Td>
          <Td isNumeric>{row.count}</Td>
          <Td isNumeric>{formatCurrency(row.parts_total)}</Td>
          <Td isNumeric>{formatCurrency(row.labor_total)}</Td>
          <Td isNumeric fontWeight="semibold">{formatCurrency(row.total)}</Td>
        </Tr>
      );
    }
    if (groupBy === 'equipment') {
      return (
        <Tr key={`${row.article}-${row.brand}-${row.model}-${index}`}>
          <Td>{row.article}</Td>
          <Td>{row.brand || '-'}</Td>
          <Td>{row.model || '-'}</Td>
          <Td isNumeric>{row.count}</Td>
          <Td isNumeric>{formatCurrency(row.parts_total)}</Td>
          <Td isNumeric>{formatCurrency(row.labor_total)}</Td>
          <Td isNumeric fontWeight="semibold">{formatCurrency(row.total)}</Td>
        </Tr>
      );
    }
    return (
      <Tr key={`${row.status}-${index}`}>
        <Td>{statusLabel(row.status)}</Td>
        <Td isNumeric>{row.count}</Td>
        <Td isNumeric>{formatCurrency(row.parts_total)}</Td>
        <Td isNumeric>{formatCurrency(row.labor_total)}</Td>
        <Td isNumeric fontWeight="semibold">{formatCurrency(row.total)}</Td>
      </Tr>
    );
  };

  const totalCells =
    groupBy === 'client'
      ? [<Td key="t1">Total</Td>, <Td key="t2" />]
      : groupBy === 'equipment'
        ? [<Td key="t1">Total</Td>, <Td key="t2" />, <Td key="t3" />]
        : [<Td key="t1">Total</Td>];

  return (
    <Box>
      <TableContainer>
        <Table size="sm">
          <Thead>
            <Tr>
              {firstColumns.map((column) => (
                <Th key={column}>{column}</Th>
              ))}
              <Th isNumeric>Cantidad</Th>
              <Th isNumeric>Repuestos</Th>
              <Th isNumeric>Mano de obra</Th>
              <Th isNumeric>Total</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.map(renderRow)}
            {totals && (
              <Tr fontWeight="bold">
                {totalCells}
                <Td isNumeric>{totals.count}</Td>
                <Td isNumeric>{formatCurrency(totals.parts_total)}</Td>
                <Td isNumeric>{formatCurrency(totals.labor_total)}</Td>
                <Td isNumeric>{formatCurrency(totals.total)}</Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </TableContainer>
    </Box>
  );
}
