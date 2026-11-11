import {
  Box,
  Container,
  Heading,
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
import HistoricoTab from '../components/technical-repairs/HistoricoTab';
import ReparacionTab from '../components/technical-repairs/ReparacionTab';
import InformesTab from '../components/technical-repairs/InformesTab';
import KpiCards from '../components/technical-repairs/KpiCards';

// Dashboard de servicio tecnico con Entrada, Historico, Reparacion e Informes.
export default function TechnicalRepairs() {
  const { isTecnico } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [tabIndex, setTabIndex] = useState(0);
  const [editRepair, setEditRepair] = useState(null);
  const [historicoKey, setHistoricoKey] = useState(0);

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

  const handleChanged = useCallback(() => {
    fetchStats();
    setHistoricoKey((k) => k + 1);
  }, [fetchStats]);

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
        <Box>
          <Heading as="h2" size="lg" letterSpacing="-0.02em">
            Servicio Técnico
          </Heading>
          <Text color="fg.muted" fontSize="sm">
            Dashboard de ingreso, historial, reparación e informes de boletas
          </Text>
        </Box>

        <KpiCards stats={stats} loading={statsLoading} />

        <Tabs colorScheme="brand" variant="enclosed" index={tabIndex} onChange={setTabIndex}>
          <TabList overflowX="auto" flexWrap={{ base: 'nowrap', md: 'wrap' }}>
            <Tab>Entrada</Tab>
            <Tab>Histórico de Órdenes</Tab>
            <Tab>Reparación</Tab>
            <Tab>Informes</Tab>
          </TabList>

          <TabPanels>
            <TabPanel px={0} pt={4}>
              <EntradaTab
                onChanged={handleChanged}
                editRepair={editRepair}
                onEditDone={() => setEditRepair(null)}
              />
            </TabPanel>
            <TabPanel px={0} pt={4}>
              <HistoricoTab
                key={historicoKey}
                onChanged={handleChanged}
                onEdit={(repair) => {
                  setEditRepair(repair);
                  setTabIndex(0);
                }}
              />
            </TabPanel>
            <TabPanel px={0} pt={4}>
              <ReparacionTab onChanged={handleChanged} />
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
