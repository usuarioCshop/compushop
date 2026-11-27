import { useEffect, useState } from 'react';
import {
  Box, Container, Heading, Text, SimpleGrid, Button, VStack, HStack,
  Spinner, Center, Image, Flex, useColorModeValue,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { FiArrowRight } from 'react-icons/fi';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import portada from '../assets/portada.jpg';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const sectionBg = useColorModeValue('bg.surface', 'bg.canvas');
  const mutedBg = useColorModeValue('bg.subtle', 'bg.surface');

  useEffect(() => {
    async function load() {
      try {
        const [pRes, sRes] = await Promise.all([
          api.get('/products?limit=6'),
          api.get('/services?limit=4'),
        ]);
        const pData = pRes.data;
        const sData = sRes.data;
        setProducts(Array.isArray(pData) ? pData : (pData?.products || []));
        setServices(Array.isArray(sData) ? sData : (sData?.services || []));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <>
      <Helmet>
        <title>Compushop | Casa de computación</title>
        <meta name="description" content="Compushop - Venta de PC, hardware, insumos y servicios técnicos. +20 años de experiencia." />
      </Helmet>
      <Box>
      {/* ===== HERO ===== */}
      <Box
        position="relative"
        minH="calc(100vh - 72px)"
        display="flex"
        alignItems="center"
        overflow="hidden"
      >
        <Box position="absolute" inset={0} zIndex={0}>
          <Image
            src={portada}
            alt=""
            w="100%"
            h="100%"
            sx={{ objectFit: 'cover', objectPosition: 'center' }}
            filter="brightness(0.38) contrast(1.08) saturate(1.15)"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        </Box>
        <Box
          position="absolute"
          inset={0}
          zIndex={1}
          bgGradient="linear(to-r, rgba(7,11,20,0.92) 0%, rgba(15,23,42,0.78) 45%, rgba(15,23,42,0.45) 100%)"
        />
        <Box
          position="absolute"
          inset={0}
          zIndex={1}
          bgGradient="linear(to-t, rgba(2,6,23,0.72) 0%, rgba(2,6,23,0.1) 45%, rgba(2,6,23,0.2) 100%)"
        />
        <Container maxW="6xl" position="relative" zIndex={2} px={{ base: 6, md: 8 }} py={{ base: 20, md: 28 }}>
          <VStack align={{ base: 'center', md: 'start' }} textAlign={{ base: 'center', md: 'left' }} spacing={7} maxW="3xl">
            <Text
              fontSize="xs"
              fontWeight="600"
              letterSpacing="0.16em"
              textTransform="uppercase"
              color="whiteAlpha.800"
            >
              Venta, servicio técnico y asesoramiento
            </Text>
            <Heading
              as="h1"
              fontSize={{ base: '3.25rem', sm: '4.5rem', md: '5.5rem', lg: '6.5rem' }}
              fontWeight="800"
              letterSpacing="-0.04em"
              lineHeight="0.98"
              bgGradient="gradient-hero-text"
              bgClip="text"
              color="transparent"
              sx={{ fontFamily: "'Sora', 'Inter', system-ui, sans-serif" }}
            >
              Tecnología para trabajar, jugar y crear
            </Heading>
            <Text
              fontSize={{ base: 'md', md: 'lg' }}
              color="gray.200"
              maxW="620px"
              lineHeight="1.8"
            >
              Notebooks, PCs, componentes, insumos de oficina y servicio técnico especializado. Te ayudamos a elegir, armar y mantener tu equipo con criterio.
            </Text>
            <HStack justify={{ base: 'center', md: 'start' }} spacing={4} flexWrap="wrap">
              <Button
                as={RouterLink}
                to="/productos"
                size="lg"
                borderRadius="full"
                px={8}
                bg="brand.600"
                color="white"
                _hover={{ bg: 'brand.700', transform: 'translateY(-1px)', boxShadow: 'shadow-cardHover' }}
                rightIcon={<FiArrowRight />}
              >
                Ver productos
              </Button>
              <Button
                as={RouterLink}
                to="/servicios"
                size="lg"
                variant="outline"
                borderRadius="full"
                px={8}
                borderColor="whiteAlpha.500"
                color="whiteAlpha.900"
                _hover={{ bg: 'whiteAlpha.100', borderColor: 'whiteAlpha.700' }}
              >
                Ver servicios
              </Button>
            </HStack>
            <HStack
              spacing={{ base: 4, md: 8 }}
              pt={4}
              flexWrap="wrap"
              justify={{ base: 'center', md: 'start' }}
              divider={<Box w="1px" h="32px" bg="whiteAlpha.300" display={{ base: 'none', sm: 'block' }} />}
            >
              {[
                { value: '20+ años', label: 'de experiencia' },
                { value: '1500+ clientes', label: 'atendidos' },
                { value: 'Garantía', label: 'y servicio post-venta' },
              ].map((item) => (
                <Box key={item.label}>
                  <Text fontSize="sm" fontWeight="700" color="white" letterSpacing="-0.01em">
                    {item.value}
                  </Text>
                  <Text fontSize="sm" color="gray.300">
                    {item.label}
                  </Text>
                </Box>
              ))}
            </HStack>
          </VStack>
        </Container>
      </Box>

      {/* ===== SOBRE NOSOTROS ===== */}
      <Box bg={sectionBg} borderTop="1px solid" borderBottom="1px solid" borderColor="border.subtle" py={{ base: 16, md: 24 }}>
        <Container maxW="6xl">
          <SimpleGrid columns={{ base: 1, md: 2 }} spacing={{ base: 10, md: 16 }} alignItems="start">
            <VStack align={{ base: 'start', md: 'start' }} spacing={5}>
              <Text fontSize="xs" fontWeight="600" letterSpacing="0.14em" textTransform="uppercase" color="brand.600" _dark={{ color: 'brand.300' }}>
                Sobre Compushop
              </Text>
              <Heading size="xl" fontWeight="700" letterSpacing="-0.02em" lineHeight="1.2">
                Equipos, insumos y soporte técnico en un mismo lugar
              </Heading>
              <Text color="fg.muted" fontSize="md" lineHeight="1.8">
                Trabajamos con notebooks, PCs, componentes, muebles de oficina e insumos. Te asesoramos para que compres lo que necesitás y acompañamos con servicio técnico cuando tu equipo lo requiere.
              </Text>
              <Button as={RouterLink} to="/contacto" colorScheme="brand" borderRadius="full" size="md" px={6}>
                Hablar con el equipo
              </Button>
            </VStack>
            <SimpleGrid columns={1} spacing={4}>
              {[
                { title: 'Asesoramiento claro', text: 'Te ayudamos a elegir según uso, presupuesto y compatibilidad.' },
                { title: 'Servicio técnico', text: 'Diagnóstico, reparación y mantenimiento con seguimiento.' },
                { title: 'Soluciones para oficina', text: 'Equipos, periféricos e insumos para trabajar sin fricción.' },
              ].map((item) => (
                <Box key={item.title} p={5} bg="bg.canvas" borderWidth="1px" borderColor="border.subtle" borderRadius="lg">
                  <Text fontWeight="600" mb={1}>{item.title}</Text>
                  <Text color="fg.muted" fontSize="sm" lineHeight="1.7">{item.text}</Text>
                </Box>
              ))}
            </SimpleGrid>
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== CATÁLOGO ===== */}
      <Box bg={mutedBg} py={{ base: 16, md: 24 }}>
        <Container maxW="7xl">
          <VStack spacing={3} mb={12} textAlign="center">
            <Heading size="xl" fontWeight="700" letterSpacing="-0.02em">Catálogo de productos</Heading>
            <Text color="fg.muted" maxW="md">
              Equipamiento seleccionado para profesionales, gamers y oficinas.
            </Text>
          </VStack>
          {loading ? (
            <Center py={10}><Spinner size="xl" color="brand.500" /></Center>
          ) : (
            <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} spacing={6}>
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </SimpleGrid>
          )}
          <Center mt={12}>
            <Button as={RouterLink} to="/productos" variant="outline" borderRadius="full" size="md" px={6}>
              Ver todo el catálogo
            </Button>
          </Center>
        </Container>
      </Box>

      {/* ===== BANNER DESCUENTO ===== */}
      <Box
        py={{ base: 12, md: 16 }}
        position="relative"
        overflow="hidden"
        bgGradient="gradient-brand"
      >
        <Box
          position="absolute"
          inset={0}
          opacity={0.12}
          bgImage="radial-gradient(circle at top right, white 0%, transparent 60%)"
        />
        <Container maxW="4xl" textAlign="center" position="relative" zIndex={1}>
          <Heading size="lg" color="white" mb={3} fontWeight="700">
            ¡Aprovechá un 15% de descuento en tu primera compra!
          </Heading>
          <Text color="whiteAlpha.900" mb={6}>
            Registrate y obtené beneficios exclusivos en productos y servicios técnicos.
          </Text>
          <Button
            as={RouterLink}
            to="/registro"
            bg="white"
            color="blue.800"
            borderRadius="full"
            size="md"
            px={6}
            _hover={{ bg: 'gray.100' }}
          >
            Registrarme ahora
          </Button>
        </Container>
      </Box>

      {/* ===== SERVICIOS ===== */}
      <Box bg={sectionBg} py={{ base: 16, md: 24 }}>
        <Container maxW="7xl">
          <VStack spacing={3} mb={12} textAlign="center">
            <Heading size="xl" fontWeight="700" letterSpacing="-0.02em">Servicios técnicos</Heading>
            <Text color="fg.muted">Armado, reparación, mantenimiento y más.</Text>
          </VStack>
          <SimpleGrid columns={{ base: 1, sm: 2, lg: 4 }} spacing={6}>
            {services.map((s) => (
              <ProductCard key={s.id} product={s} type="service" />
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== CTA FINAL ===== */}
      <Box py={{ base: 16, md: 24 }}>
        <Container maxW="5xl">
          <Box
            bg="bg.surface"
            borderWidth="1px"
            borderColor="border.subtle"
            borderRadius="2xl"
            p={{ base: 8, md: 12 }}
            boxShadow="shadow-card"
          >
            <Flex direction={{ base: 'column', md: 'row' }} align={{ base: 'start', md: 'center' }} justify="space-between" gap={6}>
              <Box maxW="2xl">
                <Heading size="lg" mb={3} fontWeight="700" letterSpacing="-0.02em">
                  ¿Necesitás ayuda para elegir o reparar tu equipo?
                </Heading>
                <Text color="fg.muted" lineHeight="1.8">
                  Contanos qué necesitás y te asesoramos con una recomendación clara, sea para comprar, armar o hacer servicio técnico.
                </Text>
              </Box>
              <Button as={RouterLink} to="/contacto" colorScheme="brand" size="lg" borderRadius="full" px={8} flexShrink={0}>
                Contactar
              </Button>
            </Flex>
          </Box>
        </Container>
      </Box>
      </Box>
    </>
  );
}
