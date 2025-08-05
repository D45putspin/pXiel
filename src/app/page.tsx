'use client';

import React from 'react';
import Main from "./components/Main";
import { ApolloProvider } from '@apollo/client';
import { createApolloClient } from './lib/apolloClient';

export default function Home() {
  const client = createApolloClient();

  return (
    <ApolloProvider client={client}>
      <Main />
    </ApolloProvider>
  )
}
