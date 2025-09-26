'use client'

import React, { useEffect } from 'react';
import Nav from './Nav';
import Section from './Section';
import WalletUtilService from '../lib/wallet-util-service.mjs';

const Main = () => {
    useEffect(() => {
        // Initialize the wallet utils
        const walletService = WalletUtilService.getInstance();
        const rpcUrl = process.env.NEXT_PUBLIC_XIAN_RPC || 'https://testnet.xian.org';
        walletService.XianWalletUtils.init(rpcUrl);
    }, []);

    return (
        <div className="app-container">
            <Nav />
            <Section />
        </div>
    );
}

export default Main;
