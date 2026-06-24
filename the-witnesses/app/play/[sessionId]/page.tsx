'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { GameSession, Visit, CharacterKey } from '@/lib/session';
import { dbSessionToGameSession } from '@/lib/session';
import VisitScreen from '@/components/screens/VisitScreen';
import SeedNamingScreen from '@/components/screens/SeedNamingScreen';
import { useRouter } from 'next/navigation';

export default function PlayPage() {
  const params = useParams();
  const sessionId = params?.sessionId as string;
  const router = useRouter();

  const [session, setSession] = useState<GameSession | null>(null);
  const [currentVisitIndex, setCurrentVisitIndex] = useState(0);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [screen, setScreen] = useState<'visit' | 'seed-naming' | 'loading'>('loading');
  const [isLoading, setIsLoading] = useState(false);

  // Load session from API (server reads Supabase via our PATCH/GET approach)
  useEffect(() => {
    if (!sessionId) return;
    // Fetch session data directly from Supabase via a server action substitute
    // We use the public-safe route
    fetch(`/api/session/${sessionId}/read`)
      .then((r) => {
        if (!r.ok) throw new Error('Session not found');
        return r.json();
      })
      .then((data) => {
        const sess = dbSessionToGameSession(data);
        setSession(sess);
        setCurrentVisitIndex(sess.visits.length);
        setScreen('visit');
      })
      .catch(() => {
        // Session might have been created client-side and passed via state
        // Fall back to loading indicator
        router.push('/');
      });
  }, [sessionId, router]);

  const handleVisitComplete = async (visit: Visit) => {
    if (!session) return;

    const updatedVisit = { ...visit };

    await fetch(`/api/session/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit: updatedVisit }),
    }).catch(console.error);

    const prevImageUrl = session.visits.at(-1)?.imageUrl ?? session.seedImageUrl;
    if (prevImageUrl) {
      setIsImageLoading(true);
      try {
        const res = await fetch('/api/evolve-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prevImageUrl,
            character: visit.character,
            objectChoice: visit.objectChoice,
            erasedElement: visit.erasedElement,
            imageSeed: session.imageSeed,
          }),
        });
        const { imageUrl } = await res.json() as { imageUrl?: string };
        if (imageUrl) {
          updatedVisit.imageUrl = imageUrl;
        }
      } catch (err) {
        console.error('Evolve image failed:', err);
      } finally {
        setIsImageLoading(false);
      }
    }

    const newVisits = [...session.visits, updatedVisit];
    const updatedSession = { ...session, visits: newVisits };
    setSession(updatedSession);

    const nextIndex = currentVisitIndex + 1;
    if (nextIndex >= session.visitOrder.length) {
      setScreen('seed-naming');
    } else {
      setCurrentVisitIndex(nextIndex);
    }
  };

  const handleSeedNameSubmit = async (seedName: string) => {
    if (!session) return;
    setIsLoading(true);
    await fetch(`/api/session/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seedName }),
    }).catch(console.error);
    setIsLoading(false);
    router.push(`/postcard/${session.id}`);
  };

  if (screen === 'loading' || !session) {
    return (
      <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center">
        <div className="text-white/40 font-mono text-sm animate-pulse">loading…</div>
      </div>
    );
  }

  if (screen === 'seed-naming') {
    return <SeedNamingScreen onSubmit={handleSeedNameSubmit} isLoading={isLoading} />;
  }

  return (
    <VisitScreen
      session={session}
      currentVisitIndex={currentVisitIndex}
      onVisitComplete={handleVisitComplete}
      isImageLoading={isImageLoading}
    />
  );
}
