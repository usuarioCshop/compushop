import { createContext, useContext, useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const WishlistContext = createContext(null);

const getWishlistKey = (userId) => (userId ? `compushop_wishlist_${userId}` : 'compushop_wishlist_guest');

export function WishlistProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id || null;
  const wishlistKey = getWishlistKey(userId);
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(wishlistKey) || '[]').map(Number);
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      setItems(JSON.parse(localStorage.getItem(wishlistKey) || '[]').map(Number));
    } catch {
      setItems([]);
    }
  }, [wishlistKey]);

  useEffect(() => {
    if (!user) {
      localStorage.setItem(wishlistKey, JSON.stringify(items));
    }
  }, [items, user, wishlistKey]);

  useEffect(() => {
    if (user) {
      api.get('/wishlist').then(r => {
        const ids = (r.data.items || []).map(i => Number(i.product_id));
        setItems(ids);
        localStorage.setItem(wishlistKey, JSON.stringify(ids));
      }).catch(() => {});
    }
  }, [user?.id]);

  const addItem = async (productId) => {
    const pid = Number(productId);
    if (!user) return;
    if (items.map(Number).includes(pid)) return;
    await api.post('/wishlist', { product_id: pid }).catch(() => {});
    setItems(prev => {
      const next = [...prev.map(Number), pid];
      localStorage.setItem(wishlistKey, JSON.stringify(next));
      return next;
    });
  };

  const removeItem = async (productId) => {
    const pid = Number(productId);
    if (!user) return;
    await api.delete(`/wishlist/${pid}`).catch(() => {});
    setItems(prev => {
      const next = prev.map(Number).filter(id => id !== pid);
      localStorage.setItem(wishlistKey, JSON.stringify(next));
      return next;
    });
  };

  const toggle = async (productId) => {
    const pid = Number(productId);
    if (!user) return;
    if (items.map(Number).includes(pid)) {
      await removeItem(pid);
    } else {
      await addItem(pid);
    }
  };

  const has = (productId) => items.map(Number).includes(Number(productId));
  const totalItems = items.map(Number).length;

  return (
    <WishlistContext.Provider value={{ items: items.map(Number), toggle, has, addItem, removeItem, totalItems }}>
      {children}
    </WishlistContext.Provider>
  );
}

export const useWishlist = () => useContext(WishlistContext);
