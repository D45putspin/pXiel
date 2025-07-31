const XianWalletUtils = {
  rpcUrl: 'https://node.xian.org',
  isWalletReady: false,
  initialized: false,
  state: {
    walletReady: { resolvers: [] },
    walletInfo: { requests: [] },
    signMessage: { requests: [] },
    transaction: { requests: [] }
  },

  init: function (rpcUrl) {
    if (this.initialized) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (rpcUrl) this.rpcUrl = rpcUrl;

    document.addEventListener('xianWalletInfo', (e) => {
      if (this.state.walletInfo.requests.length > 0) {
        const resolver = this.state.walletInfo.requests.shift();
        resolver(e.detail);
      }
    });

    document.addEventListener('xianWalletSignMsgResponse', (e) => {
      if (this.state.signMessage.requests.length > 0) {
        const resolver = this.state.signMessage.requests.shift();
        resolver(e.detail);
      }
    });

    document.addEventListener('xianWalletTxStatus', (e) => {
      console.log('Received xianWalletTxStatus event:', e.detail);
      
      if (this.state.transaction.requests.length > 0) {
        const resolver = this.state.transaction.requests.shift();
        
        if ('errors' in e.detail) {
          console.error('Transaction failed with errors:', e.detail.errors);
          resolver(e.detail);
        } else {
          console.log('Transaction successful, getting results for txid:', e.detail.txid);
          this.getTxResultsAsyncBackoff(e.detail.txid)
            .then((tx) => {
              console.log('Transaction results received:', tx);
              try {
                const decoded = JSON.parse(window.atob(tx.result.tx_result.data));
                console.log('Decoded transaction result:', decoded);
                resolver(decoded);
              } catch (error) {
                console.error('Failed to decode transaction result:', error);
                resolver(null);
              }
            })
            .catch((error) => {
              console.error('Failed to get transaction results:', error);
              resolver(null);
            });
        }
      } else {
        console.warn('Received transaction status but no pending requests');
      }
    });

    document.addEventListener('xianReady', () => {
      this.isWalletReady = true;
      while (this.state.walletReady.resolvers.length > 0) {
        this.state.walletReady.resolvers.shift()();
      }
    });

    this.initialized = true;
  },

  waitForWalletReady: function () {
    return new Promise((resolve) => {
      if (this.isWalletReady) resolve();
      else {
        this.state.walletReady.resolvers.push(resolve);
        setTimeout(() => {
          const idx = this.state.walletReady.resolvers.indexOf(resolve);
          if (idx !== -1) this.state.walletReady.resolvers.splice(idx, 1);
          resolve();
        }, 2000);
      }
    });
  },

  requestWalletInfo: async function () {
    await this.waitForWalletReady();
    return new Promise((resolve, reject) => {
      this.state.walletInfo.requests.push(resolve);
      setTimeout(() => reject(new Error('Xian Wallet not responding')), 2000);
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('xianWalletGetInfo'));
      }
    });
  },

  signMessage: async function (message) {
    await this.waitForWalletReady();
    return new Promise((resolve, reject) => {
      this.state.signMessage.requests.push(resolve);
      setTimeout(() => reject(new Error('Sign message timeout')), 30000);
      if (typeof document !== 'undefined') {
        document.dispatchEvent(new CustomEvent('xianWalletSignMsg', { detail: { message } }));
      }
    });
  },

  // NÃO normaliza 'end_date': o contrato aceita string (ou nada).
  sendTransaction: async function (contract, method, kwargs = {}) {
    await this.waitForWalletReady();
    console.log('Sending transaction:', { contract, method, kwargs });
    
    return new Promise((resolve, reject) => {
      this.state.transaction.requests.push(resolve);
      
      const timeoutId = setTimeout(() => {
        console.error('Transaction timeout after 30 seconds');
        reject(new Error('Transaction timeout - wallet may not be responding'));
      }, 30000);
      
      if (typeof document !== 'undefined') {
        console.log('Dispatching xianWalletSendTx event');
        document.dispatchEvent(new CustomEvent('xianWalletSendTx', { detail: { contract, method, kwargs } }));
      } else {
        console.error('Document not available for transaction');
        reject(new Error('Document not available'));
      }
      
      // Override the resolve to clear timeout
      const originalResolve = resolve;
      this.state.transaction.requests[this.state.transaction.requests.length - 1] = (result) => {
        clearTimeout(timeoutId);
        console.log('Transaction resolved with result:', result);
        originalResolve(result);
      };
    });
  },

  getTxResults: async function (txHash) {
    const response = await fetch(`${this.rpcUrl}/tx?hash=0x${txHash}`);
    return response.json();
  },

  getTxResultsAsyncBackoff: async function (txHash, retries = 5, delay = 1000) {
    try {
      return await this.getTxResults(txHash);
    } catch (e) {
      if (retries === 0) throw e;
      await new Promise((r) => setTimeout(r, delay));
      return await this.getTxResultsAsyncBackoff(txHash, retries - 1, delay * 2);
    }
  },

  getUserVote: async function (contract, pollId, userAddress) {
    const res = await fetch(
      `${this.rpcUrl}/abci_query?path=%22/get/${contract}.user_votes:${userAddress}:${pollId}%22`
    );
    const data = await res.json();
    const base64 = data.result.response.value;
    if (!base64 || base64 === 'AA==') return 0;
    return parseInt(window.atob(base64)) || 0;
  },

  fetchAllPolls: async function (contract) {
    try {
      const counterRes = await fetch(
        `${this.rpcUrl}/abci_query?path=%22/get/${contract}.poll_counter%22`
      );
      const counterData = await counterRes.json();
      const totalPolls = parseInt(window.atob(counterData.result.response.value)) || 0;

      const polls = [];
      for (let i = 1; i <= totalPolls; i++) {
        const res = await fetch(
          `${this.rpcUrl}/abci_query?path=%22/get/${contract}.polls:${i}%22`
        );
        const data = await res.json();
        const base64 = data.result.response.value;
        if (!base64 || base64 === 'AA==') continue;
        try {
          polls.push(JSON.parse(window.atob(base64)));
        } catch {
          // ignora entradas malformadas
        }
      }
      return polls;
    } catch {
      return [];
    }
  },

  getBalanceRequest: async function (address, tokenContract) {
    try {
      const response = await fetch(
        `${this.rpcUrl}/abci_query?path=%22/get/${tokenContract}.balances:${address}%22`
      );
      const data = await response.json();
      const balance = data.result.response.value;
      
      if (!balance || balance === 'AA==') {
        return '0';
      }
      
      const decodedBalance = window.atob(balance);
      return decodedBalance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      return '0';
    }
  }
};

export default XianWalletUtils;
