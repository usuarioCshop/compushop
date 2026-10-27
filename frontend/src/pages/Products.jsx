import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Box, Container, Heading, SimpleGrid, Select, Input, HStack, Spinner, Center, Text, Button, Flex,
} from '@chakra-ui/react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';

const PAGE_SIZE = 80;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const search = params.get('search') || '';
  const loaderRef = useRef(null);

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data.categories || [])).catch(console.error);
  }, []);

  const fetchPage = useCallback(async (pageNum, reset = false) => {
    if (reset) {
      setLoading(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const q = new URLSearchParams();
      if (category) q.set('category', category);
      if (search) q.set('search', search);
      q.set('limit', String(PAGE_SIZE));
      q.set('page', String(pageNum));
      q.set('promo_first', '1');

      const res = await api.get(`/products?${q}`);
      const items = res.data.products || [];
      const pag = res.data.pagination || { page: pageNum, pages: 1, total: items.length };

      setPagination(pag);
      setHasMore(pageNum < pag.pages);

      setProducts((prev) => (reset ? items : [...prev, ...items]));
      setPage(pageNum);
    } catch (err) {
      console.error(err);
      if (reset) setProducts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [category, search]);

  useEffect(() => {
    setProducts([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
  }, [category, search, fetchPage]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    if (loading || loadingMore || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchPage(page + 1, false);
        }
      },
      { rootMargin: '400px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, loadingMore, hasMore, page, fetchPage]);

  return (
    <Container maxW="7xl" py={10}>
      <Heading mb={6}>Productos</Heading>
      <HStack mb={8} spacing={4} flexWrap="wrap">
        <Select
          maxW="240px"
          placeholder="Todas las categorías"
          value={category}
          onChange={e => {
            const p = new URLSearchParams(params);
            if (e.target.value) p.set('category', e.target.value); else p.delete('category');
            setParams(p);
          }}
          bg="bg.surface"
        >
          {categories.map(c => <option key={c.id} value={c.slug}>{c.name}</option>)}
        </Select>
        <Input
          maxW="320px"
          placeholder="Buscar productos..."
          defaultValue={search}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              const p = new URLSearchParams(params);
              if (e.target.value) p.set('search', e.target.value); else p.delete('search');
              setParams(p);
            }
          }}
          bg="bg.surface"
        />
      </HStack>
      {loading ? (
        <Center py={20}><Spinner size="xl" color="brand.500" /></Center>
      ) : products.length === 0 ? (
        <Text color="fg.muted" textAlign="center" py={10}>No se encontraron productos.</Text>
      ) : (
        <>
          <SimpleGrid columns={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing={6}>
            {products.map((p, idx) => <ProductCard key={`${p.id}-${idx}`} product={p} />)}
          </SimpleGrid>

          <Box ref={loaderRef} h="1px" />

          {loadingMore && (
            <Center py={8}><Spinner size="lg" color="brand.500" /></Center>
          )}

          <Flex mt={10} direction="column" align="center" gap={3}>
            <Text fontSize="sm" color="fg.muted">
              Página {pagination.page} de {pagination.pages} · {pagination.total} productos
            </Text>
            <HStack spacing={2}>
              <Button size="sm" variant="outline" isDisabled={page <= 1 || loadingMore} onClick={() => fetchPage(page - 1, true)}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" isDisabled={!hasMore || loadingMore} onClick={() => fetchPage(page + 1, true)}>
                Siguiente
              </Button>
            </HStack>
          </Flex>
        </>
      )}
    </Container>
  );
}
