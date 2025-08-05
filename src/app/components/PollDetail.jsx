"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useStore from "../lib/store";
import {
    handleVoteSubmission,
    handlePollError
} from "../lib/js/main";
import WalletUtilService from '../lib/wallet-util-service';

const CONTRACT = "con_xipoll_v0";

const PollDetail = ({ pollId }) => {
    const router = useRouter();
    const xianWalletUtilInstance = WalletUtilService.getInstance().XianWalletUtils;
    const { addUserVote } = useStore();
    const [poll, setPoll] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [voting, setVoting] = useState(false);

    useEffect(() => {
        if (xianWalletUtilInstance && !xianWalletUtilInstance.initialized) {
            xianWalletUtilInstance.init();
        }
    }, [xianWalletUtilInstance]);

    const toDate = (maybeString) => {
        if (!maybeString) return null;
        const ms = Date.parse(maybeString);
        return Number.isNaN(ms) ? null : new Date(ms);
    };

    useEffect(() => {
        async function fetchPoll() {
            try {
                setLoading(true);
                const walletInfo = await xianWalletUtilInstance.requestWalletInfo();
                const address = walletInfo.address;
                const rawPolls = await xianWalletUtilInstance.fetchAllPolls(CONTRACT);

                const targetPoll = rawPolls.find(p => p.id.toString() === pollId.toString());

                if (!targetPoll) {
                    setError('Poll not found');
                    setLoading(false);
                    return;
                }

                const createdStr = targetPoll.created_at ?? targetPoll.createdAt;
                const endStr = targetPoll.end_date ?? targetPoll.endDate;
                const createdAt = toDate(createdStr);
                const endDate = toDate(endStr);
                const userVote = await xianWalletUtilInstance.getUserVote(CONTRACT, targetPoll.id, address);

                // Normalize options with vote counts
                let options = [];
                if (Array.isArray(targetPoll.options)) {
                    options = targetPoll.options.map((opt, idx) => {
                        const id = typeof opt === 'object' && opt !== null
                            ? (opt.id ?? opt.option_id ?? idx + 1)
                            : idx + 1;
                        const text = typeof opt === 'object' && opt !== null
                            ? (opt.text ?? opt.option ?? String(opt))
                            : String(opt);
                        const votes = opt.votes ?? 0;
                        const voting_power = opt.voting_power ?? opt.votes ?? 0;
                        return { id, text, votes, voting_power };
                    });
                } else if (targetPoll.options && typeof targetPoll.options === 'object') {
                    options = Object.entries(targetPoll.options).map(([key, value], idx) => ({
                        id: parseInt(key) || idx + 1,
                        text: typeof value === 'string'
                            ? value
                            : (value?.text ?? String(value)),
                        votes: value.votes ?? 0,
                        voting_power: value.voting_power ?? value.votes ?? 0
                    }));
                }

                const pollData = {
                    id: targetPoll.id,
                    title: targetPoll.title || 'Untitled Poll',
                    options,
                    totalVotes: targetPoll.total_votes ?? targetPoll.totalVotes ?? 0,
                    totalVotingPower: targetPoll.total_voting_power ?? targetPoll.totalVotingPower ?? 0,
                    token_contract: targetPoll.token_contract ?? targetPoll.tokenContract,
                    creator: targetPoll.creator || 'Unknown',
                    createdAt,
                    endDate,
                    isActive: endDate ? (new Date() <= endDate) : false,
                    userVote: userVote || 0
                };

                setPoll(pollData);
            } catch (err) {
                console.error("Failed to fetch poll:", err);
                setError('Failed to load poll');
            } finally {
                setLoading(false);
            }
        }

        if (xianWalletUtilInstance && pollId) {
            fetchPoll();
        }
    }, [pollId, xianWalletUtilInstance]);

    const vote = async (optionId) => {
        if (voting || !poll) return;

        setVoting(true);

        try {
            await xianWalletUtilInstance.sendTransaction(
                CONTRACT,
                "vote",
                { poll_id: parseInt(poll.id), option_id: parseInt(optionId) }
            );

            addUserVote(poll.id, optionId);
            handleVoteSubmission();

            // Refresh poll data
            const walletInfo = await xianWalletUtilInstance.requestWalletInfo();
            const address = walletInfo.address;
            const rawPolls = await xianWalletUtilInstance.fetchAllPolls(CONTRACT);
            const targetPoll = rawPolls.find(p => p.id.toString() === pollId.toString());

            if (targetPoll) {
                const userVote = await xianWalletUtilInstance.getUserVote(CONTRACT, targetPoll.id, address);

                // Update poll with new data
                setPoll(prev => ({
                    ...prev,
                    userVote: userVote || 0,
                    options: prev.options.map(opt => {
                        const updatedOpt = targetPoll.options.find(t =>
                            (t.id || t.option_id) === opt.id ||
                            (typeof t === 'object' && t.text === opt.text)
                        );
                        return {
                            ...opt,
                            votes: updatedOpt?.votes ?? opt.votes,
                            voting_power: updatedOpt?.voting_power ?? opt.voting_power
                        };
                    }),
                    totalVotes: targetPoll.total_votes ?? targetPoll.totalVotes ?? 0,
                    totalVotingPower: targetPoll.total_voting_power ?? targetPoll.totalVotingPower ?? 0
                }));
            }
        } catch (error) {
            console.error('Vote error:', error);
            handlePollError(error);
        } finally {
            setVoting(false);
        }
    };

    const getVotePercentage = (votes, total) => total > 0 ? Math.round((votes / total) * 100) : 0;
    const hasVoted = (poll) => (poll?.userVote || 0) > 0;
    const pollExpired = (poll) => !poll?.isActive;

    const getTimeRemaining = (endDate) => {
        if (!endDate) return null;
        const now = new Date();
        const diff = endDate.getTime() - now.getTime();

        if (diff <= 0) return 'Ended';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    };

    const formatTokenName = (tokenContract) => {
        if (!tokenContract) return 'Unknown Token';

        const cleanName = tokenContract
            .replace(/^con_/, '')
            .replace(/^token/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());

        return cleanName || 'Unknown Token';
    };

    const truncateAddress = (address, maxLength = 20) => {
        if (!address) return '';
        if (address.length <= maxLength) return address;
        return address.slice(0, maxLength - 3) + '...';
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            console.log('Copied to clipboard:', text);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const getEmbedCode = () => {

        const embedUrl = `${baseUrl}/embed/poll/${poll.id}`;
        return `<iframe 
  src="${embedUrl}"
  width="500px"
  height="800px"
  frameborder="0"
  scrolling="yes"
  style="border: 1px solid #ddd; border-radius: 8px;"
  title="XiPOLL - ${poll.title}"
></iframe>`;
    };

    const handleSharePoll = async () => {
        const embedCode = getEmbedCode();
        await copyToClipboard(embedCode);
        // You could add a toast notification here
        alert('Embed code copied to clipboard!');
    };

    if (loading) {
        return (
            <section className="section">
                <div className="container">
                    <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading poll...</p>
                    </div>
                </div>
            </section>
        );
    }

    if (error || !poll) {
        return (
            <section className="section">
                <div className="container">
                    <div className="error-state">
                        <h2>Poll Not Found</h2>
                        <p>{error || 'The poll you are looking for does not exist.'}</p>
                        <button className="btn btn-primary" onClick={() => router.push('/')}>
                            Back to Polls
                        </button>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="section">
            <div className="container">
                {/* Back Button */}
                <div className="back-button-container">
                    <button className="btn btn-secondary" onClick={() => router.push('/')}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="15,18 9,12 15,6"></polyline>
                        </svg>
                        Back to Polls
                    </button>
                </div>

                {/* Poll Header */}
                <div className="poll-detail-header">
                    <div className="poll-title-section">
                        <h1 className="poll-title">{poll.title}</h1>
                        <div className="poll-meta">
                            <span className="creator">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                </svg>
                                Created by {poll.creator}
                            </span>
                            <span className="token">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <path d="M14.31 8l5.74 9.94"></path>
                                    <path d="M9.69 8h11.48"></path>
                                    <path d="M7.38 12l5.74-9.94"></path>
                                    <path d="M9.69 16H2.21"></path>
                                    <path d="M14.31 16l-5.74-9.94"></path>
                                </svg>
                                {formatTokenName(poll.token_contract)}
                            </span>
                        </div>
                    </div>

                    <div className="poll-status-section">
                        {hasVoted(poll) && (
                            <span className="tag tag-success">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20,6 9,17 4,12"></polyline>
                                </svg>
                                You Voted
                            </span>
                        )}
                        {pollExpired(poll) ? (
                            <span className="tag tag-warning">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                                Poll Ended
                            </span>
                        ) : (
                            <span className="tag tag-info">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10"></circle>
                                    <polyline points="12,6 12,12 16,14"></polyline>
                                </svg>
                                {getTimeRemaining(poll.endDate)} remaining
                            </span>
                        )}
                    </div>
                </div>

                {/* Poll Stats */}
                <div className="poll-stats">
                    <div className="stat-card">
                        <div className="stat-number">{poll.totalVotingPower}</div>
                        <div className="stat-label">Total Voting Power</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{poll.options.length}</div>
                        <div className="stat-label">Options</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-number">{poll.totalVotes}</div>
                        <div className="stat-label">Total Votes</div>
                    </div>
                </div>

                {/* Token Info */}
                <div className="token-info-card">
                    <h3>Voting Token</h3>
                    <div className="token-details">
                        <span className="token-name">{formatTokenName(poll.token_contract)}</span>
                        {poll.token_contract && (
                            <button
                                className="token-copy-btn"
                                onClick={() => copyToClipboard(poll.token_contract)}
                                title="Copy contract address"
                            >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                                </svg>
                                {truncateAddress(poll.token_contract)}
                            </button>
                        )}
                    </div>
                </div>

                {/* Voting Options */}
                <div className="poll-options-detail">
                    <h3>Vote Options</h3>
                    <div className="options-list">
                        {poll.options.map((opt, index) => {
                            const votes = opt.votes ?? 0;
                            const votingPower = opt.voting_power ?? votes;
                            const totalVotes = poll.totalVotes ?? 0;
                            const totalVotingPower = poll.totalVotingPower ?? totalVotes;
                            const pct = getVotePercentage(votingPower, totalVotingPower);
                            const votedThis = hasVoted(poll) && poll.userVote === opt.id;

                            return (
                                <div key={opt.id} className={`poll-option-detail ${votedThis ? 'voted' : ''}`}>
                                    <div className="option-content">
                                        <div className="option-info">
                                            <div className="option-text">{opt.text}</div>
                                            <div className="option-stats">
                                                <span className="voting-power">{votingPower} voting power</span>
                                                <span className="percentage">({pct}%)</span>
                                                {votedThis && (
                                                    <span className="your-vote">
                                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                            <polyline points="20,6 9,17 4,12"></polyline>
                                                        </svg>
                                                        Your Vote
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            className={`btn ${votedThis ? 'btn-success' : hasVoted(poll) ? 'btn-secondary' : 'btn-primary'}`}
                                            onClick={() => vote(opt.id)}
                                            disabled={hasVoted(poll) || pollExpired(poll) || voting}
                                        >
                                            {voting ? (
                                                <>
                                                    <svg className="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M21 12a9 9 0 11-6.219-8.56"></path>
                                                    </svg>
                                                    Voting...
                                                </>
                                            ) : votedThis ? (
                                                <>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="20,6 9,17 4,12"></polyline>
                                                    </svg>
                                                    Voted
                                                </>
                                            ) : hasVoted(poll) ? (
                                                'Already Voted'
                                            ) : (
                                                'Vote'
                                            )}
                                        </button>
                                    </div>
                                    <div className="progress">
                                        <div
                                            className="progress-bar"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Embed Code Section */}
                <div className="embed-code-section">
                    <h3>Embed Poll</h3>
                    <p>Copy and paste this code into your website to embed the poll:</p>
                    <pre className="embed-code-pre">
                        {getEmbedCode()}
                    </pre>
                    <button className="btn btn-primary" onClick={handleSharePoll}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                            <circle cx="9" cy="9" r="2"></circle>
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path>
                        </svg>
                        Copy Embed Code
                    </button>
                </div>

                {/* Embed Preview Section */}
                <div className="embed-preview-section">
                    <h3>Preview</h3>
                    <p>Here&apos;s how the embedded poll will look on other websites:</p>
                    <div className="embed-preview-container">
                        <iframe
                            src={`${baseUrl}/embed/poll/${poll.id}`}
                            width="100%"
                            height="500px"
                            frameBorder="0"
                            scrolling="yes"
                            style={{ border: '1px solid #ddd', borderRadius: '8px' }}
                            title={`XiPOLL - ${poll.title}`}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PollDetail; 