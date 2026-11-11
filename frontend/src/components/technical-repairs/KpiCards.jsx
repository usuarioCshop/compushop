import { Card, CardBody, SimpleGrid, Skeleton, Stat, StatLabel, StatNumber } from '@chakra-ui/react';
import { formatCurrency } from './constants';

// Tarjetas de indicadores del dashboard de servicio tecnico.
export default function KpiCards({ stats, loading }) {
  const cards = [
    { label: 'Boletas', value: stats?.total ?? 0 },
    { label: 'Pendientes', value: stats?.pendientes ?? 0 },
    { label: 'En proceso', value: stats?.en_proceso ?? 0 },
    {
      label: 'Reparadas / entregadas',
      value: (stats?.reparados ?? 0) + (stats?.entregados ?? 0),
    },
    { label: 'Ingresos del mes', value: formatCurrency(stats?.month_income ?? 0) },
  ];

  return (
    <SimpleGrid columns={{ base: 2, md: 5 }} spacing={3} mb={6}>
      {cards.map((card) => (
        <Card key={card.label}>
          <CardBody py={4}>
            <Stat size="sm">
              <StatLabel fontSize="xs" color="fg.muted">
                {card.label}
              </StatLabel>
              {loading ? (
                <Skeleton height="32px" mt={2} />
              ) : (
                <StatNumber fontSize={{ base: 'lg', md: '2xl' }}>{card.value}</StatNumber>
              )}
            </Stat>
          </CardBody>
        </Card>
      ))}
    </SimpleGrid>
  );
}
