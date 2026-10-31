import { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('compushop_cart') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('compushop_cart', JSON.stringify(items));
  }, [items]);

  const addItem = (product, quantity = 1, type = 'product') => {
    const qty = Math.max(1, Number(quantity) || 1);
    const stock = product.stock !== undefined && product.stock !== null ? Number(product.stock) : null;

    setItems(prev => {
      const existing = prev.find(i => i.id === product.id && i.type === type);
      if (existing) {
        const newQty = existing.quantity + qty;
        if (stock !== null && newQty > stock) {
          return prev.map(i =>
            i.id === product.id && i.type === type
              ? { ...i, quantity: stock }
              : i
          );
        }
        return prev.map(i =>
          i.id === product.id && i.type === type
            ? { ...i, quantity: newQty }
            : i
        );
      }
      const finalQty = stock !== null && qty > stock ? stock : qty;
      if (finalQty <= 0) return prev;
      return [...prev, {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: finalQty,
        type,
        stock,
      }];
    });
  };

  const removeItem = (id, type) => {
    setItems(prev => prev.filter(i => !(i.id === id && i.type === type)));
  };

  const updateQuantity = (id, type, quantity) => {
    const qty = Number(quantity) || 0;
    if (qty < 1) return removeItem(id, type);
    setItems(prev => prev.map(i => {
      if (!(i.id === id && i.type === type)) return i;
      const stock = i.stock !== undefined && i.stock !== null ? Number(i.stock) : null;
      const finalQty = stock !== null && qty > stock ? stock : qty;
      return { ...i, quantity: finalQty };
    }));
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
