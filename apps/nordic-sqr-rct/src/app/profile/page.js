'use client';

import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useState, useEffect, useRef, useCallback } from 'react';

function ProfileContent() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    affiliation: '',
    discipline: '',
    yearsExperience: '',
  });

  // Image upload state
  const [imagePreview, setImagePreview] = useState(null); // base64 data URI for local preview
  const [imageFile, setImageFile] = useState(null); // processed Blob to upload to Vercel Blob
  const [imageRemoved, setImageRemoved] = useState(false); // true = user wants to clear photo
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/profile');
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setProfile(data.profile);
      setForm({
        firstName: data.profile.firstName || '',
        lastName: data.profile.lastName || '',
        affiliation: data.profile.affiliation || '',
        discipline: data.profile.discipline || '',
        yearsExperience: data.profile.yearsExperience || '',
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Resize and compress image on a canvas, return { preview, blob }
  const processImage = useCallback((file) => {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Please upload an image file (JPG, PNG, or WebP)'));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        reject(new Error('Image must be under 5 MB'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const size = 200; // 200x200 avatar
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');

          // Draw white background
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, size, size);

          // Center-crop the image to a square
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          // Get preview data URI
          const preview = canvas.toDataURL('image/jpeg', 0.6);

          // Get Blob for upload
          canvas.toBlob(
            (blob) => resolve({ preview, blob }),
            'image/jpeg',
            0.6
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }, []);

  const handleImageFile = useCallback(async (file) => {
    try {
      setError('');
      const { preview, blob } = await processImage(file);
      setImagePreview(preview);
      setImageFile(blob);
      setImageRemoved(false);
    } catch (err) {
      setError(err.message);
    }
  }, [processImage]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const removeImage = useCallback(() => {
    setImagePreview(null);
    setImageFile(null);
    setImageRemoved(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...form,
        yearsExperience: form.yearsExperience ? Number(form.yearsExperience) : null,
      };

      // Upload new image to Vercel Blob if one was selected
      if (imageFile) {
        const formData = new FormData();
        formData.append('file', imageFile, 'avatar.jpg');
        // Pass old URL so the API can clean it up
        if (profile?.profileImageUrl) {
          formData.append('oldUrl', profile.profileImageUrl);
        }
        const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
        if (!uploadRes.ok) {
          const err = await uploadRes.json();
          throw new Error(err.error || 'Image upload failed');
        }
        const { url } = await uploadRes.json();
        payload.profileImageUrl = url;
      } else if (imageRemoved) {
        // User explicitly removed their photo
        payload.profileImageUrl = '';
      }

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      const data = await res.json();
      setProfile(data.profile);
      setEditing(false);
      setImagePreview(null);
      setImageFile(null);
      setImageRemoved(false);
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setImagePreview(null);
    setImageFile(null);
    setImageRemoved(false);
    setError('');
    // Reset form to profile values
    if (profile) {
      setForm({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        affiliation: profile.affiliation || '',
        discipline: profile.discipline || '',
        yearsExperience: profile.yearsExperience || '',
      });
    }
  };

  const initials = (profile?.firstName?.[0] || '') + (profile?.lastName?.[0] || '');

  // Display image: preview (if editing) > profile image > initials
  const displayImage = imagePreview || profile?.profileImageUrl;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-pacific" />
            <p className="mt-4 text-gray-600">Loading profile...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 sm:px-6">
        <h1 className="text-3xl font-bold text-pacific mb-8">My Profile</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 text-sm">{success}</p>
          </div>
        )}

        {/* Profile Header Card */}
        <div className="card p-8 mb-6">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              {displayImage ? (
                <img
                  src={displayImage}
                  alt={`${profile?.firstName} ${profile?.lastName}`}
                  className="w-20 h-20 rounded-full object-cover border-2 border-pacific"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                />
              ) : null}
              <div
                className={`w-20 h-20 rounded-full bg-pacific text-white flex items-center justify-center text-2xl font-bold uppercase ${displayImage ? 'hidden' : ''}`}
              >
                {initials || '?'}
              </div>
            </div>

            <div className="flex-1">
              <h2 className="text-xl font-bold text-gray-900">{profile?.firstName} {profile?.lastName}</h2>
              <p className="text-sm text-gray-500 mt-0.5">@{profile?.alias}</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                {profile?.affiliation && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {profile.affiliation}
                  </span>
                )}
                {profile?.discipline && (
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    {profile.discipline}
                  </span>
                )}
              </div>
            </div>

            <button
              onClick={() => editing ? handleCancelEdit() : setEditing(true)}
              className={editing ? 'btn-ghost text-sm' : 'btn-secondary text-sm'}
            >
              {editing ? 'Cancel' : 'Edit Profile'}
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
            <div className="text-center">
              <p className="text-2xl font-bold text-pacific">{profile?.reviewCount || 0}</p>
              <p className="text-xs text-gray-500 mt-1">Reviews</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-pacific">{profile?.yearsExperience || '—'}</p>
              <p className="text-xs text-gray-500 mt-1">Years Experience</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-pacific">
                {profile?.memberSince ? new Date(profile.memberSince).getFullYear() : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-1">Member Since</p>
            </div>
          </div>

          {/* Domain Expertise Tags */}
          {profile?.domainExpertise?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Domain Expertise</p>
              <div className="flex flex-wrap gap-2">
                {profile.domainExpertise.map((domain) => (
                  <span key={domain} className="px-3 py-1 bg-pacific-50 text-pacific rounded-full text-xs font-medium">
                    {domain}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Edit Form */}
        {editing && (
          <div className="card p-8">
            <h3 className="text-lg font-bold text-pacific mb-6">Edit Profile</h3>
            <div className="space-y-5">
              {/* Profile Photo Upload */}
              <div>
                <label className="form-label">Profile Photo</label>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-pacific bg-blue-50'
                      : 'border-gray-300 hover:border-pacific hover:bg-gray-50'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  {(imagePreview || (profile?.profileImageUrl && !imageRemoved)) ? (
                    <div className="flex items-center gap-4">
                      <img
                        src={imagePreview || profile?.profileImageUrl}
                        alt="Profile preview"
                        className="w-16 h-16 rounded-full object-cover border-2 border-pacific shrink-0"
                      />
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-700">
                          {imagePreview ? 'New photo selected' : 'Current photo'}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Click or drag a new image to replace
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeImage(); }}
                        className="text-red-500 hover:text-red-700 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-gray-700">
                        Drop your photo here, or <span className="text-pacific">browse</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        JPG, PNG, or WebP. Max 5 MB. Will be resized to 200x200.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">First Name</label>
                  <input
                    type="text" name="firstName" value={form.firstName}
                    onChange={handleChange} className="input-field"
                  />
                </div>
                <div>
                  <label className="form-label">Last Name</label>
                  <input
                    type="text" name="lastName" value={form.lastName}
                    onChange={handleChange} className="input-field"
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Institution / Affiliation</label>
                <input
                  type="text" name="affiliation" value={form.affiliation}
                  onChange={handleChange} className="input-field"
                  placeholder="e.g., University of Oslo"
                />
              </div>

              <div>
                <label className="form-label">Discipline / Specialty</label>
                <input
                  type="text" name="discipline" value={form.discipline}
                  onChange={handleChange} className="input-field"
                  placeholder="e.g., Dermatology, Nutritional Science"
                />
              </div>

              <div>
                <label className="form-label">Years of Experience</label>
                <input
                  type="number" name="yearsExperience" value={form.yearsExperience}
                  onChange={handleChange} className="input-field" min="0" max="60"
                  placeholder="e.g., 10"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={handleCancelEdit} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Account Info (read-only) */}
        {!editing && (
          <div className="card p-8">
            <h3 className="text-lg font-bold text-pacific mb-4">Account Details</h3>
            <div className="space-y-4 text-sm">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-900 font-medium">{profile?.email || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Reviewer Alias</span>
                <span className="text-gray-900 font-medium">{profile?.alias}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Affiliation Type</span>
                <span className="text-gray-900 font-medium">{profile?.affiliationType || '—'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-500">Training Completed</span>
                <span className={`font-medium ${profile?.trainingCompleted ? 'text-green-700' : 'text-gray-400'}`}>
                  {profile?.trainingCompleted ? 'Yes' : 'Not yet'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Role</span>
                <span className={`font-medium ${profile?.isAdmin ? 'text-pacific' : 'text-gray-900'}`}>
                  {profile?.isAdmin ? 'Administrator' : 'Reviewer'}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function ProfilePage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <ProfileContent />
      </ProtectedRoute>
    </AuthProvider>
  );
}
