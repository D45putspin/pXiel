"use client";

import { useState, useEffect } from 'react';
import useStore from "../lib/store";
import {
    handleVoteSubmission,
    handlePollError
} from "../lib/js/main";
import WalletUtilService from '../lib/wallet-util-service';
import { usePollsQuery } from '../fn/usePollsQuery';

const CONTRACT = "con_xipoll_v0_clean";

const EmbedSinglePoll = ({ pollId }) => {
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

    const getVotePercentage = (votes, total) => total > 0 ? Math.round((votes / total) * 100) : 0;
    const hasVoted = (poll) => (poll?.userVote || 0) > 0;
    const pollExpired = (poll) => !poll?.isActive;

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

    const formatTokenName = (tokenContract) => {
        if (!tokenContract) return 'Unknown Token';
        return tokenContract
            .replace(/^con_/, '')
            .replace(/^token/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase());
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
                <p>{error?.message || 'The poll you are looking for does not exist.'}</p>
            </div>
        );
    }

    return (
        <div className="embed-single-container">
            <div className="embed-single-header">
                <h2>{poll.title}</h2>
                <div className="embed-single-meta">
                    <span>By {poll.creator}</span>
                    <span>{formatTokenName(poll.tokenContract)}</span>
                </div>
                {pollExpired(poll) ? (
                    <span className="embed-single-status ended">Ended</span>
                ) : (
                    <span className="embed-single-status active">
                        {getTimeRemaining(poll.endDate)}
                    </span>
                )}
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