'use client';

import React from 'react';
import PollDetail from '../../components/PollDetail';

interface PollPageProps {
  params: {
    id: string;
  };
}

export default function PollPage({ params }: PollPageProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        <PollDetail pollId={params.id} />
      </div>
    </div>
  );
} 