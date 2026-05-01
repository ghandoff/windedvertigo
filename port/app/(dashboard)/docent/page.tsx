import type { Metadata } from 'next';
import DocentClient from './docent-client';

export const metadata: Metadata = {
  title: 'the docent — the port',
  description:
    'a guided, step-by-step setup for new winded.vertigo teammates. mac or windows, about 30 minutes.',
  robots: {
    index: false,
    follow: false,
  },
};

export default function DocentPage() {
  return <DocentClient />;
}
