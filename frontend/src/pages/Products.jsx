import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Container, Heading, Select, Input, HStack, Spinner, Center, Text, Button, Flex, Grid, GridItem,
} from '@chakra-ui/react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import useDebounce from '../hooks/useDebounce';

const PAGE_SIZE = 40;

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [visibleCount, setVisibleCount] = useState(4);
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const search = params.get('search') || '';
  const [searchInput, setSearchInput] = useState(search);
  const debouncedSearch = useDebounce(searchInput, 400);
  const loaderRef = useRef(null);

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data.categories || [])).catch(console.error);
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debouncedSearch) {
      next.set('search', debouncedSearch);
    } else {
      next.delete('search');
    }
    setParams(next, { replace: true });
  }, [debouncedSearch]);

  const fetchPage = useCallback(async (pageNum) => {
    setLoading(true);
    setVisibleCount(4);

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

      setProducts(items);
      setPage(pageNum);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setProducts([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchPage(1);
  }, [category, search, fetchPage]);

  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    if (loading) return;
    if (visibleCount >= products.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < products.length) {
          setVisibleCount((c) => Math.min(c + 4, products.length));
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loading, visibleCount, products.length]);

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
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          bg="bg.surface"
        />
      </HStack>
      {loading ? (
        <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }} gap={6}>
          {Array.from({ length: 8 }).map((_, i) => (
            <GridItem key={i}>
              <ProductCardSkeleton />
            </GridItem>
          ))}
        </Grid>
      ) : products.length === 0 ? (
        <Flex direction="column" align="center" gap={4} py={10}>
          <Text color="fg.muted" textAlign="center">No se encontraron productos con los filtros aplicados.</Text>
          <Button variant="outline" onClick={() => {
            setSearchInput('');
            setParams({});
          }}>
            Limpiar filtros
          </Button>
        </Flex>
      ) : (
        <>
          <Grid templateColumns={{ base: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' }} gap={6}>
            {products.slice(0, visibleCount).map((p) => (
              <GridItem key={`${p.id}-${page}`}>
                <ProductCard product={p} />
              </GridItem>
            ))}
          </Grid>

          {visibleCount < products.length && (
            <>
              <Flex ref={loaderRef} h="10px" />
              <Center py={6}>
                <Text fontSize="sm" color="fg.muted">Cargando más productos...</Text>
              </Center>
            </>
          )}

          <Flex mt={10} direction="column" align="center" gap={3}>
            <Text fontSize="sm" color="fg.muted">
              Página {pagination.page} de {pagination.pages} · {pagination.total} productos
            </Text>
            <HStack spacing={2}>
              <Button size="sm" variant="outline" isDisabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)}>
                Anterior
              </Button>
              <Button size="sm" variant="outline" isDisabled={!hasMore || loading} onClick={() => fetchPage(page + 1)}>
                Siguiente
              </Button>
            </HStack>
          </Flex>
        </>
      )}
    </Container>
  );
}
