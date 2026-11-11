import {
  Box,
  Container,
  Heading,
  HStack,
  Spinner,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  VStack,
  useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import EntradaTab from '../components/technical-repairs/EntradaTab';
import ReparacionTab from '../components/technical-repairs/ReparacionTab';
import InformesTab from '../components/technical-repairs/InformesTab';
import KpiCards from '../components/technical-repairs/KpiCards';

// Dashboard de servicio tecnico con Entrada, Reparacion e Informes.
export default function TechnicalRepairs() {
  const { isTecnico } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/technical-repairs/stats');
      setStats(data.stats || null);
    } catch (error) {
      toast({
        title: 'No se pudieron cargar los indicadores',
        description: error.response?.data?.error,
        status: 'error',
        duration: 4000,
        isClosable: true,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (isTecnico) fetchStats();
  }, [isTecnico, fetchStats]);

  if (!isTecnico) {
    return (
      <Container maxW="4xl" py={20} textAlign="center">
        <Text fontSize="lg" color="fg.muted">
          No tenés permisos para acceder a Servicio Técnico.
        </Text>
      </Container>
    );
  }

  return (
    <Container maxW="9xl" py={6} px={4}>
      <VStack align="stretch" spacing={5}>
        <HStack justify="space-between" align="start" flexWrap="wrap" gap={3}>
          <Box>
            <Heading as="h2" size="lg" letterSpacing="-0.02em">
              Servicio Técnico
            </Heading>
            <Text color="fg.muted" fontSize="sm">
              Dashboard de ingreso, reparación e informes de boletas
            </Text>
          </Box>
        </HStack>

        <KpiCards stats={stats} loading={statsLoading} />

        <Tabs colorScheme="brand" variant="enclosed" isLazy>
          <TabList overflowX="auto" flexWrap={{ base: 'nowrap', md: 'wrap' }}>
            <Tab>Entrada</Tab>
            <Tab>Reparación</Tab>
            <Tab>Informes</Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0} pt={4}>
              <EntradaTab onChanged={fetchStats} />
            </TabPanel>
            <TabPanel px={0} pt={4}>
              <ReparacionTab onChanged={fetchStats} />
            </TabPanel>
            <TabPanel px={0} pt={4}>
              <InformesTab />
            </TabPanel>
          </TabPanels>
        </Tabs>
      </VStack>
    </Container>
  );
}
