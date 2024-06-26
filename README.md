Don't use the `xian-dapp-utils.mjs` included here but the newest one from the [dapp-utils repository](https://github.com/xian-network/dapp-utils).

# Xian Counter dApp

This is a simple decentralized application (dApp) that interacts with the Xian blockchain. It uses the Xian Wallet browser extension to send transactions and interact with smart contracts.

## Features

- Display the current wallet address
- Send a transaction to increment a counter on the blockchain
- Display transaction success or failure using toast notifications

## Setup

1. Install the Xian Wallet [browser extension](https://chromewebstore.google.com/search/xian%20wallet).
2. Clone this repository.
3. `npm install`
4. `npm run dev`
3. Open `http://localhost:3000/` in your browser.

## Usage

1. Unlock your Xian Wallet.
2. Click the "Increment" button to send a transaction that increments the counter.
3. Check the toast notification for the transaction result.

## Dependencies

- [Bulma](https://bulma.io/): A modern CSS framework based on Flexbox.
- [Bulma-toast](https://rfoel.com/bulma-toast/): Toast extension for Bulma.

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
