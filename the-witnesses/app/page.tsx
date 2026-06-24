import { Suspense } from 'react';
import GameApp from '@/components/GameApp';

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a1a]" />}>
      <GameApp />
    </Suspense>
  );
}
