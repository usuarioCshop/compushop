import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Container, Heading, Select, Input, HStack, InputGroup, InputLeftElement, Icon,
  Spinner, Center, Text, Button, Flex, Grid, GridItem, VStack, Box,
  RangeSlider, RangeSliderTrack, RangeSliderFilledTrack, RangeSliderThumb,
} from '@chakra-ui/react';
import { FiSearch, FiX } from 'react-icons/fi';
import { useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../api/client';
import ProductCard from '../components/ProductCard';
import ProductCardSkeleton from '../components/ProductCardSkeleton';
import EmptyState from '../components/EmptyState';
import useDebounce from '../hooks/useDebounce';

const PAGE_SIZE = 40;
const FALLBACK_MAX = 5000000;

const formatPrice = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`;
const calcStep = (min, max) => {
  const span = Math.max(0, Number(max) - Number(min));
  if (span <= 0) return 1;
  const raw = Math.pow(10, Math.floor(Math.log10(span)) - 1);
  return Math.max(1000, raw);
};

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
  const minPrice = params.get('minPrice') || '';
  const maxPrice = params.get('maxPrice') || '';
  const [searchInput, setSearchInput] = useState(search);
  const [bounds, setBounds] = useState({ min: 0, max: FALLBACK_MAX });
  const [priceRange, setPriceRange] = useState([
    minPrice ? Number(minPrice) : 0,
    maxPrice ? Number(maxPrice) : FALLBACK_MAX,
  ]);
  const debouncedSearch = useDebounce(searchInput, 400);
  const debouncedPriceRange = useDebounce(priceRange, 400);
  const loaderRef = useRef(null);

  useEffect(() => {
    const bMin = Number(bounds.min) || 0;
    const bMax = Number(bounds.max) || 0;
    const hi = bMax >= bMin ? bMax : bMin;
    setPriceRange((prev) => {
      const wantMin = minPrice !== '' ? Number(minPrice) : bMin;
      const wantMax = maxPrice !== '' ? Number(maxPrice) : hi;
      const nextMin = Math.min(Math.max(wantMin, bMin), hi);
      const nextMax = Math.min(Math.max(wantMax, bMin), hi);
      const safe = nextMax >= nextMin ? [nextMin, nextMax] : [nextMin, nextMin];
      return prev[0] === safe[0] && prev[1] === safe[1] ? prev : safe;
    });
  }, [bounds, minPrice, maxPrice]);

  useEffect(() => {
    api.get('/categories').then(r => setCategories(r.data.categories || [])).catch(console.error);
  }, []);

  useEffect(() => {
    const next = new URLSearchParams(params);
    if (debouncedSearch) next.set('search', debouncedSearch); else next.delete('search');
    const [minVal, maxVal] = debouncedPriceRange;
    const bMin = Number(bounds.min) || 0;
    const bMax = Number(bounds.max) || 0;
    if (minVal > bMin) next.set('minPrice', String(minVal)); else next.delete('minPrice');
    if (maxVal < bMax) next.set('maxPrice', String(maxVal)); else next.delete('maxPrice');
    setParams(next, { replace: true });
  }, [debouncedSearch, debouncedPriceRange, bounds]);

  const fetchPage = useCallback(async (pageNum) => {
    setLoading(true);
    setVisibleCount(4);

    try {
      const q = new URLSearchParams();
      if (category) q.set('category', category);
      if (search) q.set('search', search);
      if (minPrice) q.set('minPrice', minPrice);
      if (maxPrice) q.set('maxPrice', maxPrice);
      q.set('limit', String(PAGE_SIZE));
      q.set('page', String(pageNum));
      q.set('promo_first', '1');

      const res = await api.get(`/products?${q}`);
      const items = res.data.products || [];
      const pag = res.data.pagination || { page: pageNum, pages: 1, total: items.length };

      setPagination(pag);
      setHasMore(pageNum < pag.pages);
      if (res.data.priceBounds) {
        const bMin = Number(res.data.priceBounds.min) || 0;
        const bMax = Number(res.data.priceBounds.max) || 0;
        setBounds({ min: bMin, max: bMax >= bMin ? bMax : bMin });
      }

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
  }, [category, search, minPrice, maxPrice]);

  useEffect(() => {
    setPage(1);
    setHasMore(true);
    fetchPage(1);
  }, [category, search, minPrice, maxPrice, fetchPage]);

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
    <>
      <Helmet>
        <title>Productos | Compushop</title>
        <meta name="description" content="Catálogo de productos de computación, hardware y accesorios en Compushop." />
      </Helmet>
      <Container maxW="7xl" py={10}>
      <VStack spacing={1} align="start" mb={6}>
        <Heading fontWeight="700" letterSpacing="-0.02em">Productos</Heading>
        <Text color="fg.muted" fontSize="sm">
          {pagination.total > 0 ? `Equipamiento disponible: ${pagination.total} artículos` : 'Explorá el catálogo completo'}
        </Text>
      </VStack>
      <HStack mb={8} spacing={3} flexWrap="wrap">
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
        <InputGroup maxW="320px">
          <InputLeftElement pointerEvents="none">
            <Icon as={FiSearch} color="fg.muted" />
          </InputLeftElement>
          <Input
            placeholder="Buscar productos..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            bg="bg.surface"
            borderRadius="md"
          />
        </InputGroup>
        <Box minW={{ base: '100%', md: '280px' }} maxW="360px" px={1}>
          <HStack justify="space-between" mb={1}>
            <Text fontSize="sm" color="fg.muted">Rango de precio</Text>
            <Text fontSize="sm" fontWeight="600" color="fg.default">
              {formatPrice(priceRange[0])} - {formatPrice(priceRange[1])}
            </Text>
          </HStack>
          <RangeSlider
            aria-label={['Precio mínimo', 'Precio máximo']}
            min={Number(bounds.min) || 0}
            max={Math.max(Number(bounds.max) || 0, (Number(bounds.min) || 0) + 1)}
            step={calcStep(bounds.min, bounds.max)}
            value={priceRange}
            onChange={(val) => setPriceRange(val)}
            isDisabled={(Number(bounds.max) || 0) <= (Number(bounds.min) || 0)}
            colorScheme="brand"
          >
            <RangeSliderTrack bg="border.subtle">
              <RangeSliderFilledTrack />
            </RangeSliderTrack>
            <RangeSliderThumb index={0} boxSize={4} />
            <RangeSliderThumb index={1} boxSize={4} />
          </RangeSlider>
        </Box>
        {(category || search || minPrice || maxPrice) && (
          <Button
            variant="ghost"
            leftIcon={<FiX />}
            size="sm"
            color="fg.muted"
            onClick={() => { setSearchInput(''); setPriceRange([Number(bounds.min) || 0, Number(bounds.max) || 0]); setParams({}); }}
          >
            Limpiar
          </Button>
        )}
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
        <EmptyState
          icon={FiSearch}
          title="Sin resultados"
          description="Ningún producto coincide con los filtros aplicados. Probá otra búsqueda o limpiá los filtros."
          actionLabel="Limpiar filtros"
          onAction={() => { setSearchInput(''); setPriceRange([Number(bounds.min) || 0, Number(bounds.max) || 0]); setParams({}); }}
        />
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
    </>
  );
}
