import { useEffect, useState } from 'react';
import { Container, Heading, SimpleGrid, Spinner, Center, Text, Box, VStack, HStack, Button } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import api from '../api/client';
import ProductCard from '../components/ProductCard';

export default function Services() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/services').then(r => {
      const data = r.data;
      setServices(Array.isArray(data) ? data : (data?.services || []));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <Box>
      <Box
        position="relative"
        overflow="hidden"
        py={{ base: 16, md: 24 }}
        bgGradient="radial-gradient(120% 120% at 50% 0%, rgba(59,130,246,0.14) 0%, rgba(2,6,23,0.98) 100%)"
      >
        <Box
          position="absolute"
          inset={0}
          sx={{
            backgroundImage: 'radial-gradient(circle at 20% 10%, rgba(96,165,250,0.12) 0, transparent 40%), radial-gradient(circle at 80% 0%, rgba(34,211,238,0.1) 0, transparent 35%)',
          }}
        />
        <Container maxW="6xl" position="relative" zIndex={1}>
          <VStack align={{ base: 'center', md: 'start' }} textAlign={{ base: 'center', md: 'left' }} spacing={6}>
            <Heading
              fontSize={{ base: '3rem', md: '4.5rem', lg: '5.5rem' }}
              fontWeight="900"
              letterSpacing="-0.05em"
              textTransform="uppercase"
              sx={{
                backgroundImage: 'linear-gradient(120deg, #f8fafc 0%, #60a5fa 45%, #22d3ee 80%, #a78bfa 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
              }}
            >
              Servicios Técnicos
            </Heading>
            <Text fontSize={{ base: 'lg', md: 'xl' }} color="gray.200" maxW="680px" lineHeight="1.9">
              Armado de PC a medida, reparación, mantenimiento, diagnóstico y soporte especializado. Soluciones rápidas, claras y con garantía.
            </Text>
            <HStack spacing={4} flexWrap="wrap">
              <Button as={RouterLink} to="/contacto" colorScheme="brand" borderRadius="full" px={8} rightIcon={<FiArrowRight />}>
                Solicitar presupuesto
              </Button>
            </HStack>
          </VStack>
        </Container>
      </Box>

      <Container maxW="7xl" py={{ base: 16, md: 24 }}>
        <VStack align="start" spacing={3} mb={12}>
          <Heading size="xl" letterSpacing="-0.02em">Nuestros servicios</Heading>
          <Text color="fg.muted">Seleccioná el servicio para ver detalle, precio y contratarlo.</Text>
        </VStack>
        {loading ? (
          <Center py={20}><Spinner size="xl" color="brand.500" /></Center>
        ) : (
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
            {services.map(s => <ProductCard key={s.id} product={s} type="service" />)}
          </SimpleGrid>
        )}
      </Container>
    </Box>
  );
}
