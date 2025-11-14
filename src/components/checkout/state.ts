import { create } from 'zustand';

interface CheckoutStore {
  isCartVisible: boolean;
  numberOfProductsInCart: number;
  showCart: () => void;
  hideCart: () => void;
  setNumberOfProductsInCart: (numberOfProductsInCart: number) => void;
}

export const useCheckoutStore = create<CheckoutStore>((set) => ({
  isCartVisible: false,
  numberOfProductsInCart: 2,
  showCart: () => set((state) => ({ ...state, isCartVisible: true })),
  hideCart: () => set((state) => ({ ...state, isCartVisible: false })),
  setNumberOfProductsInCart: (numberOfProductsInCart: number) => set((state) => ({ ...state, numberOfProductsInCart: numberOfProductsInCart })),
}))
