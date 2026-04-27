export interface ValueCard {
  id: string;
  name: string;
  description: string;
}

export const VALUES: ValueCard[] = [
  {
    id: 'radical-transparency',
    name: 'Radical Transparency',
    description:
      'your company’s operations, data, and decisions are visible, internally and externally. trust is your brand.',
  },
  {
    id: 'equity-inclusion',
    name: 'Equity & Inclusion',
    description:
      'you commit to diverse leadership, fair labour, and access for historically excluded communities.',
  },
  {
    id: 'climate-action-priority',
    name: 'Climate Action Priority',
    description:
      'you lead with bold sustainability goals: zero emissions, regenerative systems, and climate justice in your supply chain.',
  },
  {
    id: 'accountability',
    name: 'Accountability',
    description: 'you own your impact — good or bad — and act on it.',
  },
  {
    id: 'community',
    name: 'Community',
    description: 'your company is shaped by the needs and assets of the communities you serve.',
  },
  {
    id: 'maximum-profitability',
    name: 'Maximum Profitability',
    description: 'your growth strategy centres on profit. investors love you.',
  },
  {
    id: 'speed-to-market',
    name: 'Speed to Market',
    description:
      'you outpace the competition with fast launches and iteration. agility is your edge.',
  },
  {
    id: 'scalable-simplicity',
    name: 'Scalable Simplicity',
    description:
      'your offering is lean, modular, and easy to replicate. efficiency opens global doors.',
  },
  {
    id: 'global-brand-recognition',
    name: 'Global Brand Recognition',
    description: 'everyone knows your name. you’re sexy, social, and spotlighted.',
  },
  {
    id: 'resilience-culture',
    name: 'Resilience Culture',
    description: 'you plan for shocks. flexibility and grit guide your team.',
  },
  {
    id: 'psychological-safety',
    name: 'Psychological Safety',
    description:
      'your team thrives on experimentation, failure, and feedback. people speak up and grow.',
  },
  {
    id: 'empathic-leadership',
    name: 'Empathic Leadership',
    description: 'you lead with compassion and care. people are more than productivity.',
  },
  {
    id: 'customer-commitment',
    name: 'Customer Commitment',
    description: 'you serve with precision. their needs drive every choice.',
  },
  {
    id: 'responsible-ai-tech-ethics',
    name: 'Responsible AI / Tech Ethics',
    description: 'your tech respects autonomy, avoids bias, and protects data with care.',
  },
  {
    id: 'futures-thinking',
    name: 'Futures Thinking',
    description:
      'you build not for today, but for the world we’re heading toward: flexible, regenerative, humane.',
  },
  {
    id: 'design-for-dignity',
    name: 'Design for Dignity',
    description:
      'beauty, accessibility, and function are embedded in your product for everyone.',
  },
  {
    id: 'trust-as-currency',
    name: 'Trust as Currency',
    description:
      'customers, partners, and employees believe in you. credibility compounds.',
  },
  {
    id: 'design-excellence',
    name: 'Design Excellence',
    description: 'you prize beauty and function equally. good design is good business.',
  },
  {
    id: 'affordable-access',
    name: 'Affordable Access',
    description: 'you never price people out. affordability and impact go hand in hand.',
  },
  {
    id: 'culture-of-reflection',
    name: 'Culture of Reflection',
    description: 'your org makes time to pause, learn, and evolve together.',
  },
];

export function getValue(id: string): ValueCard | undefined {
  return VALUES.find((v) => v.id === id);
}
