"use client";

import { useState, useEffect } from 'react';
import useStore from "../lib/store";
import {
    handleVoteSubmission,
    handlePollError
} from "../lib/js/main";
import WalletUtilService from '../lib/wallet-util-service';

const CONTRACT = "con_xipoll_v0";

const EmbedSinglePoll = ({ pollId }) => {
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

    if (loading) {
        return (
            <div className="embed-single-loading">
                <div className="embed-spinner"></div>
                <p>Loading poll...</p>
            </div>
        );
    }

    if (error || !poll) {
        return (
            <div className="embed-single-error">
                <h3>Poll Not Found</h3>
                <p>{error || 'The poll you are looking for does not exist.'}</p>
            </div>
        );
    }

    return (
        <div className="embed-single-container">
            <div className="embed-single-header">
                <h2>{poll.title}</h2>
                <div className="embed-single-meta">
                    <span>By {poll.creator}</span>
                    <span>{formatTokenName(poll.token_contract)}</span>
                    {pollExpired(poll) ? (
                        <span className="embed-single-status ended">Ended</span>
                    ) : (
                        <span className="embed-single-status active">
                            {getTimeRemaining(poll.endDate)}
                        </span>
                    )}
                </div>
            </div>

            {hasVoted(poll) && (
                <div className="embed-single-voted-notice">
                    ✓ You voted on this poll
                </div>
            )}

            <div className="embed-single-stats">
                <div className="embed-single-stat">
                    <span className="stat-number">{poll.totalVotingPower}</span>
                    <span className="stat-label">Total Votes</span>
                </div>
                <div className="embed-single-stat">
                    <span className="stat-number">{poll.options.length}</span>
                    <span className="stat-label">Options</span>
                </div>
            </div>

            <div className="embed-single-options">
                {poll.options.map((opt, index) => {
                    const votes = opt.votes ?? 0;
                    const votingPower = opt.voting_power ?? votes;
                    const totalVotes = poll.totalVotes ?? 0;
                    const totalVotingPower = poll.totalVotingPower ?? totalVotes;
                    const pct = getVotePercentage(votingPower, totalVotingPower);
                    const votedThis = hasVoted(poll) && poll.userVote === opt.id;

                    return (
                        <div key={opt.id} className={`embed-single-option ${votedThis ? 'voted' : ''}`}>
                            <div className="embed-single-option-content">
                                <div className="embed-single-option-text">{opt.text}</div>
                                <div className="embed-single-option-stats">
                                    <span>{votingPower} votes</span>
                                    <span>({pct}%)</span>
                                    {votedThis && <span className="your-vote">Your Vote</span>}
                                </div>
                            </div>
                            <button
                                className={`embed-single-vote-btn ${votedThis ? 'voted' : hasVoted(poll) ? 'disabled' : ''}`}
                                onClick={() => vote(opt.id)}
                                disabled={hasVoted(poll) || pollExpired(poll) || voting}
                            >
                                {voting ? 'Voting...' :
                                    votedThis ? '✓ Voted' :
                                        hasVoted(poll) ? 'Already Voted' : 'Vote'}
                            </button>
                            <div className="embed-single-progress">
                                <div
                                    className="embed-single-progress-bar"
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="embed-single-footer">
                <a href={`/poll/${poll.id}`} target="_blank" rel="noopener noreferrer" className="embed-single-link">
                    View full poll details →
                </a>
            </div>
        </div>
    );
};

export default EmbedSinglePoll; 