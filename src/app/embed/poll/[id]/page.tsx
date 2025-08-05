'use client';

import React from 'react';
import EmbedSinglePoll from "../../../components/EmbedSinglePoll";
import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from '../../../lib/apolloClient';

export default function EmbedPollPage({ params }: { params: { id: string } }) {
  const client = createApolloClient();

  return (
    <ApolloProvider client={client}>
      <EmbedSinglePoll pollId={params.id} />
    </ApolloProvider>
  );
} 