import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Box, Container, Heading, VStack, FormControl, FormLabel, Input, Button, Text, Link,
  useToast, SimpleGrid, FormErrorMessage,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [loading, setLoading] = useState(false);
  const { register: registerUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();

  const bg = 'bg.surface';
  const border = 'border.subtle';
  const muted = 'fg.muted';
  const pageBg = 'bg.canvas';

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerUser(data);
      toast({ title: 'Cuenta creada', status: 'success' });
      navigate('/');
    } catch (err) {
      toast({
        title: 'Error',
        description: err.response?.data?.error || 'No se pudo registrar',
        status: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="calc(100vh - 80px)" bg={pageBg} py={{ base: 10, md: 16 }}>
      <Container maxW="lg">
        <Box bg={bg} p={{ base: 6, md: 8 }} borderRadius="2xl" shadow="lg" borderWidth="1px" borderColor={border}>
          <VStack spacing={1} mb={6} textAlign="center">
            <Heading size="lg">Crear cuenta</Heading>
            <Text fontSize="sm" color={muted}>Registrate para comprar y seguir tus pedidos</Text>
          </VStack>
          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={4}>
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel>Nombre completo</FormLabel>
                <Input {...register('name', { required: 'El nombre es obligatorio' })} size="lg" />
                <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
              </FormControl>
              <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="100%">
                <FormControl isRequired isInvalid={!!errors.email}>
                  <FormLabel>Email</FormLabel>
                  <Input type="email" {...register('email', { required: 'El email es obligatorio', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' } })} size="lg" />
                  <FormErrorMessage>{errors.email?.message}</FormErrorMessage>
                </FormControl>
                <FormControl>
                  <FormLabel>DNI</FormLabel>
                  <Input {...register('dni')} size="lg" placeholder="Para recuperar clave" />
                </FormControl>
              </SimpleGrid>
              <FormControl isRequired isInvalid={!!errors.password}>
                <FormLabel>Contraseña</FormLabel>
                <Input type="password" {...register('password', { required: 'La contraseña es obligatoria', minLength: { value: 6, message: 'Debe tener al menos 6 caracteres' } })} size="lg" />
                <FormErrorMessage>{errors.password?.message}</FormErrorMessage>
              </FormControl>
              <FormControl>
                <FormLabel>Teléfono</FormLabel>
                <Input {...register('phone')} size="lg" />
              </FormControl>
              <FormControl>
                <FormLabel>Dirección</FormLabel>
                <Input {...register('address')} size="lg" />
              </FormControl>
              <Button type="submit" colorScheme="brand" w="100%" size="lg" isLoading={loading}>
                Registrarse
              </Button>
              <Text fontSize="sm" color={muted}>
                ¿Ya tenés cuenta?{' '}
                <Link as={RouterLink} to="/login" color="brand.500" fontWeight="600">Ingresá</Link>
              </Text>
            </VStack>
          </form>
        </Box>
      </Container>
    </Box>
  );
}
