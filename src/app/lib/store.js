// store.js
import { create } from 'zustand';

const useStore = create((set, get) => ({
    walletAddressElementValue: "Connect Wallet",
    setWalletAddressElementValue: (value) => set({ walletAddressElementValue: value }),
    
    // Voting system state
    polls: [],
    currentPoll: null,
    userVotes: {},
    
    // Poll management
    setPolls: (polls) => set({ polls }),
    addPoll: (poll) => set((state) => ({ polls: [...state.polls, poll] })),
    setCurrentPoll: (poll) => set({ currentPoll: poll }),
    
    // Vote management
    setUserVotes: (votes) => set({ userVotes: votes }),
    addUserVote: (pollId, optionId) => set((state) => ({
        userVotes: { ...state.userVotes, [pollId]: parseInt(optionId) }
    })),
    
    // Legacy counter (keeping for compatibility)
    counterValue: 0,
    setCounterValue: (value) => set({ counterValue: value }),
}));

export default useStore;
export const storeAPI = useStore;