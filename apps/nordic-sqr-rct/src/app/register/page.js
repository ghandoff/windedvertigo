'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

function RegisterContent() {
  const router = useRouter();
  const { user, register, loading } = useAuth();
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    affiliation: '',
    alias: '',
    password: '',
    discipline: '',
    consent: false,
  });

  // Redirect to dashboard if already logged in
  if (user) {
    router.push('/dashboard');
    return null;
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate password
    if (formData.password.length < 12) {
      setError('Password must be at least 12 characters long');
      return;
    }

    // Validate consent
    if (!formData.consent) {
      setError('You must agree to the terms and conditions');
      return;
    }

    // Validate required fields
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.alias) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      await register(formData);
      router.push('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="text-4xl text-pacific">◻</div>
        </div>
        <h1 className="text-3xl font-bold text-pacific">SQR-RCT Platform</h1>
      </div>

      {/* Card */}
      <div className="card max-w-lg mx-auto w-full">
        <h2 className="text-2xl font-bold text-pacific mb-6">Create Account</h2>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="form-label">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="form-label">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="form-label">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="input-field"
              required
            />
          </div>

          {/* Affiliation */}
          <div>
            <label htmlFor="affiliation" className="form-label">
              Affiliation
            </label>
            <input
              type="text"
              id="affiliation"
              name="affiliation"
              value={formData.affiliation}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., University of Oslo"
            />
            <p className="form-hint">Optional</p>
          </div>

          {/* Alias */}
          <div>
            <label htmlFor="alias" className="form-label">
              Reviewer Alias *
            </label>
            <input
              type="text"
              id="alias"
              name="alias"
              value={formData.alias}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., reviewer_001"
              required
            />
            <p className="form-hint">Used for anonymity in reviews</p>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="form-label">
              Password *
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input-field"
              required
            />
            <p className="form-hint">Minimum 12 characters</p>
          </div>

          {/* Discipline */}
          <div>
            <label htmlFor="discipline" className="form-label">
              Discipline
            </label>
            <input
              type="text"
              id="discipline"
              name="discipline"
              value={formData.discipline}
              onChange={handleChange}
              className="input-field"
              placeholder="e.g., Dermatology"
            />
            <p className="form-hint">Optional</p>
          </div>

          {/* Consent Checkbox */}
          <div className="flex items-start">
            <input
              type="checkbox"
              id="consent"
              name="consent"
              checked={formData.consent}
              onChange={handleChange}
              className="mt-1 h-4 w-4 text-pacific border-gray-300 rounded cursor-pointer"
              required
            />
            <label htmlFor="consent" className="ml-3 block text-sm text-gray-700">
              I agree to the terms and conditions and privacy policy *
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-6"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        {/* Link to Login */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-pacific hover:text-pacific-800 font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <AuthProvider>
      <RegisterContent />
    </AuthProvider>
  );
}
