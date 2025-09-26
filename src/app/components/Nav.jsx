'use client'
import React, { useEffect } from 'react';
import useStore from '@/app/lib/store';
import WalletUtilService from '@/app/lib/wallet-util-service.mjs';

const Nav = () => {
    const walletAddress = useStore(state => state.walletAddress);
    const isConnected = useStore(state => state.isConnected);
    const setWalletAddress = useStore(state => state.setWalletAddress);

    useEffect(() => {
        const utils = WalletUtilService.getInstance().XianWalletUtils;
        if (utils?.init) utils.init(process.env.NEXT_PUBLIC_XIAN_RPC || 'https://testnet.xian.org');
    }, []);

    const formatWalletAddress = (address) => {
        if (!address || address === 'Not connected') return 'Not connected';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    const connectWallet = async () => {
        try {
            console.log('Attempting to connect wallet...');
            const walletService = WalletUtilService.getInstance();
            const walletInfo = await walletService.XianWalletUtils.requestWalletInfo();
            console.log('Wallet info received:', walletInfo);

            const address = walletInfo?.address || walletInfo?.wallet?.address || null;
            console.log('Extracted address:', address, 'type:', typeof address, 'length:', address?.length);

            setWalletAddress(address);
            console.log('Address set in store:', address);
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            setWalletAddress(null);
        }
    };

    return (
        <nav className="nav" aria-label="main navigation">
            <div className="container">
                <div className="nav-content">
                    <div className="nav-brand">
                        <a href="/" className="nav-logo">
                            <span>
                                p<span className="x-accent">X</span>iel
                            </span>
                        </a>
                    </div>

                    <div className="nav-menu">
                        <div className="nav-start">
                            {/* Future nav items can go here */}
                        </div>
                        <div className="nav-end">
                            <div className="wallet-status">
                                <div className="wallet-indicator">
                                    <div className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}></div>
                                </div>
                                {isConnected ? (
                                    <span className="wallet-address" id="wallet-address">
                                        {formatWalletAddress(walletAddress)}
                                    </span>
                                ) : (
                                    <button
                                        className="btn btn-primary"
                                        onClick={connectWallet}
                                        style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
                                    >
                                        Connect Wallet
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Nav;
