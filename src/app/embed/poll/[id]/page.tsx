import EmbedSinglePoll from "../../../components/EmbedSinglePoll";

export default function EmbedPollPage({ params }: { params: { id: string } }) {
  return <EmbedSinglePoll pollId={params.id} />;
} 