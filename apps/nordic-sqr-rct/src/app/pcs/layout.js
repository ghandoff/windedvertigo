'use client';

import { AuthProvider } from '@/lib/useAuth';
import { ToastProvider } from '@/components/Toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import RoleRoute from '@/components/RoleRoute';
import PcsNav from '@/components/pcs/PcsNav';
import Footer from '@/components/Footer';
import FeedbackButton from '@/components/FeedbackButton';

export default function PcsLayout({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ProtectedRoute>
          <RoleRoute requires={['pcs', 'pcs-readonly', 'admin']}>
            <div className="min-h-screen flex flex-col bg-gray-50">
              <PcsNav />
              <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
                {children}
              </main>
              <Footer />
              {/* Wave 6.1 — floating feedback button, persists across route changes.
                  Renders only when authenticated (FeedbackButton guards internally). */}
              <FeedbackButton />
            </div>
          </RoleRoute>
        </ProtectedRoute>
      </ToastProvider>
    </AuthProvider>
  );
}
