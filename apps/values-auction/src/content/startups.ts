export interface Startup {
  id: string;
  name: string;
  sector: string;
  profile: string;
  challenge: string;
  logoKey: string;
}

export const STARTUPS: Startup[] = [
  {
    id: 'ethos',
    name: 'ETHOS',
    sector: 'fashion',
    profile:
      'a fashion startup aiming to scale sustainably but facing intense pressure from fast fashion competitors.',
    challenge:
      'your team must grow quickly to meet demand, but every shortcut you take could compromise your brand’s ethical standards and environmental commitments.',
    logoKey: 'ethos',
  },
  {
    id: 'opened',
    name: 'OpenEd',
    sector: 'edtech',
    profile:
      'a learning platform promising equity in digital education, yet struggling with limited tech access in rural and underserved regions.',
    challenge:
      'investors want rapid user growth, but how do you ensure access and inclusion for the most marginalised students?',
    logoKey: 'opened',
  },
  {
    id: 'growup',
    name: 'GrowUp',
    sector: 'agritech',
    profile:
      'an agritech company innovating regenerative farming tools while under pressure from stakeholders for quick returns and market dominance.',
    challenge:
      'maintain ecological integrity while scaling rapidly and satisfying impatient investors.',
    logoKey: 'growup',
  },
  {
    id: 'care-ai',
    name: 'Care.ai',
    sector: 'health tech',
    profile:
      'a health tech platform designed to personalise care using AI, while navigating data privacy, algorithmic bias, and ethical guardrails.',
    challenge:
      'every decision about speed, personalisation, and partnerships has implications for trust, equity, and health outcomes.',
    logoKey: 'care-ai',
  },
  {
    id: 'bluecircuits',
    name: 'BlueCircuits',
    sector: 'hardware',
    profile:
      'a hardware startup building modular electronics to reduce e-waste, while competing with cheaper, disposable products in the market.',
    challenge:
      'you must convince consumers and suppliers that ethical design and circular economy thinking are worth the cost and disruption.',
    logoKey: 'bluecircuits',
  },
  {
    id: 'coact',
    name: 'CoAct',
    sector: 'consulting',
    profile:
      'a collaborative impact consultancy offering climate strategy to corporate clients, while refusing greenwashing and performative CSR.',
    challenge:
      'can you uphold integrity and push for transformation while keeping large clients happy and contracts flowing?',
    logoKey: 'coact',
  },
  {
    id: 'homehatch',
    name: 'HomeHatch',
    sector: 'real estate',
    profile:
      'a real estate tech startup aimed at sustainable, affordable housing access, working within policy and zoning constraints.',
    challenge:
      'you’re caught between innovation, neighbourhood resistance, and rising construction costs. can you stay mission-aligned?',
    logoKey: 'homehatch',
  },
  {
    id: 'ripple',
    name: 'Ripple',
    sector: 'fintech',
    profile:
      'a fintech platform promoting financial inclusion for migrant workers, challenged by regulatory constraints and fraud risk.',
    challenge:
      'your business depends on trust and accessibility, but navigating compliance and risk aversion is slowing down your innovation.',
    logoKey: 'ripple',
  },
];

export function getStartup(id: string): Startup | undefined {
  return STARTUPS.find((s) => s.id === id);
}
