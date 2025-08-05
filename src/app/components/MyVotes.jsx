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

const CONTRACT = "con_xipoll_v0";

const MyVotes = () => {
    const router = useRouter();
    const xianWalletUtilInstance = WalletUtilService.getInstance().XianWalletUtils;
    const { addUserVote } = useStore();
    const { polls, loading, error } = usePollsQuery();
    const [votingPolls, setVotingPolls] = useState(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('newest');
    useEffect(() => {
        if (xianWalletUtilInstance && !xianWalletUtilInstance.initialized) {
            xianWalletUtilInstance.init();
        }
    }, [xianWalletUtilInstance]);

    // Filter polls where user has voted
    const userVotedPolls = polls.filter(poll => (poll.userVote || 0) > 0);

    // Filter and sort polls
    const filteredPolls = userVotedPolls
        .filter(poll =>
            poll.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            poll.creator.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            switch (sortBy) {
                case 'newest':
                    return new Date(b.createdAt) - new Date(a.createdAt);
                case 'oldest':
                    return new Date(a.createdAt) - new Date(b.createdAt);
                case 'ending-soon':
                    return new Date(a.endDate) - new Date(b.endDate);
                case 'most-time-left':
                    return new Date(b.endDate) - new Date(a.endDate);
                case 'ended':
                    return a.isActive ? 1 : -1;
                case 'active':
                    return a.isActive ? -1 : 1;
                default:
                    return 0;
            }
        });

    const vote = async (pollId, optionId) => {
        if (votingPolls.has(pollId)) return;

        setVotingPolls(prev => new Set(prev).add(pollId));

        try {
            await xianWalletUtilInstance.sendTransaction(
                CONTRACT,
                "vote",
                { poll_id: parseInt(pollId), option_id: parseInt(optionId) }
            );

            addUserVote(pollId, optionId);
            handleVoteSubmission();
        } catch (error) {
            console.error('Vote error:', error);
            handlePollError(error);
        } finally {
            setVotingPolls(prev => {
                const newSet = new Set(prev);
                newSet.delete(pollId);
                return newSet;
            });
        }
    };

    const getVotePercentage = (votes, total) => total > 0 ? Math.round((votes / total) * 100) : 0;
    const hasVoted = (poll) => (poll.userVote || 0) > 0;
    const pollExpired = (poll) => !poll.isActive;

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

    const handlePollClick = (pollId) => {
        router.push(`/poll/${pollId}`);
    };

    if (loading) {
        return (
            <section className="section">
                <div className="container">
                    <div className="loading-state">
                        <div className="spinner" />
                        <p>Loading your votes...</p>
                    </div>
                </div>
            </section>
        );
    }

    if (error) {
        return (
            <section className="section">
                <div className="container">
                    <div className="error-state">
                        <h2>Error Loading Votes</h2>
                        <p>{error.message || 'Failed to load your votes.'}</p>
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

                {/* Header */}
                <div className="my-votes-header">
                    <h1 className="logo-text" >My Votes</h1>
                    <p className="page-subtitle">
                        You have voted in {userVotedPolls.length} poll{userVotedPolls.length !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* Search and Sort Controls */}
                <div className="action-bar">
                    <div className="action-left">
                        <div className="search-container">
                            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Search your votes..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="action-right">
                        <div className="select">
                            <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                                <option value="ending-soon">Ending Soon</option>
                                <option value="most-time-left">Most Time Left</option>
                                <option value="ended">Ended Polls</option>
                                <option value="active">Active Polls</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Polls List */}
                {filteredPolls.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 12l2 2 4-4"></path>
                                <circle cx="12" cy="12" r="10"></circle>
                            </svg>
                        </div>
                        <h3>No Votes Yet</h3>
                        <p>You haven't voted in any polls yet. Start participating in governance!</p>
                        <button className="btn btn-primary" onClick={() => router.push('/')}>
                            Browse Polls
                        </button>
                    </div>
                ) : (
                    <div className="polls-grid">
                        {filteredPolls.map((poll) => {
                            const userVote = poll.userVote || 0;
                            const votedOption = poll.options?.find(opt =>
                                (opt.id || opt.option_id) === userVote ||
                                (typeof opt === 'object' && opt.text && opt.text === poll.options[userVote - 1]?.text)
                            );

                            return (
                                <div key={poll.id} className="poll-card" onClick={() => handlePollClick(poll.id)}>
                                    <div className="poll-header">
                                        <div className="poll-title">{poll.title}</div>
                                        <div className="poll-meta">
                                            <span className="creator">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                    <circle cx="12" cy="7" r="4"></circle>
                                                </svg>
                                                {truncateAddress(poll.creator)}
                                            </span>
                                            <span className="token">
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <path d="M14.31 8l5.74 9.94"></path>
                                                    <path d="M9.69 8h11.48"></path>
                                                    <path d="M7.38 12l5.74-9.94"></path>
                                                    <path d="M9.69 16H2.21"></path>
                                                    <path d="M14.31 16l-5.74-9.94"></path>
                                                </svg>
                                                {formatTokenName(poll.tokenContract)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="poll-content">
                                        <div className="poll-stats">
                                            <div className="stat">
                                                <span className="stat-label">Total Votes</span>
                                                <span className="stat-value">{poll.totalVotes || 0}</span>
                                            </div>
                                        </div>

                                        <div className="your-vote-section">
                                            <div className="vote-label">Your Vote:</div>
                                            <div className="voted-option">
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <polyline points="20,6 9,17 4,12"></polyline>
                                                </svg>
                                                {votedOption?.text || `Option ${userVote}`}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="poll-footer">
                                        <div className="poll-status">
                                            {pollExpired(poll) ? (
                                                <span className="tag tag-warning">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="10"></circle>
                                                        <polyline points="12,6 12,12 16,14"></polyline>
                                                    </svg>
                                                    Ended
                                                </span>
                                            ) : (
                                                <span className="tag tag-info">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="10"></circle>
                                                        <polyline points="12,6 12,12 16,14"></polyline>
                                                    </svg>
                                                    {getTimeRemaining(poll.endDate)}
                                                </span>
                                            )}
                                        </div>
                                        <button className="btn btn-secondary btn-sm">
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </section>
    );
};

export default MyVotes; 