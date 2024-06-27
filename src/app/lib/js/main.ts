import { storeAPI } from "../store";
import { updateCurrentCounter } from "./node";
import * as bulmaToast from "bulma-toast";

const showToast = (message: string, type: bulmaToast.ToastType) => {
    bulmaToast.toast({
        message,
        type,
        position: "top-center",
        duration: 5000
    });
}

const setWalletAddressElementValue = storeAPI.getState().setWalletAddressElementValue

export const handleWalletInfo = (info) => {
    setWalletAddressElementValue(info.address.slice(0, 10) + '...');
    if (info.locked) {
        setWalletAddressElementValue('Wallet is Locked');
        showToast("Your wallet is locked. Please unlock it to interact with the dapp.", "is-warning");
    }
}

export const handleWalletError = (error) => {
    showToast("You don't have the Xian Wallet extension installed. Please install it to interact with the dapp.", "is-danger");
    setWalletAddressElementValue('Wallet not installed');
}

export const handleTransaction = (response) => {
    if (response.errors) {
        console.error('Transaction failed:', response.errors);
        showToast("Transaction failed: " + response.errors, "is-danger");
        return;
    }
    console.log('Transaction succeeded:', response);
    showToast("Transaction succeeded", "is-success");
    updateCurrentCounter();
}

export const handleTransactionError = (error) => {
    console.error('Transaction error:', error);
    showToast("Transaction error: " + error, "is-danger");
}