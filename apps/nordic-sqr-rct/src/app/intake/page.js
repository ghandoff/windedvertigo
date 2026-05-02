'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { BLINDING_OPTIONS, A_PRIORI_POWER_OPTIONS } from '@/lib/rubric';

// These must live OUTSIDE the main component so React doesn't
// recreate them on every render (which destroys input focus).
const FormField = ({ label, hint, children }) => (
  <div>
    <label className="form-label">{label}</label>
    {hint && <p className="form-hint">{hint}</p>}
    {children}
  </div>
);

const FormSection = ({ id, title, isOpen, isFilled, onToggle, children }) => (
  <div className="card">
    <button
      type="button"
      onClick={() => onToggle(id)}
      className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold">{title}</span>
        {isFilled && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
            Filled
          </span>
        )}
      </div>
      <span className="text-xl text-gray-500">{isOpen ? '−' : '+'}</span>
    </button>
    {isOpen && (
      <div className="px-4 pb-4 space-y-4 border-t">{children}</div>
    )}
  </div>
);

const IntakeFormContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const articleId = searchParams.get('article');

  const [article, setArticle] = useState(null);
  const [loadingArticle, setLoadingArticle] = useState(!!articleId);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Open/closed state for each section
  const [openSections, setOpenSections] = useState({
    identification: true,
    design: false,
    participants: false,
    variables: false,
    results: false,
    appraisal: false,
  });

  // Form state — all fields blank for the reviewer to fill
  const [formData, setFormData] = useState({
    citation: '',
    doi: '',
    year: '',
    journal: '',
    purposeOfResearch: '',
    studyDesign: '',
    blinding: '',
    fundingSources: '',
    initialN: '',
    finalN: '',
    ages: '',
    femaleParticipants: '',
    maleParticipants: '',
    recruitment: '',
    inclusionCriteria: '',
    exclusionCriteria: '',
    aPrioriPower: '',
    independentVariables: '',
    dependentVariables: '',
    controlVariables: '',
    timingOfMeasures: '',
    keyResults: '',
    otherResults: '',
    statisticalMethods: '',
    missingDataHandling: '',
    authorsConclusion: '',
    strengths: '',
    limitations: '',
    potentialBiases: '',
    locationCountry: '',
    locationCity: '',
  });

  const [draftSaved, setDraftSaved] = useState(false);

  // Load the article info if an article ID was provided
  useEffect(() => {
    if (!articleId) return;
    const fetchArticle = async () => {
      try {
        setLoadingArticle(true);
        const res = await fetch(`/api/studies/${articleId}`);
        if (!res.ok) throw new Error('Failed to load article');
        const data = await res.json();
        setArticle(data.study);
        // Pre-fill the identification fields from the original article
        setFormData((prev) => ({
          ...prev,
          citation: data.study.citation || '',
          doi: data.study.doi || '',
          year: data.study.year || '',
          journal: data.study.journal || '',
        }));
      } catch (err) {
        setError('Could not load article details. Please go back and try again.');
      } finally {
        setLoadingArticle(false);
      }
    };
    fetchArticle();
  }, [articleId]);

  // Auto-save to localStorage every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const draftKey = `intake_draft_${articleId || 'new'}`;
      localStorage.setItem(draftKey, JSON.stringify(formData));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    }, 15000);
    return () => clearInterval(interval);
  }, [formData, articleId]);

  // Restore draft from localStorage on mount
  useEffect(() => {
    const draftKey = `intake_draft_${articleId || 'new'}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      const confirmed = confirm('Found an unsaved draft. Restore it?');
      if (confirmed) {
        setFormData(JSON.parse(savedDraft));
      } else {
        localStorage.removeItem(draftKey);
      }
    }
  }, []);

  const sectionFields = {
    identification: ['citation'],
    design: ['purposeOfResearch', 'studyDesign', 'blinding'],
    participants: ['initialN', 'finalN'],
    variables: ['independentVariables', 'dependentVariables'],
    results: ['keyResults', 'statisticalMethods'],
    appraisal: ['strengths', 'limitations'],
  };

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const isSectionFilled = (section) => {
    return sectionFields[section]?.every((field) => formData[field]?.toString().trim());
  };

  const filledCount = Object.keys(sectionFields).filter((s) => isSectionFilled(s)).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to submit study');
      }

      const data = await response.json();
      // Clear draft from localStorage
      localStorage.removeItem(`intake_draft_${articleId || 'new'}`);
      // Redirect to scoring page with the newly created intake entry
      router.push(`/score?intake=${data.studyId}`);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loadingArticle) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-pacific"></div>
            <p className="mt-4 text-gray-600">Loading article details...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-pacific mb-2">Study Intake Form</h1>
          <p className="text-gray-600">
            Part 1: Extract and enter study details from the article. This process familiarizes you
            with the study before scoring.
          </p>
        </div>

        {/* Article Reference Card */}
        {article && (
          <div className="mb-8 p-5 bg-pacific-50 border border-pacific-200 rounded-xl">
            <p className="text-xs font-semibold text-pacific-600 uppercase tracking-wide mb-2">
              Reviewing Article
            </p>
            <p className="text-sm text-gray-900 font-medium">{article.citation}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
              {article.doi && (
                <a
                  href={article.doi}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-pacific-600 hover:underline"
                >
                  {article.doi}
                </a>
              )}
              {article.year && <span>{article.year}</span>}
              {article.journal && <span>&middot; {article.journal}</span>}
            </div>
          </div>
        )}

        {!articleId && (
          <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">Tip:</span> Start from the{' '}
              <a href="/dashboard" className="underline font-medium">
                Dashboard
              </a>{' '}
              to select an article before filling out the intake form.
            </p>
          </div>
        )}

        {/* Progress */}
        <div className="mb-8 p-4 bg-white rounded-lg border border-gray-200">
          <p className="text-sm font-medium text-gray-700 mb-2">Progress</p>
          <div className="flex gap-2">
            {Object.keys(sectionFields).map((section) => (
              <div
                key={section}
                className={`flex-1 h-2 rounded ${
                  isSectionFilled(section) ? 'bg-green-500' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            {filledCount} of {Object.keys(sectionFields).length} sections filled
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Study Identification — pre-filled from article, read-only if article provided */}
          <FormSection id="identification" title="Study Identification" isOpen={openSections.identification} isFilled={isSectionFilled('identification')} onToggle={toggleSection}>
            <FormField label="Citation *" hint="Full bibliographic citation">
              <textarea
                className={`textarea-field ${articleId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={formData.citation}
                onChange={(e) => handleInputChange('citation', e.target.value)}
                placeholder="Author et al. (Year). Title. Journal."
                readOnly={!!articleId}
              />
            </FormField>
            <FormField label="DOI" hint="Digital Object Identifier">
              <input
                type="text"
                className={`input-field ${articleId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={formData.doi}
                onChange={(e) => handleInputChange('doi', e.target.value)}
                placeholder="https://doi.org/..."
                readOnly={!!articleId}
              />
            </FormField>
            <FormField label="Year">
              <input
                type="number"
                className={`input-field ${articleId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={formData.year}
                onChange={(e) => handleInputChange('year', e.target.value)}
                placeholder="YYYY"
                readOnly={!!articleId}
              />
            </FormField>
            <FormField label="Journal">
              <input
                type="text"
                className={`input-field ${articleId ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                value={formData.journal}
                onChange={(e) => handleInputChange('journal', e.target.value)}
                placeholder="Journal Name"
                readOnly={!!articleId}
              />
            </FormField>
          </FormSection>

          {/* Research Design */}
          <FormSection id="design" title="Research Design" isOpen={openSections.design} isFilled={isSectionFilled('design')} onToggle={toggleSection}>
            <FormField label="Purpose of Research *">
              <textarea
                className="textarea-field"
                value={formData.purposeOfResearch}
                onChange={(e) => handleInputChange('purposeOfResearch', e.target.value)}
                placeholder="Describe the main research question or objective"
              />
            </FormField>
            <FormField label="Study Design *">
              <textarea
                className="textarea-field"
                value={formData.studyDesign}
                onChange={(e) => handleInputChange('studyDesign', e.target.value)}
                placeholder="e.g., Randomized Controlled Trial, Observational, etc."
              />
            </FormField>
            <FormField label="Blinding *">
              <select
                className="select-field"
                value={formData.blinding}
                onChange={(e) => handleInputChange('blinding', e.target.value)}
              >
                <option value="">Select blinding method...</option>
                {BLINDING_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Funding Sources">
              <textarea
                className="textarea-field"
                value={formData.fundingSources}
                onChange={(e) => handleInputChange('fundingSources', e.target.value)}
                placeholder="List funding sources or conflicts of interest"
              />
            </FormField>
          </FormSection>

          {/* Participants */}
          <FormSection id="participants" title="Participants" isOpen={openSections.participants} isFilled={isSectionFilled('participants')} onToggle={toggleSection}>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Initial N *">
                <input
                  type="number"
                  className="input-field"
                  value={formData.initialN}
                  onChange={(e) => handleInputChange('initialN', e.target.value)}
                  placeholder="Sample size at baseline"
                />
              </FormField>
              <FormField label="Final N *">
                <input
                  type="number"
                  className="input-field"
                  value={formData.finalN}
                  onChange={(e) => handleInputChange('finalN', e.target.value)}
                  placeholder="Sample size at end"
                />
              </FormField>
              <FormField label="Ages">
                <input
                  type="text"
                  className="input-field"
                  value={formData.ages}
                  onChange={(e) => handleInputChange('ages', e.target.value)}
                  placeholder="e.g., 18-65 years"
                />
              </FormField>
              <FormField label="Female Participants">
                <input
                  type="number"
                  className="input-field"
                  value={formData.femaleParticipants}
                  onChange={(e) => handleInputChange('femaleParticipants', e.target.value)}
                  placeholder="Number or percentage"
                />
              </FormField>
              <FormField label="Male Participants">
                <input
                  type="number"
                  className="input-field"
                  value={formData.maleParticipants}
                  onChange={(e) => handleInputChange('maleParticipants', e.target.value)}
                  placeholder="Number or percentage"
                />
              </FormField>
            </div>
            <FormField label="Recruitment">
              <textarea
                className="textarea-field"
                value={formData.recruitment}
                onChange={(e) => handleInputChange('recruitment', e.target.value)}
                placeholder="How were participants recruited?"
              />
            </FormField>
            <FormField label="Inclusion Criteria">
              <textarea
                className="textarea-field"
                value={formData.inclusionCriteria}
                onChange={(e) => handleInputChange('inclusionCriteria', e.target.value)}
                placeholder="List inclusion criteria"
              />
            </FormField>
            <FormField label="Exclusion Criteria">
              <textarea
                className="textarea-field"
                value={formData.exclusionCriteria}
                onChange={(e) => handleInputChange('exclusionCriteria', e.target.value)}
                placeholder="List exclusion criteria"
              />
            </FormField>
            <FormField label="A Priori Power Analysis">
              <select
                className="select-field"
                value={formData.aPrioriPower}
                onChange={(e) => handleInputChange('aPrioriPower', e.target.value)}
              >
                <option value="">Select power analysis status...</option>
                {A_PRIORI_POWER_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </FormField>
          </FormSection>

          {/* Variables & Measures */}
          <FormSection id="variables" title="Variables & Measures" isOpen={openSections.variables} isFilled={isSectionFilled('variables')} onToggle={toggleSection}>
            <FormField label="Independent Variables *">
              <textarea
                className="textarea-field"
                value={formData.independentVariables}
                onChange={(e) => handleInputChange('independentVariables', e.target.value)}
                placeholder="What variables are being manipulated or studied?"
              />
            </FormField>
            <FormField label="Dependent Variables *">
              <textarea
                className="textarea-field"
                value={formData.dependentVariables}
                onChange={(e) => handleInputChange('dependentVariables', e.target.value)}
                placeholder="What outcomes are being measured?"
              />
            </FormField>
            <FormField label="Control Variables">
              <textarea
                className="textarea-field"
                value={formData.controlVariables}
                onChange={(e) => handleInputChange('controlVariables', e.target.value)}
                placeholder="Variables held constant or controlled for"
              />
            </FormField>
            <FormField label="Timing of Measures">
              <textarea
                className="textarea-field"
                value={formData.timingOfMeasures}
                onChange={(e) => handleInputChange('timingOfMeasures', e.target.value)}
                placeholder="When were measurements taken?"
              />
            </FormField>
          </FormSection>

          {/* Results */}
          <FormSection id="results" title="Results" isOpen={openSections.results} isFilled={isSectionFilled('results')} onToggle={toggleSection}>
            <FormField label="Key Results *">
              <textarea
                className="textarea-field"
                value={formData.keyResults}
                onChange={(e) => handleInputChange('keyResults', e.target.value)}
                placeholder="Main findings and outcomes"
              />
            </FormField>
            <FormField label="Other Results">
              <textarea
                className="textarea-field"
                value={formData.otherResults}
                onChange={(e) => handleInputChange('otherResults', e.target.value)}
                placeholder="Secondary or exploratory findings"
              />
            </FormField>
            <FormField label="Statistical Methods *">
              <textarea
                className="textarea-field"
                value={formData.statisticalMethods}
                onChange={(e) => handleInputChange('statisticalMethods', e.target.value)}
                placeholder="Describe statistical tests and analysis methods"
              />
            </FormField>
            <FormField label="Missing Data Handling">
              <textarea
                className="textarea-field"
                value={formData.missingDataHandling}
                onChange={(e) => handleInputChange('missingDataHandling', e.target.value)}
                placeholder="How were missing data addressed?"
              />
            </FormField>
          </FormSection>

          {/* Appraisal */}
          <FormSection id="appraisal" title="Appraisal" isOpen={openSections.appraisal} isFilled={isSectionFilled('appraisal')} onToggle={toggleSection}>
            <FormField label="Authors' Conclusion">
              <textarea
                className="textarea-field"
                value={formData.authorsConclusion}
                onChange={(e) => handleInputChange('authorsConclusion', e.target.value)}
                placeholder="Summarize the authors' conclusions"
              />
            </FormField>
            <FormField label="Strengths *">
              <textarea
                className="textarea-field"
                value={formData.strengths}
                onChange={(e) => handleInputChange('strengths', e.target.value)}
                placeholder="Methodological and conceptual strengths"
              />
            </FormField>
            <FormField label="Limitations *">
              <textarea
                className="textarea-field"
                value={formData.limitations}
                onChange={(e) => handleInputChange('limitations', e.target.value)}
                placeholder="Study limitations and weaknesses"
              />
            </FormField>
            <FormField label="Potential Biases">
              <textarea
                className="textarea-field"
                value={formData.potentialBiases}
                onChange={(e) => handleInputChange('potentialBiases', e.target.value)}
                placeholder="Sources of bias or confounding"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Location - Country">
                <input
                  type="text"
                  className="input-field"
                  value={formData.locationCountry}
                  onChange={(e) => handleInputChange('locationCountry', e.target.value)}
                  placeholder="Country"
                />
              </FormField>
              <FormField label="Location - City">
                <input
                  type="text"
                  className="input-field"
                  value={formData.locationCity}
                  onChange={(e) => handleInputChange('locationCity', e.target.value)}
                  placeholder="City"
                />
              </FormField>
            </div>
          </FormSection>

          {/* Submit */}
          <div className="flex gap-4 pt-4">
            {draftSaved && <span className="text-xs text-green-600 self-center">Draft saved</span>}
            <button type="submit" disabled={loading} className="btn-primary flex-1">
              {loading ? 'Submitting...' : 'Continue to Scoring Rubric'}
            </button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
};

export default function IntakePage() {
  return (
    <AuthProvider>
      <ProtectedRoute>
        <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
          <IntakeFormContent />
        </Suspense>
      </ProtectedRoute>
    </AuthProvider>
  );
}
