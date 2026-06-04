import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import { dbSessionToGameSession } from '@/lib/session';
import PostcardScreen from '@/components/screens/PostcardScreen';

interface Props {
  params: Promise<{ sessionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  const supabase = createServerClient();
  const { data } = await supabase
    .from('witnesses_sessions')
    .select('seed_name, seed_phrase')
    .eq('id', sessionId)
    .single();

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
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from('witnesses_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !data) {
    notFound();
  }

  const session = dbSessionToGameSession(data);

  return <PostcardScreen session={session} />;
}
