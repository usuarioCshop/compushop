import { Box, Skeleton, SkeletonText } from '@chakra-ui/react';

export default function ProductCardSkeleton() {
  return (
    <Box borderWidth="1px" borderRadius="lg" overflow="hidden" bg="bg.surface">
      <Skeleton height="200px" />
      <Box p={4}>
        <SkeletonText mt="2" noOfLines={2} spacing="2" />
        <Skeleton height="20px" width="60%" mt={4} />
        <Skeleton height="36px" mt={4} borderRadius="md" />
      </Box>
    </Box>
  );
}
