// lib/apolloClient.js
import { ApolloClient, InMemoryCache, HttpLink } from '@apollo/client';

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: process.env.NEXT_PUBLIC_XIAN_BDS || 'https://devnet.xian.org/graphql',
    }),
    cache: new InMemoryCache(),
  });
}
