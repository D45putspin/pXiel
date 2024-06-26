// store.js
import { create } from 'zustand';

const useStore = create((set) => ({
    walletAddressElementValue: "Connect Wallet",
    setWalletAddressElementValue: (value) => set({ walletAddressElementValue: value }),
    counterValue: 0,
    setCounterValue: (value) => set({ counterValue: value }),
}));

export default useStore;
export const storeAPI = useStore;