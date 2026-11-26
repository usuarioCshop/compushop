import { Outlet } from 'react-router-dom';
import { Box, Container } from '@chakra-ui/react';
import AdminHorizontalNav from './AdminHorizontalNav';

export default function AdminLayout() {
  return (
    <Box minH="calc(100vh - 64px)" overflowX="hidden">
      <AdminHorizontalNav />
      <Box p={{ base: 4, md: 8 }} overflowX="hidden">
        <Container maxW="6xl" px={0} minW={0}>
          <Outlet />
        </Container>
      </Box>
    </Box>
  );
}
