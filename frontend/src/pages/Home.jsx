import { useEffect, useState } from 'react';
import {
  Box, Container, Heading, Text, SimpleGrid, Button, VStack, HStack,
  Spinner, Center, Image, Flex, useColorModeValue,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiArrowRight, FiZap } from 'react-icons/fi';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import portada from '../assets/portada.jpg';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const sectionBg = useColorModeValue('white', 'bg.canvas');
  const mutedBg = useColorModeValue('gray.50', 'bg.surface');
  const gradientHero = useColorModeValue(
    'linear(to-b, rgba(15,23,42,0.02), rgba(15,23,42,0.08))',
    'linear(to-b, rgba(2,6,23,0.4), rgba(2,6,23,0.9))'
  );
  const bannerGradient = useColorModeValue(
    'linear(90deg, #2563eb 0%, #1d4ed8 100%)',
    'linear(90deg, #1e40af 0%, #1e3a8a 100%)'
  );

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
            filter="brightness(0.4) contrast(1.1) saturate(1.2)"
          />
        </Box>
        <Box
          position="absolute"
          inset={0}
          zIndex={1}
          bgGradient="radial-gradient(120% 120% at 50% 0%, rgba(59,130,246,0.18) 0%, rgba(15,23,42,0.9) 55%, rgba(2,6,23,0.98) 100%)"
        />
        <Box
          position="absolute"
          inset={0}
          zIndex={1}
          sx={{
            backgroundImage: 'radial-gradient(circle at 20% 20%, rgba(96,165,250,0.12) 0, transparent 40%), radial-gradient(circle at 80% 0%, rgba(34,211,238,0.12) 0, transparent 35%)',
          }}
        />
        <Container maxW="6xl" position="relative" zIndex={2} px={{ base: 6, md: 8 }} py={{ base: 24, md: 32 }}>
          <VStack align={{ base: 'center', md: 'start' }} textAlign={{ base: 'center', md: 'left' }} spacing={8} maxW="3xl">
            <HStack
              spacing={2}
              px={4}
              py={1.5}
              borderRadius="full"
              border="1px solid"
              borderColor="rgba(96,165,250,0.5)"
              bg="rgba(59,130,246,0.16)"
              backdropFilter="blur(12px)"
              color="blue.200"
              fontSize="sm"
              fontWeight="500"
              letterSpacing="0.02em"
              textTransform="uppercase"
            >
              <Box as={FiZap} boxSize={4} />
              <Text>Soluciones tecnológicas a medida</Text>
            </HStack>
            <Heading
              as="h1"
              fontSize={{ base: '4rem', sm: '5rem', md: '6rem', lg: '7rem' }}
              fontWeight="900"
              letterSpacing="-0.06em"
              lineHeight="0.95"
              textTransform="uppercase"
              sx={{
                backgroundImage: 'linear-gradient(120deg, #f8fafc 0%, #60a5fa 40%, #22d3ee 70%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 40px 120px rgba(59,130,246,0.28))',
              }}
            >
              Tecnología Nítida
            </Heading>
            <Text
              fontSize={{ base: 'lg', md: 'xl' }}
              color="gray.200"
              maxW="640px"
              lineHeight="1.9"
              fontWeight="400"
            >
              Notebooks, PCs, componentes, insumos de oficina y servicio técnico especializado. Precisión, honestidad y asesoramiento experto para que tu tecnología siempre funcione al máximo.
            </Text>
            <HStack justify={{ base: 'center', md: 'start' }} spacing={4} flexWrap="wrap">
              <Button
                as={RouterLink}
                to="/productos"
                size="lg"
                borderRadius="full"
                px={10}
                bgGradient="linear(to-r, #2563eb, #22d3ee)"
                color="white"
                _hover={{ bgGradient: 'linear(to-r, #3b82f6, #38bdf8)', boxShadow: '0 20px 60px -20px rgba(59,130,246,0.9)' }}
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
                px={10}
                borderColor="rgba(148,163,184,0.6)"
                color="gray.100"
                _hover={{ bg: 'whiteAlpha.100', borderColor: 'rgba(226,232,240,0.9)' }}
              >
                Ver servicios
              </Button>
            </HStack>
            <HStack spacing={{ base: 6, md: 10 }} pt={6} flexWrap="wrap" justify={{ base: 'center', md: 'start' }}>
              {[
                { value: '20+', label: 'Años de experiencia' },
                { value: '1500+', label: 'Clientes satisfechos' },
                { value: 'Garantía', label: 'Servicio post-venta' },
              ].map((item) => (
                <VStack key={item.label} align={{ base: 'center', md: 'start' }} spacing={1}>
                  <Text fontSize={{ base: '2xl', md: '3xl' }} fontWeight="800" letterSpacing="-0.02em" color="white">
                    {item.value}
                  </Text>
                  <Text fontSize="sm" color="gray.400" textTransform="uppercase" letterSpacing="0.12em">
                    {item.label}
                  </Text>
                </VStack>
              ))}
            </HStack>
          </VStack>
        </Container>
        <Box position="absolute" bottom={0} left={0} right={0} h="24" bgGradient="linear(to-t, rgba(2,6,23,1), transparent)" zIndex={2} />
      </Box>

      {/* ===== SOBRE NOSOTROS ===== */}
      <Box bg={sectionBg} borderTop="1px solid" borderBottom="1px solid" borderColor="border.subtle" py={{ base: 16, md: 24 }}>
        <Container maxW="6xl">
          <Flex direction={{ base: 'column', md: 'row' }} gap={{ base: 10, md: 16 }} align="center">
            <Box flex="1" borderRadius="2xl" overflow="hidden" border="1px solid" borderColor="border.subtle" boxShadow="lg">
              <Image src={portada} alt="Espacio de trabajo Compushop" w="100%" h="100%" sx={{ objectFit: 'cover' }} />
            </Box>
            <VStack align={{ base: 'center', md: 'start' }} spacing={5} flex="1" textAlign={{ base: 'center', md: 'left' }}>
              <Heading size="xl" fontWeight="700" letterSpacing="-0.02em">
                Nuestra pasión por la tecnología
              </Heading>
              <Text color="fg.muted" fontSize="md" lineHeight="1.8">
                En Compushop ofrecemos soluciones de calidad en notebooks, PCs, componentes,
                muebles de oficina e insumos. Nuestro equipo técnico está capacitado para
                resolver cualquier necesidad de tu equipo o tu empresa.
              </Text>
              <Text color="fg.muted" lineHeight="1.8">
                Creemos en la honestidad y el compromiso: cada producto y servicio refleja
                nuestra dedicación a tu satisfacción.
              </Text>
              <Button as={RouterLink} to="/contacto" colorScheme="brand" borderRadius="full" size="md" px={6}>
                Contáctanos
              </Button>
            </VStack>
          </Flex>
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
        bgGradient={bannerGradient}
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

      {/* ===== STATS ===== */}
      <Box bg={mutedBg} borderTop="1px solid" borderBottom="1px solid" borderColor="border.subtle" py={{ base: 12, md: 16 }}>
        <Container maxW="5xl">
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={8} textAlign="center">
            {[
              { n: '1.500+', l: 'Clientes satisfechos' },
              { n: '300+', l: 'Productos disponibles' },
              { n: '20+', l: 'Años de experiencia' },
            ].map((s) => (
              <Box key={s.l}>
                <Heading
                  fontSize={{ base: '3rem', md: '3.5rem' }}
                  fontWeight="800"
                  letterSpacing="-0.03em"
                  sx={{
                    backgroundImage: 'linear-gradient(135deg, var(--chakra-colors-brand-400), var(--chakra-colors-accent-400))',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {s.n}
                </Heading>
                <Text color="fg.muted" fontSize="md" mt={2}>
                  {s.l}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </Container>
      </Box>

      {/* ===== CTA FINAL ===== */}
      <Box py={{ base: 16, md: 24 }}>
        <Container maxW="4xl">
          <Box
            bg="bg.surface"
            border="2px solid"
            borderColor="rgba(59,130,246,0.35)"
            borderRadius="2xl"
            p={{ base: 8, md: 12 }}
            textAlign="center"
            sx={{
              boxShadow: '0 0 0 2px rgba(59,130,246,0.18), 0 20px 60px -20px rgba(59,130,246,0.55)',
            }}
          >
            <Heading size="lg" mb={3} fontWeight="700">
              ¿Necesitás asesoramiento?
            </Heading>
            <Text mb={6} color="fg.muted" maxW="md" mx="auto">
              Contactanos y te ayudamos a armar la solución ideal para vos o tu empresa.
            </Text>
            <Button as={RouterLink} to="/contacto" colorScheme="brand" size="md" borderRadius="full" px={6}>
              Contáctanos Ahora
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
