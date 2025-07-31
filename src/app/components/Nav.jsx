'use client'
import React from 'react';
import useStore from '../lib/store';

const Nav = () => {
    const walletAddressElementValue = useStore(state => state.walletAddressElementValue);

    const formatWalletAddress = (address) => {
        if (!address || address === 'Not connected') return 'Not connected';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    };

    return (
        <nav className="nav" aria-label="main navigation">
            <div className="container">
                <div className="nav-content">
                    <div className="nav-brand">
                        <a href="/" className="nav-logo">
                            <div className="logo-icon">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                            </div>
                            <span className="logo-text">XiPOLL</span>
                        </a>
                    </div>

                    <div className="nav-menu">
                        <div className="nav-end">
                            <div className="wallet-status">
                                <div className="wallet-indicator">
                                    <div className={`status-dot ${walletAddressElementValue !== 'Not connected' ? 'connected' : 'disconnected'}`}></div>
                                </div>
                                <span className="wallet-address" id="wallet-address">
                                    {formatWalletAddress(walletAddressElementValue)}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Nav;