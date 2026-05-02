'use client';

/**
 * WordLayoutView — Wave 8 Phase B
 *
 * Renders a PCS document in a layout that mirrors Lauren's Word template.
 * All data arrives via props (no internal fetching). The parent page
 * fetches /api/pcs/documents/[id]/view lazily when the user switches to
 * 'word' mode and passes the assembled viewPayload down.
 *
 * Props:
 *   doc         — document metadata object (from /api/pcs/documents/[id])
 *   viewPayload — { version, revisionEvents, formulaLines, claims,
 *                   evidencePackets } from /api/pcs/documents/[id]/view.
 *                 May be null while loading; a loading skeleton is shown.
 */

import styles from './word-layout.module.css';

export default function WordLayoutView({ doc, viewPayload }) {
  if (!viewPayload) {
    return (
      <div className="animate-pulse space-y-4 p-8">
        <div className="h-24 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-200 rounded" />
        <div className="h-40 bg-gray-200 rounded" />
      </div>
    );
  }

  const {
    version = null,
    revisionEvents = [],
    formulaLines = [],
    claims = [],
    evidencePackets = [],
  } = viewPayload;

  const documentName = doc.finishedGoodName || doc.pcsId || '—';
  const pcsId = doc.pcsId || '—';
  const fmtCode = doc.format || version?.formatOverride || '—';
  const skusDisplay = doc.skus?.length > 0 ? doc.skus.join(', ') : '—';
  const currentVersion = version?.version || '—';
  const lastRevised = (version?.effectiveDate || doc.lastEditedTime)
    ? new Date(version?.effectiveDate || doc.lastEditedTime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';
  const documentOwner = doc.documentOwner || '—';

  return (
    <div className={styles.document}>
      <HeaderBlock
        documentName={documentName}
        pcsId={pcsId}
        fmtCode={fmtCode}
        skus={skusDisplay}
        currentVersion={currentVersion}
        lastRevised={lastRevised}
        documentOwner={documentOwner}
      />

      <section>
        <h2 className={styles.sectionHeader}>Table 1 — Demographic Profile</h2>
        <DemographicTable version={version} />
      </section>

      <section>
        <h2 className={styles.sectionHeader}>Table 2 — Formula / Composition</h2>
        <FormulaTable formulaLines={formulaLines} />
      </section>

      <section>
        <h2 className={styles.sectionHeader}>Table 3 — Claims</h2>
        <ClaimsSection claims={claims} />
      </section>

      <section>
        <h2 className={styles.sectionHeader}>Evidence Packets</h2>
        <EvidenceBlock evidencePackets={evidencePackets} />
      </section>

      <section className={styles.revisionSection}>
        <h2 className={styles.sectionHeader}>Table A — Revision History</h2>
        <RevisionHistoryTable revisionEvents={revisionEvents} />
      </section>
    </div>
  );
}

function HeaderBlock({ documentName, pcsId, fmtCode, skus, currentVersion, lastRevised, documentOwner }) {
  return (
    <div className={styles.headerBlock}>
      <h1>{documentName}</h1>
      <Field label="PCS ID" value={pcsId} />
      <Field label="Format (FMT)" value={fmtCode} />
      <Field label="SKUs" value={skus} />
      <Field label="Current Version" value={currentVersion} />
      <Field label="Last Revised" value={lastRevised} />
      <Field label="Document Owner" value={documentOwner} />
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className={styles.headerField}>
      <span className={styles.headerLabel}>{label}</span>
      <span className={styles.headerValue}>{value}</span>
    </div>
  );
}

function DemographicTable({ version }) {
  if (!version) return <p className={styles.noData}>No version data available.</p>;

  const ageRange = version.ageGroup?.join(', ') || '—';
  const sex = version.biologicalSex?.join(', ') || '—';
  const popQualifier = version.lifeStage?.join(', ') || '—';
  const notes = version.demographicBackfillReview || '—';

  const hasAnyData = (
    (version.ageGroup?.length > 0) ||
    (version.biologicalSex?.length > 0) ||
    (version.lifeStage?.length > 0) ||
    version.demographicBackfillReview
  );
  if (!hasAnyData) return <p className={styles.noData}>No demographic data recorded for this version.</p>;

  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Age Range</th>
          <th>Sex</th>
          <th>Population Qualifier</th>
          <th>Demographic Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>{ageRange}</td>
          <td>{sex}</td>
          <td>{popQualifier}</td>
          <td>{notes}</td>
        </tr>
      </tbody>
    </table>
  );
}

function FormulaTable({ formulaLines }) {
  if (!formulaLines?.length) return <p className={styles.noData}>No formula lines recorded for this version.</p>;
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Ingredient / AI Form</th>
          <th>FM PLM#</th>
          <th>Ingredient Source</th>
          <th>Amount / Serving</th>
          <th>Unit</th>
          <th>% DV</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {formulaLines.map(line => {
          const label = line.ai || line.aiForm || line.ingredientForm || '—';
          const amount = line.amountPerServing != null ? String(line.amountPerServing) : '—';
          const unit = line.amountUnit || '—';
          const dv = line.percentDailyValue != null ? `${line.percentDailyValue}%` : '—';
          return (
            <tr key={line.id}>
              <td>{label}</td>
              <td>{line.fmPlm || '—'}</td>
              <td>{line.ingredientSource || '—'}</td>
              <td>{amount}</td>
              <td>{unit}</td>
              <td>{dv}</td>
              <td>{line.formulaNotes || '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ClaimsSection({ claims }) {
  if (!claims?.length) return <p className={styles.noData}>No claims recorded for this version.</p>;
  // Group by coreBenefitId (or fall back to claimBucket label).
  const groups = {};
  for (const claim of claims) {
    const groupKey = claim.coreBenefitId || claim.claimBucket || 'Ungrouped';
    if (!groups[groupKey]) groups[groupKey] = { label: groupKey, claims: [] };
    groups[groupKey].claims.push(claim);
  }
  return (
    <>
      {Object.values(groups).map(group => (
        <div key={group.label} className={styles.benefitGroup}>
          <h3 className={styles.benefitHeading}>
            {group.label === group.claims[0]?.claimBucket
              ? `Bucket ${group.label}`
              : group.label}
          </h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Claim Text</th>
                <th>Bucket</th>
                <th>Status</th>
                <th>Dose Min (mg)</th>
                <th>Dose Max (mg)</th>
                <th>Evidence Packets</th>
              </tr>
            </thead>
            <tbody>
              {group.claims.map(claim => (
                <tr key={claim.id}>
                  <td>{claim.claimNo || '—'}</td>
                  <td>{claim.claim || '—'}</td>
                  <td>{claim.claimBucket || '—'}</td>
                  <td>{claim.claimStatus || '—'}</td>
                  <td>{claim.minDoseMg != null ? claim.minDoseMg : '—'}</td>
                  <td>{claim.maxDoseMg != null ? claim.maxDoseMg : '—'}</td>
                  <td>{claim.evidencePacketIds?.length > 0 ? claim.evidencePacketIds.length : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
}

function EvidenceBlock({ evidencePackets }) {
  if (!evidencePackets?.length) return <p className={styles.noData}>No evidence packets linked to claims in this version.</p>;
  return (
    <>
      {evidencePackets.map(pkt => (
        <div key={pkt.id} className={styles.evidenceCard}>
          <p className={styles.evidenceCardTitle}>{pkt.name || '(Unnamed packet)'}</p>
          <div className={styles.evidenceMeta}>
            {pkt.substantiationTier && (<span><strong>Tier:</strong> {pkt.substantiationTier}</span>)}
            {pkt.evidenceRole && (<span><strong>Role:</strong> {pkt.evidenceRole}</span>)}
            {pkt.studyDoseAI && (<span><strong>Study AI:</strong> {pkt.studyDoseAI}</span>)}
            {pkt.studyDoseAmount != null && pkt.studyDoseUnit && (
              <span><strong>Study dose:</strong> {pkt.studyDoseAmount} {pkt.studyDoseUnit}</span>
            )}
            {pkt.sampleSize != null && (<span><strong>N:</strong> {pkt.sampleSize}</span>)}
            {typeof pkt.meetsSqrThreshold === 'boolean' && (
              <span><strong>SQR threshold:</strong> {pkt.meetsSqrThreshold ? 'Yes' : 'No'}</span>
            )}
          </div>
          {pkt.studyDesignSummary && (
            <p style={{ fontSize: '9pt', marginBottom: '0.25rem' }}>
              <strong>Design:</strong> {pkt.studyDesignSummary}
            </p>
          )}
          {pkt.relevanceNote && (
            <p style={{ fontSize: '9pt', marginBottom: '0.25rem' }}>
              <strong>Relevance:</strong> {pkt.relevanceNote}
            </p>
          )}
          {pkt.keyTakeaway && (
            <p className={styles.evidenceTakeaway}>
              <strong>Key takeaway:</strong> {pkt.keyTakeaway}
            </p>
          )}
          {pkt.nullResultRationale && (
            <p className={styles.evidenceTakeaway}>
              <strong>Null result rationale:</strong> {pkt.nullResultRationale}
            </p>
          )}
        </div>
      ))}
    </>
  );
}

function RevisionHistoryTable({ revisionEvents }) {
  if (!revisionEvents?.length) return <p className={styles.noData}>No revision events recorded for this version.</p>;
  const showApproverCols = revisionEvents.some(e => e.approverAlias || e.approverDepartment);
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th>Start Date</th>
          <th>End Date</th>
          <th>Activity Type</th>
          <th>Responsible Dept</th>
          <th>Responsible Individual</th>
          <th>From Version</th>
          <th>To Version</th>
          {showApproverCols && <th>Approver</th>}
          {showApproverCols && <th>Approver Dept</th>}
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        {revisionEvents.map(ev => (
          <tr key={ev.id}>
            <td>{ev.startDate || '—'}</td>
            <td>{ev.endDate || '—'}</td>
            <td>{ev.activityType || ev.event || '—'}</td>
            <td>{ev.responsibleDept || '—'}</td>
            <td>{ev.responsibleIndividual || '—'}</td>
            <td>{ev.fromVersion || '—'}</td>
            <td>{ev.toVersion || '—'}</td>
            {showApproverCols && <td>{ev.approverAlias || '—'}</td>}
            {showApproverCols && <td>{ev.approverDepartment || '—'}</td>}
            <td>{ev.eventNotes || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
