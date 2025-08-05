"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useStore from "../lib/store";
import {
    handlePollCreation,
    handleVoteSubmission,
    handlePollError
} from "../lib/js/main";
import WalletUtilService from '../lib/wallet-util-service';
import { usePollsQuery } from '../fn/usePollsQuery';

const CONTRACT = "con_xipoll_v0";

const Section = () => {
    const router = useRouter();
    const xianWalletUtilInstance = WalletUtilService.getInstance().XianWalletUtils;

    useEffect(() => {
        if (xianWalletUtilInstance && !xianWalletUtilInstance.initialized) {
            xianWalletUtilInstance.init();
        }
    }, [xianWalletUtilInstance]);

    const { polls, loading, error, refetch } = usePollsQuery();
    const { addUserVote } = useStore();

    // Log for debugging
    console.log('Section component:', { polls, loading, error });

    const [newPollTitle, setNewPollTitle] = useState('');
    const [newPollOptions, setNewPollOptions] = useState(['', '']);
    const [newPollTokenContract, setNewPollTokenContract] = useState('currency');
    const [newPollEndDate, setNewPollEndDate] = useState(() => {
        const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        return defaultDate.toISOString().split('T')[0];
    });
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [votingPolls, setVotingPolls] = useState(new Set());
    const [sortBy, setSortBy] = useState('newest');

    const toDate = (maybeString) => {
        if (!maybeString) return null;
        const ms = Date.parse(maybeString);
        return Number.isNaN(ms) ? null : new Date(ms);
    };



    const createPoll = async () => {
        if (!newPollTitle.trim() || newPollOptions.some(opt => !opt.trim()) || !newPollEndDate) {
            alert('Please fill in all fields including the end date');
            return;
        }

        try {
            const endDate = new Date(newPollEndDate);
            const options = newPollOptions.filter(opt => opt.trim());

            await xianWalletUtilInstance.sendTransaction(
                CONTRACT,
                "create_poll",
                {
                    title: newPollTitle.trim(),
                    options,
                    token_contract: newPollTokenContract,
                    end_date: endDate.toISOString().split('T')[0]
                }
            );

            handlePollCreation();
            setNewPollTitle('');
            setNewPollOptions(['', '']);
            setNewPollTokenContract('currency');
            setNewPollEndDate(() => {
                const defaultDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                return defaultDate.toISOString().split('T')[0];
            });
            setShowCreateForm(false);

            // Don't refetch immediately - let the pollInterval handle it
            // The GraphQL query will automatically refresh every 5 seconds
        } catch (error) {
            console.error('Create poll error:', error);
            handlePollError(error);
        }
    };

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

            // Refetch the GraphQL query to get updated poll data
            refetch();
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
    const filteredPolls = (polls || []).filter(poll => {
        if (!searchTerm.trim()) return true;
        const searchLower = searchTerm.toLowerCase();
        const titleMatch = (poll.title || '').toLowerCase().includes(searchLower);
        const tokenMatch = (poll.token_contract || '').toLowerCase().includes(searchLower);
        return titleMatch || tokenMatch;
    });

    const sortedPolls = [...filteredPolls].sort((a, b) => {
        const now = new Date();

        switch (sortBy) {
            case 'newest':
                return b.id - a.id;
            case 'oldest':
                return a.id - b.id;
            case 'ending-soon':
                if (!a.endDate || !b.endDate) return 0;
                return a.endDate.getTime() - b.endDate.getTime();
            case 'most-time-left':
                if (!a.endDate || !b.endDate) return 0;
                return b.endDate.getTime() - a.endDate.getTime();
            case 'ended':
                const aEnded = a.endDate ? now > a.endDate : false;
                const bEnded = b.endDate ? now > b.endDate : false;
                if (aEnded && !bEnded) return -1;
                if (!aEnded && bEnded) return 1;
                return b.id - a.id;
            case 'active':
                const aActive = a.endDate ? now <= a.endDate : true;
                const bActive = b.endDate ? now <= b.endDate : true;
                if (aActive && !bActive) return -1;
                if (!aActive && bActive) return 1;
                return b.id - a.id;
            default:
                return b.id - a.id;
        }
    });

    const addOption = () => setNewPollOptions(prev => [...prev, '']);
    const removeOption = (index) => {
        if (newPollOptions.length <= 2) return;
        setNewPollOptions(prev => prev.filter((_, i) => i !== index));
    };

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

        // Remove common prefixes and format nicely
        const cleanName = tokenContract
            .replace(/^con_/, '') // Remove 'con_' prefix
            .replace(/^token/, '') // Remove 'token' prefix
            .replace(/_/g, ' ') // Replace underscores with spaces
            .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letter of each word

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
            // You could add a toast notification here
            console.log('Copied to clipboard:', text);
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };

    const handlePollClick = (pollId) => {
        router.push(`/poll/${pollId}`);
    };

    return (
        <section className="section">
            <div className="container">
                {/* Hero Section */}
                <div className="hero-section fade-in">
                    <div className="hero-content">
                        <h1 className="hero-title">
                            <span className="gradient-text">XiPOLL</span>
                        </h1>
                        <p className="hero-subtitle">
                            Decentralized <a className='gradient-text'>Polling</a> on the Xian blockchain
                        </p>

                        <div className="hero-stats">
                            <div className="stat-item">
                                <div className="stat-number">{polls.length}</div>
                                <div className="stat-label">Total Polls</div>
                            </div>
                            <div className="stat-item">
                                <div className="stat-number">{polls.filter(p => p.isActive).length}</div>
                                <div className="stat-label">Active</div>
                            </div>
                        </div>
                        <p className="hero-subtitle" style={{ marginTop: '3vh' }}>
                            let your <a className='gradient-text'>Community </a>decide!
                        </p>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="action-bar">
                    <div className="action-left">
                        <button
                            className={`btn btn-primary ${showCreateForm ? 'btn-secondary' : ''}`}
                            onClick={() => setShowCreateForm(!showCreateForm)}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                            {showCreateForm ? 'Cancel' : 'Create Poll'}
                        </button>
                    </div>

                    <div className="action-right">
                        <div className="search-container">
                            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="11" cy="11" r="8"></circle>
                                <path d="m21 21-4.35-4.35"></path>
                            </svg>
                            <input
                                className="search-input"
                                type="text"
                                placeholder="Search polls..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>

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

                {/* Create Poll Form */}
                {showCreateForm && (
                    <div className="create-form-container fade-in">
                        <div className="card create-form">
                            <div className="form-header">
                                <h3>Create New Poll</h3>
                                <p>Set up a new governance proposal</p>
                            </div>

                            <div className="form-grid">
                                <div className="form-field">
                                    <label>Poll Title</label>
                                    <input
                                        className="input"
                                        type="text"
                                        placeholder="Enter poll title..."
                                        value={newPollTitle}
                                        onChange={e => setNewPollTitle(e.target.value)}
                                    />
                                </div>

                                <div className="form-field">
                                    <label>Token Contract</label>
                                    <input
                                        className="input"
                                        type="text"
                                        placeholder="con_token123"
                                        value={newPollTokenContract}
                                        onChange={e => setNewPollTokenContract(e.target.value)}
                                    />
                                    <small>Contract that provides voting weights</small>
                                </div>

                                <div className="form-field">
                                    <label>End Date</label>
                                    <input
                                        className="input"
                                        type="date"
                                        value={newPollEndDate}
                                        onChange={e => setNewPollEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="form-field">
                                <label>Options</label>
                                <div className="options-container">
                                    {newPollOptions.map((opt, i) => (
                                        <div key={i} className="option-input-group">
                                            <input
                                                className="input"
                                                type="text"
                                                placeholder={`Option ${i + 1}`}
                                                value={opt}
                                                onChange={e => {
                                                    const copy = [...newPollOptions];
                                                    copy[i] = e.target.value;
                                                    setNewPollOptions(copy);
                                                }}
                                            />
                                            {newPollOptions.length > 2 && (
                                                <button
                                                    className="btn btn-error"
                                                    onClick={() => removeOption(i)}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <button className="btn btn-secondary" onClick={addOption}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                    Add Option
                                </button>
                            </div>

                            <div className="form-actions">
                                <button className="btn btn-primary" onClick={createPoll}>
                                    Create Poll
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Polls Grid */}
                <div className="polls-container">
                    {sortedPolls.length > 0 ? (
                        <div className="polls-grid">
                            {sortedPolls.map((poll, index) => (
                                <div key={poll.id} className="poll-card fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                                    <div className="poll-card-header" onClick={() => handlePollClick(poll.id)}>
                                        <div className="poll-title">
                                            <h4>{poll.title}</h4>
                                            <div className="poll-meta">
                                                <span className="creator">
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                                        <circle cx="12" cy="7" r="4"></circle>
                                                    </svg>
                                                    {poll.creator}
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
                                                    {formatTokenName(poll.token_contract)}
                                                </span>
                                            </div>
                                            <div className="token-info">
                                                <span className="token-label">Voting Token:</span>
                                                <span className="token-name">{formatTokenName(poll.token_contract)}</span>
                                                {poll.token_contract && (
                                                    <button
                                                        className="token-copy-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            copyToClipboard(poll.token_contract);
                                                        }}
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
                                        <div className="poll-status">
                                            {hasVoted(poll) && (
                                                <span className="tag tag-success">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <polyline points="20,6 9,17 4,12"></polyline>
                                                    </svg>
                                                    Voted
                                                </span>
                                            )}
                                            {pollExpired(poll) ? (
                                                <span className="tag tag-warning">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="10"></circle>
                                                        <polyline points="12,6 12,12 16,14"></polyline>
                                                    </svg>
                                                    Expired
                                                </span>
                                            ) : (
                                                <span className="tag tag-info">
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <circle cx="12" cy="12" r="10"></circle>
                                                        <polyline points="12,6 12,12 16,14"></polyline>
                                                    </svg>
                                                    {getTimeRemaining(poll.endDate)}
                                                </span>
                                            )}
                                        </div>




                                        <div className="poll-options">
                                            {poll.options.map((opt, index) => {
                                                console.log('Rendering option:', opt, 'Type:', typeof opt);

                                                // Handle different option structures
                                                const optionText = opt.text || opt.option || opt.toString() || 'Unknown Option';
                                                const optionId = opt.id || opt.option_id || index + 1;

                                                const votes = opt.votes ?? 0;
                                                const votingPower = opt.voting_power ?? votes;
                                                const totalVotes = poll.totalVotes ?? 0;
                                                const totalVotingPower = poll.totalVotingPower ?? totalVotes;
                                                const pct = getVotePercentage(votingPower, totalVotingPower);
                                                const votedThis = hasVoted(poll) && poll.userVote === optionId;

                                                console.log('Processed option:', { optionText, optionId, optionType: typeof optionText });

                                                return (
                                                    <div
                                                        key={optionId}
                                                        className={`poll-option ${votedThis ? 'voted' : ''}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="option-content">
                                                            <div className="option-info">
                                                                <div className="option-text">{String(optionText)}</div>
                                                                <div className="option-stats">
                                                                    <span className="voting-power">{votingPower} voting power</span>
                                                                    <span className="percentage">({pct}%)</span>
                                                                    {votedThis && (
                                                                        <span className="your-vote">
                                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                                <polyline points="20,6 9,17 4,12"></polyline>
                                                                            </svg>
                                                                            Your Vote
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <button
                                                                className={`btn ${votedThis ? 'btn-success' : hasVoted(poll) ? 'btn-secondary' : 'btn-primary'}`}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    vote(poll.id, optionId);
                                                                }}
                                                                disabled={hasVoted(poll) || pollExpired(poll) || votingPolls.has(poll.id)}
                                                            >
                                                                {votingPolls.has(poll.id) ? (
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
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon">
                                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                                    <path d="M9 11H1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z"></path>
                                    <path d="M23 11h-8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1z"></path>
                                    <path d="M9 3H1a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z"></path>
                                    <path d="M23 3h-8a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1z"></path>
                                </svg>
                            </div>
                            <h3>No polls found</h3>
                            <p>
                                {polls.length === 0
                                    ? "No polls available yet. Create the first one!"
                                    : "No polls match your search. Try a different term."
                                }
                            </p>
                            {polls.length === 0 && (
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowCreateForm(true)}
                                >
                                    Create First Poll
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default Section;
