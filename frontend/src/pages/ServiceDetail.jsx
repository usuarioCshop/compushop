import { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import {
  Box, Container, Heading, Text, Button, VStack, HStack, Image, Spinner, Center, Badge, Divider, SimpleGrid,
  useToast,
} from '@chakra-ui/react';
import { FiArrowLeft, FiClock, FiCheckCircle } from 'react-icons/fi';
import api from '../api/client';
import { useCart } from '../context/CartContext';
import portada from '../assets/portada.jpg';

const formatPrice = (n) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n);

export default function ServiceDetail() {
  const { id } = useParams();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const { addItem } = useCart();
  const toast = useToast();

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get(`/services/${id}`);
        const data = res.data;
        setService(data?.service || data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const handleAdd = () => {
    if (!service) return;
    addItem(service, 1, 'service');
    toast({
      title: 'Servicio agregado al carrito',
      status: 'success',
      duration: 2000,
      isClosable: true,
      position: 'top-right',
    });
  };

  if (loading) {
    return (
      <Center minH="60vh">
        <Spinner size="xl" color="brand.500" />
      </Center>
    );
  }

  if (!service) {
    return (
      <Container maxW="4xl" py={16} textAlign="center">
        <Heading size="lg" mb={4}>Servicio no encontrado</Heading>
        <Button as={RouterLink} to="/servicios" leftIcon={<FiArrowLeft />} variant="outline" borderRadius="full">
          Volver a servicios
        </Button>
      </Container>
    );
  }

  return (
    <Box>
      <Box
        position="relative"
        overflow="hidden"
        py={{ base: 16, md: 24 }}
      >
        <Box position="absolute" inset={0} zIndex={0}>
          <Image src={portada} alt="" w="100%" h="100%" sx={{ objectFit: 'cover' }} filter="brightness(0.35) contrast(1.1) saturate(1.1)" />
        </Box>
        <Box position="absolute" inset={0} zIndex={1} bgGradient="radial-gradient(120% 120% at 50% 0%, rgba(37,99,235,0.14) 0%, rgba(2,6,23,0.95) 100%)" />
        <Container maxW="6xl" position="relative" zIndex={2}>
          <Button as={RouterLink} to="/servicios" leftIcon={<FiArrowLeft />} variant="ghost" color="white" mb={8} borderRadius="full">
            Volver a servicios
          </Button>
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 10, lg: 16 }} alignItems="center">
            <VStack align={{ base: 'center', lg: 'start' }} textAlign={{ base: 'center', lg: 'left' }} spacing={6}>
              <HStack spacing={3}>
                <Badge colorScheme="brand" borderRadius="full" px={4} py={1}>Servicio técnico</Badge>
                {service.duration && (
                  <HStack color="gray.300" spacing={2}>
                    <FiClock />
                    <Text fontSize="sm">{service.duration}</Text>
                  </HStack>
                )}
              </HStack>
              <Heading
                fontSize={{ base: '3rem', md: '4.5rem', lg: '5rem' }}
                fontWeight="700"
                letterSpacing="-0.04em"
                lineHeight="0.98"
                sx={{
                  backgroundImage: 'linear-gradient(120deg, #f8fafc 0%, var(--chakra-colors-brand-300) 38%, var(--chakra-colors-accent-300) 68%, var(--chakra-colors-accent-400) 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                {service.name}
              </Heading>
              <Text fontSize={{ base: 'lg', md: 'xl' }} color="gray.200" lineHeight="1.9" maxW="560px">
                {service.description}
              </Text>
              <HStack spacing={4} flexWrap="wrap" justify={{ base: 'center', lg: 'start' }}>
                <Button
                  size="lg"
                  borderRadius="full"
                  px={10}
                  bg="brand.600"
                  color="white"
                  _hover={{ bg: 'brand.700', transform: 'translateY(-1px)', boxShadow: 'shadow-cardHover' }}
                  onClick={handleAdd}
                >
                  Contratar servicio
                </Button>
                <Button as={RouterLink} to="/contacto" size="lg" variant="outline" borderRadius="full" px={10} borderColor="whiteAlpha.500" color="whiteAlpha.900" _hover={{ bg: 'whiteAlpha.100', borderColor: 'whiteAlpha.600' }}>
                  Consultar por este servicio
                </Button>
              </HStack>
            </VStack>
            <Box
              bg="bg.surface"
              borderRadius="2xl"
              borderWidth="1px"
              borderColor="border.subtle"
              boxShadow="shadow-cardHover"
              overflow="hidden"
              position="relative"
            >
              <Box position="relative" sx={{ aspectRatio: 4/3 }}>
                <Image src={portada} alt={service.name} w="100%" h="100%" sx={{ objectFit: 'cover' }} />
                <Box position="absolute" inset={0} bgGradient="linear(to-t, rgba(2,6,23,0.9) 0%, transparent 60%)" />
              </Box>
              <VStack align="stretch" spacing={4} p={{ base: 6, md: 8 }}>
                <HStack justify="space-between" align="end">
                  <VStack align="start" spacing={1}>
                    <Text color="fg.muted" fontSize="sm">Precio del servicio</Text>
                    <Text fontSize={{ base: '3rem', md: '4rem' }} fontWeight="900" letterSpacing="-0.04em">
                      {formatPrice(service.price)}
                    </Text>
                  </VStack>
                  {service.duration && (
                    <HStack color="fg.muted" spacing={2}>
                      <FiClock />
                      <Text>Tiempo estimado: {service.duration}</Text>
                    </HStack>
                  )}
                </HStack>
                <Divider borderColor="border.subtle" />
                <VStack align="stretch" spacing={3}>
                  <Text fontWeight="600">Incluye</Text>
                  <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={3}>
                    {['Diagnóstico profesional', 'Componentes originales', 'Garantía por escrito', 'Soporte post-servicio'].map((item) => (
                      <HStack key={item} spacing={3}>
                        <Box as={FiCheckCircle} color="brand.400" boxSize={5} />
                        <Text color="fg.default">{item}</Text>
                      </HStack>
                    ))}
                  </SimpleGrid>
                </VStack>
              </VStack>
            </Box>
          </SimpleGrid>
        </Container>
        <Box position="absolute" bottom={0} left={0} right={0} h="24" bgGradient="linear(to-t, rgba(2,6,23,1), transparent)" zIndex={2} />
      </Box>

      <Box py={{ base: 16, md: 24 }}>
        <Container maxW="6xl">
          <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={{ base: 10, lg: 16 }} alignItems="start">
            <VStack align="stretch" spacing={6}>
              <Heading size="xl" letterSpacing="-0.02em">¿Cómo trabajamos?</Heading>
              <Text color="fg.muted" fontSize="lg" lineHeight="1.9">
                Cada servicio se realiza con metodología profesional, seguimiento claro y total transparencia en el proceso. Te mantenemos informado en cada etapa hasta la entrega.
              </Text>
              <SimpleGrid columns={{ base: 1, sm: 2 }} spacing={4}>
                {[
                  { title: 'Consulta', desc: 'Evaluamos tu necesidad sin costo' },
                  { title: 'Presupuesto', desc: 'Detalle claro con tiempo y costo' },
                  { title: 'Ejecución', desc: 'Trabajo con repuestos certificados' },
                  { title: 'Entrega', desc: 'Pruebas y garantía por escrito' },
                ].map((step, idx) => (
                  <Box key={step.title} p={6} borderRadius="2xl" border="1px solid" borderColor="border.subtle" bg="bg.surface">
                    <HStack spacing={4} align="start">
                      <Box px={3} py={1} borderRadius="full" bg="brand.50" color="brand.700" fontWeight="700" _dark={{ bg: 'whiteAlpha.100', color: 'brand.300' }}>
                        {String(idx + 1).padStart(2, '0')}
                      </Box>
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="600">{step.title}</Text>
                        <Text color="fg.muted" fontSize="sm">{step.desc}</Text>
                      </VStack>
                    </HStack>
                  </Box>
                ))}
              </SimpleGrid>
            </VStack>
            <Box
              borderRadius="2xl"
              borderWidth="1px"
              borderColor="border.subtle"
              bg="bg.surface"
              p={{ base: 8, md: 10 }}
              boxShadow="shadow-card"
            >
              <VStack align="stretch" spacing={6}>
                <Heading size="lg">Listo para contratar</Heading>
                <Text color="fg.muted">
                  Agregalo al carrito o consultanos directamente para coordinar fecha y detalle del servicio.
                </Text>
                <HStack justify="space-between" align="center">
                  <VStack align="start" spacing={0}>
                    <Text color="fg.muted" fontSize="sm">Total estimado</Text>
                    <Text fontSize="2xl" fontWeight="800">{formatPrice(service.price)}</Text>
                  </VStack>
                  <Button colorScheme="brand" borderRadius="full" px={8} onClick={handleAdd}>
                    Agregar al carrito
                  </Button>
                </HStack>
                <Button as={RouterLink} to="/contacto" variant="ghost" borderRadius="full">
                  ¿Tenés dudas? Escribinos
                </Button>
              </VStack>
            </Box>
          </SimpleGrid>
        </Container>
      </Box>
    </Box>
  );
}
