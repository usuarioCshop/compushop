import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  Box, Container, Heading, VStack, FormControl, FormLabel, Input, Textarea, Button, useToast, Text, SimpleGrid, FormErrorMessage,
} from '@chakra-ui/react';
import api from '../api/client';

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const bg = 'bg.surface';
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const { data: res } = await api.post('/contact', data);
      toast({ title: res.message, status: 'success', duration: 4000 });
      reset();
    } catch (err) {
      toast({ title: 'Error', description: err.response?.data?.error || 'No se pudo enviar', status: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxW="5xl" py={12}>
      <Heading mb={2}>Contacto</Heading>
      <Text color="fg.muted" mb={8}>Escribinos y te respondemos a la brevedad.</Text>
      <SimpleGrid columns={{ base: 1, md: 2 }} spacing={8} alignItems="start">
        <Box bg={bg} p={8} borderRadius="xl" borderWidth="1px" shadow="sm">
          <form onSubmit={handleSubmit(onSubmit)}>
          <VStack spacing={4}>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="100%">
              <FormControl isRequired isInvalid={!!errors.name}>
                <FormLabel>Nombre</FormLabel>
                <Input {...register('name', { required: 'El nombre es obligatorio' })} />
                <FormErrorMessage>{errors.name?.message}</FormErrorMessage>
              </FormControl>
              <FormControl isRequired isInvalid={!!errors.email}>
                <FormLabel>Email</FormLabel>
                <Input type="email" {...register('email', { required: 'El email es obligatorio', pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Email inválido' } })} />
                <FormErrorMessage>{errors.email?.message}</FormErrorMessage>
              </FormControl>
            </SimpleGrid>
            <SimpleGrid columns={{ base: 1, md: 2 }} spacing={4} w="100%">
              <FormControl>
                <FormLabel>Teléfono</FormLabel>
                <Input {...register('phone')} />
              </FormControl>
              <FormControl>
                <FormLabel>Asunto</FormLabel>
                <Input {...register('subject')} />
              </FormControl>
            </SimpleGrid>
            <FormControl isRequired isInvalid={!!errors.message}>
              <FormLabel>Mensaje</FormLabel>
              <Textarea rows={5} {...register('message', { required: 'El mensaje es obligatorio' })} />
              <FormErrorMessage>{errors.message?.message}</FormErrorMessage>
            </FormControl>
            <Button type="submit" colorScheme="brand" size="lg" w="100%" isLoading={loading}>Enviar mensaje</Button>
          </VStack>
        </form>
        </Box>
        <Box bg={bg} p={8} borderRadius="xl" borderWidth="1px" shadow="sm">
          <VStack align="stretch" spacing={4}>
            <Heading size="md">Datos de contacto</Heading>
            <VStack align="stretch" spacing={2}>
              <Text fontWeight="600">Teléfono</Text>
              <Text color="fg.muted">+54 3482 468040</Text>
            </VStack>
            <VStack align="stretch" spacing={2}>
              <Text fontWeight="600">Dirección</Text>
              <Text color="fg.muted">Villa Ocampo, Santa Fe - Av. San Martín 1730</Text>
            </VStack>
            <VStack align="stretch" spacing={2}>
              <Text fontWeight="600">Email</Text>
              <Text color="fg.muted">info@compushop.com</Text>
            </VStack>
          </VStack>
        </Box>
      </SimpleGrid>
    </Container>
  );
}
