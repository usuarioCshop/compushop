import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Box, Container, Heading, VStack, FormControl, FormLabel, Input, Button, Text, Link,
  useToast, useColorModeValue, InputGroup, InputRightElement, IconButton, FormErrorMessage,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || '/';
  const { register, handleSubmit, formState: { errors } } = useForm();

  const bg = 'bg.surface';
  const border = 'border.subtle';
  const muted = 'fg.muted';
  const pageBg = 'bg.canvas';

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const res = await login(data.email.trim(), data.password);
      toast({
        title: `Bienvenido, ${res.user.name.split(' ')[0]}`,
        status: 'success',
        duration: 2000,
        isClosable: true,
      });
      const dest = ['admin', 'superadmin'].includes(res.user.role) ? '/admin' : from;
      navigate(dest, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Credenciales inválidas';
      toast({ title: 'Error al ingresar', description: msg, status: 'error', duration: 4000, isClosable: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box minH="calc(100vh - 80px)" bg={pageBg} py={{ base: 10, md: 16 }}>
      <Container maxW="md">
        <Box
          bg={bg}
          p={{ base: 6, md: 8 }}
          borderRadius="2xl"
          shadow="lg"
          borderWidth="1px"
          borderColor={border}
        >
          <VStack spacing={1} mb={6} textAlign="center">
            <Heading size="lg">Ingresar</Heading>
            <Text fontSize="sm" color={muted}>
              Accedé con tu cuenta Compushop
            </Text>
          </VStack>

          <form onSubmit={handleSubmit(onSubmit)}>
            <VStack spacing={4}>
              <FormControl isInvalid={!!errors.email}>
                <FormLabel>Email</FormLabel>
                <Input
                  type="email"
                  {...register('email', {
                    required: 'El email es obligatorio',
                    pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' },
                  })}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  size="lg"
                />
                <FormErrorMessage>{errors.email?.message}</FormErrorMessage>
              </FormControl>

              <FormControl isInvalid={!!errors.password}>
                <FormLabel>Contraseña</FormLabel>
                <InputGroup size="lg">
                  <Input
                    type={showPass ? 'text' : 'password'}
                    {...register('password', { required: 'La contraseña es obligatoria' })}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <InputRightElement>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      aria-label={showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      icon={showPass ? <FiEyeOff /> : <FiEye />}
                      onClick={() => setShowPass((v) => !v)}
                    />
                  </InputRightElement>
                </InputGroup>
                <FormErrorMessage>{errors.password?.message}</FormErrorMessage>
              </FormControl>

              <Button
                type="submit"
                colorScheme="brand"
                w="100%"
                size="lg"
                isLoading={loading}
                loadingText="Ingresando..."
              >
                Ingresar
              </Button>

              <Text fontSize="sm" color={muted}>
                <Link as={RouterLink} to="/recuperar-clave" color="brand.500" fontWeight="600">
                  ¿Olvidaste tu clave?
                </Link>
              </Text>
              <Text fontSize="sm" color={muted}>
                ¿No tenés cuenta?{' '}
                <Link as={RouterLink} to="/registro" color="brand.500" fontWeight="600">
                  Registrate
                </Link>
              </Text>
            </VStack>
          </form>

        </Box>
      </Container>
    </Box>
  );
}
