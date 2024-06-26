'use client'

import useStore, { storeAPI } from "../lib/store";
import { handleTransaction, handleTransactionError } from "../lib/js/main";
import WalletUtilService from '../lib/wallet-util-service';

const Section = () => {
    const xianWalletUtilInstance = WalletUtilService.getInstance().XianWalletUtils;
    const counter = useStore(state => state.counterValue);

    const sendTransaction = async () => {
        try {
            console.log(xianWalletUtilInstance)
            const response = await xianWalletUtilInstance.sendTransaction("con_counter", "increment_counter", {});
            handleTransaction(response);
        } catch (error) {
            handleTransactionError(error);
        }
    };
    return (
        <section className="section">
            <div className="container">
                <h1 className="title">
                    Decentralized Counter
                </h1>
                <p className="subtitle">
                    Everyone can increment the counter by calling the smart contract function <span className="inline-highlite">increment_counter()</span>.
                </p>
                <div className="counter-container">
                    <div className="counter">
                        <h2 className="title is-2" id="counter-value">{counter}</h2>
                        <button className="button is-primary" id="increment-button" onClick={sendTransaction}>Increment</button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Section;