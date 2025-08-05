'use client';

import React from 'react';
import MyVotes from "../components/MyVotes";
import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from '../lib/apolloClient';

export default function MyVotesPage() {
  const client = createApolloClient();

  return (
    <ApolloProvider client={client}>
      <MyVotes />
    </ApolloProvider>
  )
} 