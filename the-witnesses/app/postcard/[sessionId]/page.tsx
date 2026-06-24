import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dbSessionToGameSession } from '@/lib/session';
import PostcardScreen from '@/components/screens/PostcardScreen';

interface Props {
  params: Promise<{ sessionId: string }>;
}

async function fetchSession(sessionId: string) {
  // In demo mode (or server-side from postcard), fetch via our own API route
  // which handles both demo store and Supabase
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3020';
  const res = await fetch(`${baseUrl}/api/session/${sessionId}/read`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  const data = await fetchSession(sessionId);
  const seedName = data?.seed_name ?? 'a seed';
  const seedPhrase = data?.seed_phrase ?? 'something alive';
  return {
    title: `${seedName} — The Witnesses`,
    description: `A postcard from a small game by winded.vertigo. "${seedPhrase}"`,
    openGraph: {
      title: `${seedName} — The Witnesses`,
      description: `A postcard from a small game by winded.vertigo.`,
    },
  };
}

export default async function PostcardPage({ params }: Props) {
  const { sessionId } = await params;
  const data = await fetchSession(sessionId);

  if (!data) notFound();

  const session = dbSessionToGameSession(data);
  return <PostcardScreen session={session} />;
}
