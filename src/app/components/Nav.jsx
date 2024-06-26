'use client'
import React from 'react';
import useStore from '../lib/store';

const Nav = () => {
    const walletAddressElementValue = useStore(state => state.walletAddressElementValue);

    return (
        <nav className="navbar" aria-label="main navigation">
            <div className="container">
                <div className="navbar-brand">
                    <a className="navbar-item" href="/">
                        <strong>Xian dApp Starter</strong>
                    </a>
                </div>

                <div id="navbarBasicExample" className="navbar-menu">
                    <div className="navbar-end">
                        <a className="navbar-item" href="/" id="wallet-address">
                            {walletAddressElementValue}
                        </a>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Nav;