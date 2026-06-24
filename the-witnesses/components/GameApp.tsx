'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GameSession, GameScreen, Visit, CharacterKey } from '@/lib/session';
import ArrivalScreen from './screens/ArrivalScreen';
import LetterScreen from './screens/LetterScreen';
import PermissionsScreen from './screens/PermissionsScreen';
import SeedScreen from './screens/SeedScreen';
import VisitScreen from './screens/VisitScreen';
import SeedNamingScreen from './screens/SeedNamingScreen';
import PostcardScreen from './screens/PostcardScreen';

interface Props {
  initialSession?: GameSession;
  sessionId?: string;
}

export default function GameApp({ initialSession, sessionId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const recipientName = searchParams?.get('name') ?? undefined;

  const [screen, setScreen] = useState<GameScreen>(
    initialSession ? 'visit' : 'arrival'
  );
  const [session, setSession] = useState<GameSession | null>(initialSession ?? null);
  const [currentVisitIndex, setCurrentVisitIndex] = useState(
    initialSession ? initialSession.visits.length : 0
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);

  // Transition helper
  const goTo = (s: GameScreen) => {
    setScreen(s);
  };

  const handleSeedSubmit = useCallback(async (seedPhrase: string) => {
    setIsLoading(true);
    try {
      // Create session
      const res = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientName }),
      });
      const { id, visitOrder, imageSeed } = await res.json() as {
        id: string;
        visitOrder: CharacterKey[];
        imageSeed: number;
      };

      // Save seed phrase
      await fetch(`/api/session/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedPhrase }),
      });

      const newSession: GameSession = {
        id,
        recipientName,
        seedPhrase,
        visitOrder,
        visits: [],
        imageSeed,
        round: 1,
      };

      setSession(newSession);
      setCurrentVisitIndex(0);
      setIsLoading(false);

      // Navigate to play page
      router.push(`/play/${id}`);

      // Background: generate seed image
      setIsImageLoading(true);
      fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seedPhrase, imageSeed }),
      })
        .then((r) => r.json())
        .then(async ({ imageUrl }) => {
          if (imageUrl) {
            await fetch(`/api/session/${id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ seedImageUrl: imageUrl }),
            });
            setSession((prev) => prev ? { ...prev, seedImageUrl: imageUrl } : prev);
          }
        })
        .catch(console.error)
        .finally(() => setIsImageLoading(false));
    } catch (err) {
      console.error('Session creation failed:', err);
      setIsLoading(false);
    }
  }, [recipientName, router]);

  const handleVisitComplete = useCallback(async (visit: Visit) => {
    if (!session) return;

    const updatedVisit = { ...visit };

    // Save visit to DB
    await fetch(`/api/session/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visit: updatedVisit }),
    }).catch(console.error);

    // Evolve image
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
          // Update visit in DB with imageUrl
          await fetch(`/api/session/${session.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visit: updatedVisit }),
          }).catch(console.error);
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
  }, [session, currentVisitIndex]);

  const handleSeedNameSubmit = useCallback(async (seedName: string) => {
    if (!session) return;
    setIsLoading(true);
    await fetch(`/api/session/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seedName }),
    }).catch(console.error);
    setSession((prev) => prev ? { ...prev, seedName } : prev);
    setIsLoading(false);
    router.push(`/postcard/${session.id}`);
  }, [session, router]);

  // Render screens
  switch (screen) {
    case 'arrival':
      return <ArrivalScreen onNext={() => goTo('letter')} />;

    case 'letter':
      return <LetterScreen recipientName={recipientName} onNext={() => goTo('permissions')} />;

    case 'permissions':
      return <PermissionsScreen onNext={() => goTo('seed')} />;

    case 'seed':
      return (
        <SeedScreen
          recipientName={recipientName}
          onSubmit={handleSeedSubmit}
          isLoading={isLoading}
        />
      );

    case 'visit':
      if (!session) return null;
      return (
        <VisitScreen
          session={session}
          currentVisitIndex={currentVisitIndex}
          onVisitComplete={handleVisitComplete}
          isImageLoading={isImageLoading}
        />
      );

    case 'seed-naming':
      return (
        <SeedNamingScreen
          onSubmit={handleSeedNameSubmit}
          isLoading={isLoading}
        />
      );

    case 'postcard':
      if (!session) return null;
      return <PostcardScreen session={session} />;

    default:
      return null;
  }
}
