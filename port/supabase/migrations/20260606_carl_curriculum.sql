-- cARL curriculum: the target corpus cARL works toward — a marketing-focused
-- business-school syllabus + the lifelong-learning / learning-science canon.
-- Each row is a topic within a domain. `status` tracks coverage; the dashboard
-- shows covered/total per domain and surfaces planned-but-empty topics as blind
-- spots. This is a DRAFT for garrett/jamie/maria to redline — it's just data.

CREATE TABLE IF NOT EXISTS carl_curriculum (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text NOT NULL,
  topic text NOT NULL,
  key_works text[] DEFAULT '{}',
  priority int NOT NULL DEFAULT 2,           -- 1 = foundational, 2 = standard, 3 = stretch
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in-progress', 'covered')),
  notes text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX carl_curriculum_domain_idx ON carl_curriculum (domain);
CREATE INDEX carl_curriculum_status_idx ON carl_curriculum (status);
CREATE INDEX carl_curriculum_sort_idx ON carl_curriculum (sort_order);

INSERT INTO carl_curriculum (domain, topic, key_works, priority, sort_order) VALUES
-- ── marketing core (business-school) ───────────────────────────────
('marketing strategy', 'segmentation, targeting & positioning (STP)', ARRAY['Kotler & Keller — Marketing Management','Ries & Trout — Positioning'], 1, 10),
('marketing strategy', 'competitive strategy & sustainable advantage', ARRAY['Porter — Competitive Strategy','Porter — Competitive Advantage'], 1, 11),
('marketing strategy', 'the marketing mix (4Ps / 7Ps) & go-to-market', ARRAY['McCarthy — Basic Marketing','Kotler & Keller — Marketing Management'], 1, 12),
('consumer behaviour', 'the consumer decision journey', ARRAY['Solomon — Consumer Behavior'], 1, 20),
('consumer behaviour', 'behavioural economics & choice architecture', ARRAY['Kahneman — Thinking, Fast and Slow','Thaler & Sunstein — Nudge','Ariely — Predictably Irrational'], 1, 21),
('consumer behaviour', 'influence, persuasion & social proof', ARRAY['Cialdini — Influence'], 1, 22),
('brand & positioning', 'brand equity & how brands create value', ARRAY['Aaker — Building Strong Brands','Keller — Strategic Brand Management'], 1, 30),
('brand & positioning', 'differentiation & category design', ARRAY['Ries & Trout — Positioning','Moore — Crossing the Chasm'], 2, 31),
('brand & positioning', 'brand narrative & storytelling', ARRAY['Miller — Building a StoryBrand'], 2, 32),
('pricing', 'value-based pricing strategy', ARRAY['Nagle & Müller — The Strategy and Tactics of Pricing'], 1, 40),
('pricing', 'price elasticity & willingness to pay', ARRAY['Nagle & Müller — The Strategy and Tactics of Pricing'], 2, 41),
('pricing', 'psychological & behavioural pricing', ARRAY['Poundstone — Priceless'], 2, 42),
('digital & growth marketing', 'funnels, AARRR metrics & growth loops', ARRAY['Ellis & Brown — Hacking Growth','Croll & Yoskovitz — Lean Analytics'], 1, 50),
('digital & growth marketing', 'content marketing, SEO & owned media', ARRAY['Pulizzi — Epic Content Marketing'], 2, 51),
('digital & growth marketing', 'paid acquisition, attribution & CAC/LTV', ARRAY['Croll & Yoskovitz — Lean Analytics'], 2, 52),
('marketing research & analytics', 'qual + quant research methods', ARRAY['Malhotra — Marketing Research'], 1, 60),
('marketing research & analytics', 'experimentation & A/B testing', ARRAY['Kohavi, Tang & Xu — Trustworthy Online Controlled Experiments'], 2, 61),
('marketing research & analytics', 'analytics as competitive advantage', ARRAY['Davenport & Harris — Competing on Analytics'], 2, 62),
('communications & storytelling', 'integrated marketing communications', ARRAY['Kotler & Keller — Marketing Management'], 2, 70),
('communications & storytelling', 'making ideas stick & memorable', ARRAY['Heath & Heath — Made to Stick'], 1, 71),
('communications & storytelling', 'permission, trust & marketing as service', ARRAY['Godin — This Is Marketing','Godin — Permission Marketing'], 2, 72),
('b2b, nonprofit & cause marketing', 'B2B buying & account-based marketing', ARRAY['Vitale, Giglierano & Pfoertsch — Business-to-Business Marketing'], 2, 80),
('b2b, nonprofit & cause marketing', 'social & cause marketing', ARRAY['Andreasen — Social Marketing in the 21st Century','Kotler & Lee — Marketing for Nonprofit Organizations'], 1, 81),
('b2b, nonprofit & cause marketing', 'community, relationship & word-of-mouth', ARRAY['Berger — Contagious'], 2, 82),
-- ── lifelong learning / learning science (cARL''s existing lines) ───
('threshold concepts', 'troublesome knowledge & portals', ARRAY['Meyer & Land — Overcoming Barriers to Student Understanding'], 1, 90),
('threshold concepts', 'liminality & the stuck place in learning', ARRAY['Land, Meyer & Flanagan — Threshold Concepts in Practice'], 2, 91),
('play-based & experiential pedagogy', 'the experiential learning cycle', ARRAY['Kolb — Experiential Learning'], 1, 100),
('play-based & experiential pedagogy', 'play, the zone of proximal development & learning', ARRAY['Vygotsky — Mind in Society'], 1, 101),
('play-based & experiential pedagogy', 'embodied cognition & retention', ARRAY['Lakoff & Johnson — Metaphors We Live By'], 2, 102),
('learning design & UDL', 'universal design for learning', ARRAY['CAST — UDL Guidelines','Meyer, Rose & Gordon — Universal Design for Learning'], 1, 110),
('learning design & UDL', 'cognitive load & multimedia learning', ARRAY['Mayer — Multimedia Learning','Sweller — Cognitive Load Theory'], 2, 111),
('learning design & UDL', 'assessment for learning & feedback', ARRAY['Black & Wiliam — Inside the Black Box'], 2, 112),
('ai in education', 'intelligent tutoring & personalization', ARRAY['Holmes, Bialik & Fadel — Artificial Intelligence in Education'], 2, 120),
('ai in education', 'AI literacy & ethics in learning', ARRAY['Selwyn — Should Robots Replace Teachers?'], 2, 121),
('critical & cultural pedagogy', 'critical pedagogy & problem-posing', ARRAY['Freire — Pedagogy of the Oppressed'], 1, 130),
('critical & cultural pedagogy', 'culturally responsive & engaged teaching', ARRAY['hooks — Teaching to Transgress','Hammond — Culturally Responsive Teaching and the Brain'], 2, 131);
