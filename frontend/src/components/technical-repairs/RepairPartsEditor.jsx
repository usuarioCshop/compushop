import {
  Button,
  FormControl,
  FormLabel,
  Grid,
  HStack,
  Icon,
  IconButton,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Select,
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
import { useState } from 'react';
import { FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi';
import api from '../../api/client';
import { formatCurrency } from './constants';

// Devuelve el stock maximo que puede tener una linea: el stock actual del
// producto mas lo que esta misma boleta ya tenia descontado.
function availableStock(line) {
  return Number(line.product_stock || 0) + Number(line.original_quantity || 0);
}

function lineSubtotal(line) {
  return Number(line.quantity || 0) * Number(line.unit_price || 0);
}

// Editor de repuestos usados en una reparacion. El catalogo son productos
// reales con stock; al guardar, el backend descuenta el stock.
export default function RepairPartsEditor({
  parts,
  onChange,
  catalog,
  catalogLoading,
  onSearch,
  disabled,
}) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPart, setNewPart] = useState({ name: '', brand: '', price: '', stock: '' });

  const handleSearch = () => {
    onSearch(search.trim());
  };

  const updateLine = (productId, field, value) => {
    onChange(
      parts.map((line) =>
        line.product_id === productId ? { ...line, [field]: value } : line
      )
    );
  };

  const removeLine = (productId) => {
    onChange(parts.filter((line) => line.product_id !== productId));
  };

  const addSelected = () => {
    const product = catalog.find((item) => String(item.id) === String(selectedId));
    if (!product) return;

    const existing = parts.find((line) => line.product_id === product.id);
    if (existing) {
      const max = availableStock(existing);
      const nextQuantity = Math.min(Number(existing.quantity || 0) + 1, max);
      updateLine(product.id, 'quantity', nextQuantity);
    } else {
      onChange([
        ...parts,
        {
          product_id: product.id,
          product_name: product.name,
          product_stock: product.stock,
          original_quantity: 0,
          quantity: 1,
          unit_price: product.price,
        },
      ]);
    }

    setSelectedId('');
  };

  const handleCreatePart = async () => {
    const name = String(newPart.name || '').trim();
    const price = Number(newPart.price);
    const stock = Number(newPart.stock);
    if (!name) {
      toast({ title: 'Falta el nombre', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast({ title: 'Precio inválido', description: 'Ingresá un precio válido (>= 0).', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    if (!Number.isInteger(stock) || stock < 0) {
      toast({ title: 'Stock inválido', description: 'Ingresá un stock entero (>= 0).', status: 'warning', duration: 3000, isClosable: true });
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post('/technical-repairs/parts-catalog', {
        name,
        brand: newPart.brand?.trim() || undefined,
        price,
        stock,
      });
      const product = data.product;
      onSearch(name); // refresca catálogo con el nombre creado
      onChange([
        ...parts,
        {
          product_id: product.id,
          product_name: product.name,
          product_stock: product.stock,
          original_quantity: 0,
          quantity: 1,
          unit_price: product.price,
        },
      ]);
      setSelectedId(String(product.id));
      setNewPart({ name: '', brand: '', price: '', stock: '' });
      setCreateOpen(false);
      toast({ title: 'Repuesto creado', description: product.name, status: 'success', duration: 3000, isClosable: true });
    } catch (error) {
      toast({
        title: 'No se pudo crear el repuesto',
        description: error.response?.data?.error || 'Error al crear producto/repuesto',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <VStack align="stretch" spacing={3}>
      <HStack justify="space-between" align="baseline" flexWrap="wrap" gap={2}>
        <Text fontWeight="semibold">Repuestos usados</Text>
        <Text fontSize="sm" color="fg.muted">
          Se descuentan del stock del catálogo al guardar
        </Text>
      </HStack>

      <HStack spacing={2} flexWrap="wrap">
        <Input
          placeholder="Buscar repuesto por nombre o marca"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              handleSearch();
            }
          }}
          isDisabled={disabled}
          maxW={{ base: 'full', md: '320px' }}
        />
        <Button
          leftIcon={<Icon as={FiSearch} />}
          onClick={handleSearch}
          isDisabled={disabled || catalogLoading}
          variant="outline"
        >
          Buscar
        </Button>
      </HStack>

      <FormControl isDisabled={disabled || catalogLoading}>
        <FormLabel fontSize="sm">Agregar del catálogo</FormLabel>
        <HStack spacing={2} flexWrap="wrap">
          <Select
            placeholder={
              catalog.length === 0 ? 'Sin productos con stock (buscá o creá uno)' : 'Elegí un producto'
            }
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            maxW={{ base: 'full', md: '460px' }}
            isDisabled={disabled || catalogLoading || catalog.length === 0}
          >
            {catalog.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
                {product.brand ? ` — ${product.brand}` : ''} — stock: {product.stock} —{' '}
                {formatCurrency(product.price)}
              </option>
            ))}
          </Select>
          <Button
            leftIcon={<Icon as={FiPlus} />}
            onClick={addSelected}
            isDisabled={!selectedId || disabled || catalogLoading}
          >
            Agregar
          </Button>
          <Button
            variant="outline"
            leftIcon={<Icon as={FiPlus} />}
            onClick={() => setCreateOpen(true)}
            isDisabled={disabled}
          >
            Crear repuesto
          </Button>
          {catalogLoading && <Spinner size="sm" />}
        </HStack>
      </FormControl>

      {parts.length === 0 ? (
        <Text fontSize="sm" color="fg.muted">
          Todavía no cargaste repuestos para esta boleta.
        </Text>
      ) : (
        <TableContainer>
          <Table size="sm">
            <Thead>
              <Tr>
                <Th>Producto</Th>
                <Th isNumeric>Cantidad</Th>
                <Th isNumeric>Precio unitario</Th>
                <Th isNumeric>Subtotal</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {parts.map((line) => {
                const max = availableStock(line);
                const exceeds = Number(line.quantity || 0) > max;

                return (
                  <Tr key={line.product_id}>
                    <Td>
                      <Text fontWeight="medium">{line.product_name}</Text>
                      <Text fontSize="xs" color={exceeds ? 'red.500' : 'fg.muted'}>
                        Stock disponible: {max}
                        {exceeds ? ' — te pasaste' : ''}
                      </Text>
                    </Td>
                    <Td isNumeric>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        size="sm"
                        width="90px"
                        textAlign="right"
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(
                            line.product_id,
                            'quantity',
                            event.target.value === '' ? '' : Number(event.target.value)
                          )
                        }
                        isDisabled={disabled}
                      />
                    </Td>
                    <Td isNumeric>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        size="sm"
                        width="130px"
                        textAlign="right"
                        value={line.unit_price}
                        onChange={(event) =>
                          updateLine(
                            line.product_id,
                            'unit_price',
                            event.target.value === '' ? '' : Number(event.target.value)
                          )
                        }
                        isDisabled={disabled}
                      />
                    </Td>
                    <Td isNumeric fontWeight="medium">
                      {formatCurrency(lineSubtotal(line))}
                    </Td>
                    <Td isNumeric>
                      <IconButton
                        aria-label="Quitar repuesto"
                        icon={<Icon as={FiTrash2} />}
                        size="sm"
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => removeLine(line.product_id)}
                        isDisabled={disabled}
                      />
                    </Td>
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} size="md">
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Crear producto/repuesto</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <VStack spacing={3} align="stretch">
              <Text fontSize="sm" color="fg.muted">Se creará un producto activo disponible para usar como repuesto en la reparación.</Text>
              <FormControl isRequired>
                <FormLabel>Nombre</FormLabel>
                <Input value={newPart.name} onChange={(e) => setNewPart({ ...newPart, name: e.target.value })} placeholder="Ej: Batería iPhone 11" />
              </FormControl>
              <FormControl>
                <FormLabel>Marca</FormLabel>
                <Input value={newPart.brand} onChange={(e) => setNewPart({ ...newPart, brand: e.target.value })} placeholder="Opcional" />
              </FormControl>
              <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
                <FormControl isRequired>
                  <FormLabel>Precio (ARS)</FormLabel>
                  <Input type="number" min={0} step="0.01" value={newPart.price} onChange={(e) => setNewPart({ ...newPart, price: e.target.value })} />
                </FormControl>
                <FormControl isRequired>
                  <FormLabel>Stock</FormLabel>
                  <Input type="number" min={0} step="1" value={newPart.stock} onChange={(e) => setNewPart({ ...newPart, stock: e.target.value })} />
                </FormControl>
              </Grid>
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button colorScheme="brand" isLoading={creating} onClick={handleCreatePart}>Crear y agregar</Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </VStack>
  );
}
