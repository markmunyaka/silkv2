import React from 'react';

interface DomainSectionProps {
  domains: string[];
}

export const DomainSection: React.FC<DomainSectionProps> = ({ domains }) => {
  if (!domains.length) return null;
  return (
    <section className="section-container mb-16">
      <h2 className="text-2xl font-serif text-white mb-4">Top Domains</h2>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {domains.map((domain, idx) => (
          <li
            key={idx}
            className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-accent-gold/50 transition-all"
          >
            <span className="text-foreground-secondary text-sm">{domain}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};
