'use client'

import React, { useEffect } from 'react';
import Nav from './Nav';
import Section from './Section';
import { handleWalletError, handleWalletInfo } from "../lib/js/main";
import { updateCurrentCounter } from "../lib/js/node";
import WalletUtilService from '../lib/wallet-util-service';

const Main = () => {
    useEffect(() => {
        async function setup() {
            const XianWalletService = WalletUtilService.getInstance();
            const info = await XianWalletService.XianWalletUtils.requestWalletInfo().catch(handleWalletError)
            updateCurrentCounter()
            handleWalletInfo(info);
        }
        setup()
    }, []);
    return (
        <>
            <Nav />
            <Section />
        </>
    )
}

export default Main;