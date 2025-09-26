'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import useStore from '@/app/lib/store';
import WalletUtilService from '@/app/lib/wallet-util-service.mjs';
import { CONTRACT_NAME, DEFAULT_SIZE, PIXEL_PRICE_WEI } from '@/app/lib/addresses';
import { usePixelLoadingAnimation } from './PixelLoadingAnimation';
import { startXianPaintMonitor } from '@/app/lib/js/xian-ws-monitor';

const CANVAS_SIZE = 500;
const DEFAULT_PIXEL_SIZE = 10;

export default function Section() {
    const canvasRef = useRef(null);
    const [pixels, setPixels] = useState(new Map());
    const [selected, setSelected] = useState('#ff0055');
    const [loading, setLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const { loadingPixels, setLoadingPixels, generateLoadingPixels, drawLoadingAnimation } = usePixelLoadingAnimation();
    const [txStatus, setTxStatus] = useState('');
    const [feeWei, setFeeWei] = useState(BigInt(PIXEL_PRICE_WEI));
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 50, y: 50 }); // Start with (0,0) at top-left with small margin
    const [isPanning, setIsPanning] = useState(false);
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [hoveredPixel, setHoveredPixel] = useState(null);
    const [showControls, setShowControls] = useState(true);
    const [ctrlPressed, setCtrlPressed] = useState(false);
    const [mouseDownPos, setMouseDownPos] = useState(null);
    const [hasDragged, setHasDragged] = useState(false);

    const walletAddress = useStore(state => state.walletAddress);
    const isConnected = useStore(state => state.isConnected);
    const setWalletAddress = useStore(state => state.setWalletAddress);

    const pixelSize = DEFAULT_PIXEL_SIZE * zoom;

    // Draw the canvas
    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.fillStyle = '#0a0b0f';
        ctx.fillRect(0, 0, width, height);

        // Soft vignette/glow to match pink/white palette
        const g1 = ctx.createRadialGradient(width * 0.7, -200, 0, width * 0.7, -200, Math.max(width, height));
        g1.addColorStop(0, 'rgba(255, 255, 255, 0.06)');
        g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g1;
        ctx.fillRect(0, 0, width, height);

        const g2 = ctx.createRadialGradient(-200, height * 0.8, 0, -200, height * 0.8, Math.max(width, height));
        g2.addColorStop(0, 'rgba(255, 0, 85, 0.10)');
        g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = g2;
        ctx.fillRect(0, 0, width, height);

        // Draw grid background with subtle lines (white/pink theme)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;

        const startX = offset.x % pixelSize;
        const startY = offset.y % pixelSize;

        for (let x = startX; x < width; x += pixelSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        for (let y = startY; y < height; y += pixelSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw pixels
        pixels.forEach((color, key) => {
            const [px, py] = key.split(':').map(Number);
            const screenX = px * pixelSize + offset.x;
            const screenY = py * pixelSize + offset.y;

            if (screenX > -pixelSize && screenX < width &&
                screenY > -pixelSize && screenY < height) {
                ctx.fillStyle = color;
                // Add a small gap (1.5px) between pixels for better visibility
                ctx.fillRect(screenX + 0.5, screenY + 0.5, pixelSize - 1.5, pixelSize - 1.5);
            }
        });

        // Draw canvas border to show limits (subtle, less prominent)
        const borderX = offset.x;
        const borderY = offset.y;
        const borderSize = CANVAS_SIZE * pixelSize;

        // Outer subtle white border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(borderX, borderY, borderSize, borderSize);

        // Inner faint pink accent border
        ctx.strokeStyle = 'rgba(255, 0, 85, 0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(borderX + 1, borderY + 1, borderSize - 2, borderSize - 2);

        // Draw grid lines for better pixel visualization when zoomed in
        if (zoom > 2) {
            ctx.strokeStyle = '#444444';
            ctx.lineWidth = 0.5;
            ctx.globalAlpha = 0.3;

            // Vertical lines
            for (let x = 0; x <= CANVAS_SIZE; x += 10) {
                const lineX = borderX + x * pixelSize;
                ctx.beginPath();
                ctx.moveTo(lineX, borderY);
                ctx.lineTo(lineX, borderY + borderSize);
                ctx.stroke();
            }

            // Horizontal lines  
            for (let y = 0; y <= CANVAS_SIZE; y += 10) {
                const lineY = borderY + y * pixelSize;
                ctx.beginPath();
                ctx.moveTo(borderX, lineY);
                ctx.lineTo(borderX + borderSize, lineY);
                ctx.stroke();
            }

            ctx.globalAlpha = 1.0;
        }

        // Draw loading animation
        if (loading) {
            const canvas = canvasRef.current;
            drawLoadingAnimation(ctx, {
                isLoading: loading,
                progress: loadingProgress,
                offset,
                pixelSize,
                canvasWidth: canvas?.width || 0,
                canvasHeight: canvas?.height || 0,
                loadingPixels
            });
        }

        // Draw hover effect
        if (hoveredPixel && !loading) {
            const screenX = hoveredPixel.x * pixelSize + offset.x;
            const screenY = hoveredPixel.y * pixelSize + offset.y;

            ctx.strokeStyle = '#FF0055';
            ctx.lineWidth = 2;
            ctx.strokeRect(screenX - 1, screenY - 1, pixelSize + 1, pixelSize + 1);

            // Draw coordinates
            ctx.fillStyle = '#ffd1e0';
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillText(`(${hoveredPixel.x}, ${hoveredPixel.y})`, screenX + pixelSize + 5, screenY + pixelSize / 2);
        }
    }, [pixels, offset, zoom, hoveredPixel, loading, loadingProgress, loadingPixels, drawLoadingAnimation]);

    // Canvas resize handler
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                draw();
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [draw]);

    // Realtime paints via WebSocket
    useEffect(() => {
        let stop = null;
        try {
            stop = startXianPaintMonitor({
                contractName: CONTRACT_NAME,
                onPaint: async ({ x, y, color }) => {
                    // Optimistic update
                    setPixels(prev => {
                        const next = new Map(prev);
                        if (color) next.set(`${x}:${y}`, color);
                        return next;
                    });
                    // Refetch the single pixel from GraphQL to confirm
                    try {
                        const key = `${CONTRACT_NAME}.pixels:${x}:${y}`;
                        const confirmed = await queryGraphQL(key);
                        if (confirmed) {
                            setPixels(prev => {
                                const next = new Map(prev);
                                next.set(`${x}:${y}`, confirmed);
                                return next;
                            });
                        }
                    } catch { }
                },
                onContractTx: async (payload) => {
                    // For other methods to this contract, you could trigger broader refetches if needed
                },
                onStatus: (msg) => {
                    // Optional: surface minimal status to user
                    // setTxStatus(msg);
                }
            });
        } catch (e) {
            // noop
        }
        return () => {
            try { if (typeof stop === 'function') stop(); } catch { }
        };
    }, [CONTRACT_NAME]);

    // Set initial canvas position on mount
    useEffect(() => {
        // Small delay to ensure canvas is properly initialized
        const timer = setTimeout(() => {
            setOffset({ x: 50, y: 50 });
        }, 100);

        return () => clearTimeout(timer);
    }, []); // Empty dependency array - runs only once on mount

    // Loading animation loop
    useEffect(() => {
        if (!loading) return;

        const canvas = canvasRef.current;
        if (canvas) {
            setLoadingPixels(generateLoadingPixels(canvas.width, canvas.height));
        }

        let animationFrame;
        const animate = () => {
            if (loading) {
                draw();
                animationFrame = requestAnimationFrame(animate);
            }
        };
        animate();

        return () => {
            if (animationFrame) {
                cancelAnimationFrame(animationFrame);
            }
        };
    }, [loading, draw, generateLoadingPixels, setLoadingPixels]);

    // Track Ctrl key state
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey || e.metaKey) {
                setCtrlPressed(true);
            }
        };

        const handleKeyUp = (e) => {
            if (!e.ctrlKey && !e.metaKey) {
                setCtrlPressed(false);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', () => setCtrlPressed(false));

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', () => setCtrlPressed(false));
        };
    }, []);

    // Redraw when state changes
    useEffect(() => {
        draw();
    }, [draw]);

    // Mouse handlers
    const getPixelCoords = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const pixelX = Math.floor((x - offset.x) / pixelSize);
        const pixelY = Math.floor((y - offset.y) / pixelSize);

        if (pixelX >= 0 && pixelX < CANVAS_SIZE && pixelY >= 0 && pixelY < CANVAS_SIZE) {
            return { x: pixelX, y: pixelY };
        }
        return null;
    };

    const handleMouseMove = (e) => {
        const coords = getPixelCoords(e);
        setHoveredPixel(coords);

        if (isPanning) {
            const deltaX = e.clientX - lastMousePos.x;
            const deltaY = e.clientY - lastMousePos.y;

            setOffset(prev => {
                const canvas = canvasRef.current;
                if (!canvas) return prev;

                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                const actualCanvasSize = CANVAS_SIZE * pixelSize;

                // Calculate new offset
                let newX = prev.x + deltaX;
                let newY = prev.y + deltaY;

                // Apply boundary constraints
                // Keep the canvas accessible - ensure (0,0) can always be reached
                const margin = 50; // Minimum margin from screen edges
                const maxX = canvasWidth - margin; // Don't let left edge go too far right
                const minX = margin - actualCanvasSize; // Don't let right edge go too far left
                const maxY = canvasHeight - margin; // Don't let top edge go too far down  
                const minY = margin - actualCanvasSize; // Don't let bottom edge go too far up

                newX = Math.max(minX, Math.min(maxX, newX));
                newY = Math.max(minY, Math.min(maxY, newY));

                return { x: newX, y: newY };
            });

            setLastMousePos({ x: e.clientX, y: e.clientY });

            // Check if mouse has moved enough to be considered a drag
            if (mouseDownPos && !hasDragged) {
                const distance = Math.sqrt(
                    Math.pow(e.clientX - mouseDownPos.x, 2) +
                    Math.pow(e.clientY - mouseDownPos.y, 2)
                );
                if (distance > 5) { // 5 pixel threshold
                    setHasDragged(true);
                }
            }
        }
    };

    const handleMouseDown = (e) => {
        // Store mouse down position for drag detection
        setMouseDownPos({ x: e.clientX, y: e.clientY });
        setHasDragged(false);

        if (e.button === 1 || (e.button === 0 && (e.ctrlKey || e.metaKey))) {
            setIsPanning(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
            e.preventDefault();
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        setMouseDownPos(null);
    };

    const handleClick = async (e) => {
        // Only paint if left click without Ctrl key and not dragging
        if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !hasDragged) {
            const coords = getPixelCoords(e);
            if (coords) {
                await handlePaint(coords.x, coords.y);
            }
        }
    };

    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            setZoom(prev => {
                const newZoom = Math.max(0.1, Math.min(4, prev * delta));

                // Apply boundary constraints when zoom changes
                requestAnimationFrame(() => {
                    const canvas = canvasRef.current;
                    if (canvas) {
                        setOffset(currentOffset => {
                            const canvasWidth = canvas.width;
                            const canvasHeight = canvas.height;
                            const actualCanvasSize = CANVAS_SIZE * (DEFAULT_PIXEL_SIZE * newZoom);

                            const margin = 50;
                            const maxX = canvasWidth - margin;
                            const minX = margin - actualCanvasSize;
                            const maxY = canvasHeight - margin;
                            const minY = margin - actualCanvasSize;

                            const constrainedX = Math.max(minX, Math.min(maxX, currentOffset.x));
                            const constrainedY = Math.max(minY, Math.min(maxY, currentOffset.y));

                            return { x: constrainedX, y: constrainedY };
                        });
                    }
                });

                return newZoom;
            });
        }
    };

    // Zoom controls
    const handleZoomIn = () => {
        setZoom(prev => {
            const newZoom = Math.min(prev * 1.5, 4);
            applyBoundaryConstraints(newZoom);
            return newZoom;
        });
    };

    const handleZoomOut = () => {
        setZoom(prev => {
            const newZoom = Math.max(prev / 1.5, 0.1);
            applyBoundaryConstraints(newZoom);
            return newZoom;
        });
    };

    const applyBoundaryConstraints = (zoomLevel) => {
        requestAnimationFrame(() => {
            const canvas = canvasRef.current;
            if (canvas) {
                setOffset(currentOffset => {
                    const canvasWidth = canvas.width;
                    const canvasHeight = canvas.height;
                    const actualCanvasSize = CANVAS_SIZE * (DEFAULT_PIXEL_SIZE * zoomLevel);

                    const margin = 50;
                    const maxX = canvasWidth - margin;
                    const minX = margin - actualCanvasSize;
                    const maxY = canvasHeight - margin;
                    const minY = margin - actualCanvasSize;

                    const constrainedX = Math.max(minX, Math.min(maxX, currentOffset.x));
                    const constrainedY = Math.max(minY, Math.min(maxY, currentOffset.y));

                    return { x: constrainedX, y: constrainedY };
                });
            }
        });
    };
    const handleResetView = () => {
        setZoom(1);
        // Position canvas so (0,0) is at top-left with small margin
        setOffset({ x: 50, y: 50 });
    };

    // GraphQL queries
    const queryGraphQL = useCallback(async (key) => {
        const BDS_URL = process.env.NEXT_PUBLIC_XIAN_BDS || 'https://devnet.xian.org/graphql';
        const query = `
            query State($key: String!) {
                stateByKey(key: $key) {
                    value
                }
            }
        `;

        const res = await fetch(BDS_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                query,
                variables: { key }
            }),
        });
        const json = await res.json();
        return json?.data?.stateByKey?.value;
    }, []);

    const loadCanvasViaGraphQL = useCallback(async () => {
        setLoading(true);
        setLoadingProgress(0);
        setLoadingPixels([]);

        try {
            const BDS_URL = process.env.NEXT_PUBLIC_XIAN_BDS || 'https://devnet.xian.org/graphql';
            const prefix = `${CONTRACT_NAME}.pixels:`;
            const entries = [];
            let offset = 0;
            let totalProcessed = 0;
            let estimatedTotal = 5000; // Initial estimate

            const query = `
                query Pixels($first: Int!, $offset: Int!, $prefix: String!) {
                    allStates(first: $first, offset: $offset, filter: { key: { startsWith: $prefix }}) {
                        nodes { key value }
                    }
                }
            `;

            while (true) {
                const res = await fetch(BDS_URL, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        query,
                        variables: { first: 1000, offset, prefix },
                    }),
                });
                const json = await res.json();
                const nodes = json?.data?.allStates?.nodes || [];
                if (!nodes.length) break;

                for (const { key, value } of nodes) {
                    const parts = key.split(':');
                    const x = Number(parts[parts.length - 2]);
                    const y = Number(parts[parts.length - 1]);
                    if (value) {
                        entries.push([`${x}:${y}`, value]);
                    }
                }

                offset += nodes.length;
                totalProcessed += nodes.length;

                // Update progress with dynamic estimation
                if (nodes.length === 1000) {
                    // Still getting full batches, estimate more
                    estimatedTotal = Math.max(estimatedTotal, totalProcessed * 2);
                    setLoadingProgress(Math.min(85, (totalProcessed / estimatedTotal) * 100));
                } else {
                    // Last batch, we know the total
                    setLoadingProgress(95);
                }

                // Small delay to show progress animation
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            setLoadingProgress(100);
            setPixels(new Map(entries));

            // Keep loading animation visible for a moment to show completion
            setTimeout(() => {
                setLoading(false);
                setLoadingProgress(0);
                setLoadingPixels([]);
            }, 500);

        } catch (error) {
            console.error('GraphQL BDS failed:', error);
            setLoading(false);
            setLoadingProgress(0);
            setLoadingPixels([]);
        }
    }, []);

    // Load canvas data on initial mount (after loadCanvasViaGraphQL is defined)
    useEffect(() => {
        const timer = setTimeout(() => {
            loadCanvasViaGraphQL();
        }, 200); // Small delay after canvas position is set

        return () => clearTimeout(timer);
    }, [loadCanvasViaGraphQL]);

    const waitForTransactionConfirmation = useCallback(async (x, y, expectedColor) => {
        const key = `${CONTRACT_NAME}.pixels:${x}:${y}`;
        const maxRetries = 10;
        let retryCount = 0;
        let delay = 1000; // Start with 1 second

        while (retryCount < maxRetries) {
            try {
                setTxStatus(`Checking confirmation... (${retryCount + 1}/${maxRetries})`);

                // Query the blockchain state
                const storedColor = await queryGraphQL(key);

                if (storedColor === expectedColor) {
                    setTxStatus('Success! Pixel painted and confirmed!');
                    setPixels(prev => {
                        const next = new Map(prev);
                        next.set(`${x}:${y}`, expectedColor);
                        return next;
                    });
                    return;
                }

                retryCount++;
                if (retryCount < maxRetries) {
                    setTxStatus(`Transaction pending... retrying in ${delay / 1000}s (${retryCount}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay = Math.min(delay * 1.5, 5000); // Exponential backoff with max 5s
                }
            } catch (error) {
                console.error('Error checking transaction confirmation:', error);
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay = Math.min(delay * 1.5, 5000);
                }
            }
        }

        // If we reach here, max retries exceeded
        setTxStatus('Transaction may still be processing. Refreshing canvas...');
        await loadCanvasViaGraphQL();
        setTxStatus('Canvas refreshed! Check if your pixel appeared.');
    }, [queryGraphQL, loadCanvasViaGraphQL]);

    useEffect(() => {
        loadCanvasViaGraphQL();
        // Center the view on the canvas
        setOffset({ x: window.innerWidth / 2 - (50 * DEFAULT_PIXEL_SIZE) / 2, y: window.innerHeight / 2 - (50 * DEFAULT_PIXEL_SIZE) / 2 });
    }, [loadCanvasViaGraphQL]);

    const ensureConnected = useCallback(async () => {
        if (isConnected) return true;
        try {
            const w = WalletUtilService.getInstance().XianWalletUtils;
            const info = await w.requestWalletInfo();
            const address = info?.address || info?.wallet?.address || null;
            setWalletAddress(address);
            return !!address;
        } catch {
            return false;
        }
    }, [isConnected, setWalletAddress]);

    const handlePaint = useCallback(async (x, y) => {
        if (!(await ensureConnected())) {
            setTxStatus('Connect wallet first');
            return;
        }

        const w = WalletUtilService.getInstance().XianWalletUtils;
        setTxStatus(`Painting pixel at (${x}, ${y})...`);

        try {
            // Step 1: Approve
            setTxStatus('Approving 1 XIAN...');
            const approveResult = await w.sendTransaction('currency', 'approve', {
                to: CONTRACT_NAME,
                amount: 1.0
            });

            // Check if approval actually failed (errors array present) vs just pending/processing
            if (approveResult && 'errors' in approveResult && approveResult.errors && approveResult.errors.length > 0) {
                throw new Error(`Approval failed: ${approveResult.errors.join(', ')}`);
            }

            // Step 2: Paint
            setTxStatus('Painting pixel...');
            const paintResult = await w.sendTransaction(CONTRACT_NAME, 'paint', {
                x: x,
                y: y,
                color: selected
            });

            // Check if paint actually failed (errors array present) vs just pending/processing
            if (paintResult && 'errors' in paintResult && paintResult.errors && paintResult.errors.length > 0) {
                throw new Error(`Paint failed: ${paintResult.errors.join(', ')}`);
            }

            // Both transactions were submitted successfully
            setTxStatus('Transactions submitted! Waiting for blockchain confirmation...');

            // Poll for the transaction result with exponential backoff
            await waitForTransactionConfirmation(x, y, selected);

        } catch (e) {
            console.error('Transaction error:', e);
            setTxStatus(e?.message || 'Transaction error.');
        }
    }, [ensureConnected, selected, waitForTransactionConfirmation]);

    return (
        <section className="section fullscreen">
            <canvas
                ref={canvasRef}
                className="pixel-canvas"
                onMouseMove={handleMouseMove}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onClick={handleClick}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                    cursor: isPanning ? 'grabbing' : (ctrlPressed ? 'grab' : 'crosshair')
                }}
            />

            <div className="brand-mini pixel-frame">
                <a href="/" className="brand-mini-link">
                    <span className="brand-mini-text">p<span className="x-accent">X</span>iel</span>
                </a>
            </div>

            <div className={`floating-controls pixel-frame ${showControls ? '' : 'hidden'}`}>
                <button
                    className="toggle-controls"
                    onClick={() => setShowControls(!showControls)}
                >
                    {showControls ? '◀' : '▶'}
                </button>

                <div className="controls-content">
                    <div className="control-group">
                        <label className="label">Color</label>
                        <div className="color-picker-container">
                            <input
                                className="color"
                                type="color"
                                value={selected}
                                onChange={e => setSelected(e.target.value)}
                            />
                            <div className="color-preview">
                                <div className="color-swatch" style={{ backgroundColor: selected }}></div>
                                <span className="color-text">{selected.toUpperCase()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="control-group">
                        <label className="label">Zoom</label>
                        <span className="pill">{Math.round(zoom * 100)}%</span>
                        <button className="btn btn-zoom" onClick={handleZoomOut}>−</button>
                        <button className="btn btn-zoom" onClick={handleZoomIn}>+</button>

                    </div>

                    <div className="control-group">
                        <button className="btn" onClick={loadCanvasViaGraphQL} disabled={loading}>
                            {loading ? 'Loading...' : 'Reload'}
                        </button>
                    </div>

                    {hoveredPixel && (
                        <div className="control-group">
                            <span className="pill">Pixel: ({hoveredPixel.x}, {hoveredPixel.y})</span>
                        </div>
                    )}

                    {txStatus && (
                        <div className="control-group">
                            <div className="status-mini">{txStatus}</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="controls-hint-mini">
                <p>
                    {ctrlPressed ? (
                        <><span style={{ color: '#3b82f6' }}>◆ Pan/Zoom Mode</span> | Release <kbd>Ctrl/Cmd</kbd> to paint</>
                    ) : (
                        <><kbd>Ctrl/Cmd+Scroll</kbd> Zoom | <kbd>Ctrl/Cmd+Drag</kbd> Pan | <kbd>Click</kbd> Paint</>
                    )}
                </p>
            </div>
        </section>
    );
}