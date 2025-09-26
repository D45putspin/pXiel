'use client';

// Lightweight CometBFT Tx subscription client for browsers
// - Subscribes to tm.event='Tx'
// - Decodes Xian tx payload (base64 -> hex string -> bytes -> JSON)
// - Calls onPaint for contract `paint` events

function decodeTxB64ToJson(txB64) {
  try {
    // Base64 decode -> ASCII hex string
    const hexStr = (typeof atob === 'function') ? atob(txB64) : Buffer.from(txB64, 'base64').toString('utf8');

    // Hex string -> Uint8Array
    const bytes = new Uint8Array(Math.floor(hexStr.length / 2));
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hexStr.substr(i * 2, 2), 16);
    }

    // Bytes -> JSON
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('TX decode failed', e);
    return null;
  }
}

function extractTxData(messageObj) {
  try {
    const result = messageObj?.result;
    if (!result) return { txHash: null, txB64: null };

    // tx hash may appear in events map
    const evmap = result.events || {};
    const txHash = Array.isArray(evmap['tx.hash']) && evmap['tx.hash'].length > 0 ? evmap['tx.hash'][0] : null;

    // b64 bytes in nested structure
    const txB64 = result?.data?.value?.TxResult?.tx
      ?? result?.data?.value?.tx
      ?? null;

    return { txHash, txB64 };
  } catch {
    return { txHash: null, txB64: null };
  }
}

export function startXianPaintMonitor({
  wsUrl = (process.env.NEXT_PUBLIC_XIAN_WS_URL || 'wss://devnet.xian.org/websocket'),
  contractName,
  onPaint,
  onContractTx,
  onStatus,
}) {
  if (typeof window === 'undefined') return () => {};
  let socket = null;
  let alive = true;
  let reconnectDelayMs = 1000;
  const processed = new Set();

  const notify = (msg) => {
    try { onStatus && onStatus(msg); } catch (_) {}
    try { console.debug('[xian-ws]', msg); } catch (_) {}
  };

  const subscribeMsg = JSON.stringify({
    jsonrpc: '2.0',
    method: 'subscribe',
    id: 1,
    params: { query: "tm.event='Tx'" },
  });

  function connect() {
    if (!alive) return;
    try {
      socket = new WebSocket(wsUrl);
    } catch (e) {
      notify(`WS create error: ${String(e)}`);
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      try { socket.send(subscribeMsg); } catch {}
      notify('Subscribed to Tx events');
      reconnectDelayMs = 1000; // reset backoff
    };

    socket.onmessage = (evt) => {
      let obj;
      try { obj = JSON.parse(evt.data); } catch { return; }
      const { txHash, txB64 } = extractTxData(obj);
      if (!txB64) return;
      if (txHash && processed.has(txHash)) return;

      const txJson = decodeTxB64ToJson(txB64);
      if (!txJson) {
        if (txHash) processed.add(txHash);
        return;
      }

      const payload = txJson?.payload || {};
      const c = payload.contract;
      const f = payload.function;
      const k = payload.kwargs || {};

      // Notify any tx to the monitored contract
      if (c === contractName) {
        try { onContractTx && onContractTx(payload); } catch (_) {}

        // Specific handling for paint -> pass coordinates
        if (f === 'paint') {
          const x = Number(k.x);
          const y = Number(k.y);
          const color = String(k.color || '').toLowerCase();
          if (Number.isFinite(x) && Number.isFinite(y)) {
            try { onPaint && onPaint({ x, y, color, sender: payload.sender, txHash: txHash || null }); } catch (_) {}
          }
        }
        if (txHash) processed.add(txHash);
        return;
      }

      if (txHash) processed.add(txHash);
    };

    socket.onerror = (e) => {
      notify(`WS error: ${e?.message || 'unknown'}`);
    };

    socket.onclose = (evt) => {
      notify(`WS closed (${evt?.code || ''} ${evt?.reason || ''}), reconnecting...`);
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (!alive) return;
    setTimeout(() => {
      if (!alive) return;
      reconnectDelayMs = Math.min(reconnectDelayMs * 1.5, 15000);
      connect();
    }, reconnectDelayMs);
  }

  connect();

  return () => {
    alive = false;
    try { socket && socket.close(); } catch {}
  };
}


