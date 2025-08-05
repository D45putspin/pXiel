"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useStore from "../lib/store";
import {
    handleVoteSubmission,
    handlePollError
} from "../lib/js/main";
import WalletUtilService from '../lib/wallet-util-service';
import { usePollsQuery } from '../fn/usePollsQuery';

const CONTRACT = "con_xipoll_v0_clean_clean";

const PollDetail = ({ pollId }) => {
    const router = useRouter();
    const xianWalletUtilInstance = WalletUtilService.getInstance().XianWalletUtils;
    const { addUserVote } = useStore();
    const [voting, setVoting] = useState(false);

    // Use GraphQL query instead of fetchAllPolls
    const { polls, loading, error, refetch } = usePollsQuery();

    // Find the specific poll from the query results
    const poll = polls.find(p => p.id.toString() === pollId.toString());

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

    // simplified single source of truth for voting state
    const hasVoted = (p) => (p?.userVote ?? 0) > 0;

    const vote = async (optionId) => {
        if (voting || !poll) return;
        setVoting(true);

        try {
            await xianWalletUtilInstance.sendTransaction(
                CONTRACT,
                "vote",
                { poll_id: Number(poll.id), option_id: Number(optionId) }
            );

            // optimistic update in store
            addUserVote(poll.id, optionId);
            handleVoteSubmission();

            // Refetch data to get updated on-chain state
            await refetch();
        } catch (err) {
            console.error('Vote error:', err);
            handlePollError(err);
        } finally {
            setVoting(false);
        }
    };

    const getVotePercentage = (votes, total) =>
        total > 0 ? Math.round((votes / total) * 100) : 0;

    const pollExpired = (p) => !p?.isActive;

    const getTimeRemaining = (endDate) => {
        if (!endDate) return null;
        const now = new Date();
        const diff = endDate.getTime() - now.getTime();
        if (diff <= 0) return 'Ended';
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        if (days > 0) return `${days}d ${hours}h`;
        if (hours > 0) return `${hours}h ${mins}m`;
        return `${mins}m`;
    };

    const formatTokenName = (contract) => {
        if (!contract) return 'Unknown Token';
        return contract
            .replace(/^con_/, '')
            .replace(/^token/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
    };

    const truncateAddress = (address, max = 20) => {
        if (!address) return '';
        return address.length <= max ? address : `${address.slice(0, max - 3)}...`;
    };

    const copyToClipboard = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const getEmbedCode = () => {
        const url = `${baseUrl}/embed/poll/${poll.id}`;
        return `<iframe
  src="${url}"
  width="500px"
  height="800px"
  frameborder="0"
  scrolling="yes"
  style="border:1px solid #ddd; border-radius:8px;"
  title="XiPOLL - ${poll.title}"
></iframe>`;
    };

    const handleSharePoll = async () => {
        const code = getEmbedCode();
        await copyToClipboard(code);
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
                        <p>{error?.message || 'The poll you are looking for does not exist.'}</p>
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
                            <polyline points="15,18 9,12 15,6" />
                        </svg>
                        Back to Polls
                    </button>
                </div>

                {/* Poll Header */}
                <div className="poll-detail-header">
                    <div className="poll-title-section">
                        <h1 className="poll-title">{poll.title}</h1>
                        <div className="poll-meta">
                            <span className="creator">Created by {poll.creator}</span>
                            <span className="token">{formatTokenName(poll.tokenContract)}</span>
                        </div>
                    </div>
                    <div className="poll-status-section">
                        {hasVoted(poll) && <span className="tag tag-success">You Voted</span>}
                        {pollExpired(poll) ? (
                            <span className="tag tag-warning">Poll Ended</span>
                        ) : (
                            <span className="tag tag-info">{getTimeRemaining(poll.endDate)} remaining</span>
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
                        <span className="token-name">{formatTokenName(poll.tokenContract)}</span>
                        {poll.tokenContract && (
                            <button
                                className="token-ioqpoqz-btn"
                                onClick={() => copyToClipboard(poll.tokenContract)}
                                title="Copy contract address"
                            >
                                {truncateAddress(poll.tokenContract)}
                            </button>
                        )}
                    </div>
                </div>

                {/* Voting Options */}
                <div className="poll-options-detail">
                    <h3>Vote Options</h3>
                    <div className="options-list">
                        {poll.options.map(opt => {
                            console.log('Option data:', opt);
                            const votes = opt.votes ?? 0;
                            const votingPower = opt.voting_power ?? votes;
                            const pct = getVotePercentage(votingPower, poll.totalVotingPower);
                            const votedThis = poll.userVote === opt.id;

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
                                                            <polyline points="20,6 9,17 4,12" />
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
                                                        <path d="M21 12a9 9 0 11-6.219-8.56" />
                                                    </svg>
                                                    Voting...
                                                </>
                                            ) : votedThis ? (
                                                <>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="20,6 9,17 4,12" />
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
                                        <div className="progress-bar" style={{ width: `${pct}%` }} />
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
                    <pre className="embed-code-pre">{getEmbedCode()}</pre>
                    <button className="btn btn-primary" onClick={handleSharePoll}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                        Copy Embed Code
                    </button>
                </div>

                {/* Embed Preview Section */}
                <div className="embed-preview-section">
                    <h3>Preview</h3>
                    <p>Here's how the embedded poll will look on other websites:</p>
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
