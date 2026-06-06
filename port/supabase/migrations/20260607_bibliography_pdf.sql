-- Phase B: store retrieved open-access PDFs (in the R2 `port-assets` bucket,
-- under `bibliography-pdfs/<id>.pdf`) on bibliography rows.
--   pdf_url    — internal serve path (/api/bibliography/<id>/pdf), null until retrieved
--   pdf_source — which retrieval tier produced it (oa-link | unpaywall | openalex | core | arxiv | upload)
ALTER TABLE bibliography ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE bibliography ADD COLUMN IF NOT EXISTS pdf_source text;
