'use client';

import { useState } from 'react';

interface LegalAgreements {
  risk: boolean;
  retention: boolean;
  indemnity: boolean;
}

interface LegalGatekeeperProps {
  onAgreedChange: (agreed: boolean) => void;
  variant?: 'compact' | 'expanded';
}

export default function LegalGatekeeper({ onAgreedChange, variant = 'expanded' }: LegalGatekeeperProps) {
  const [agreed, setAgreed] = useState<LegalAgreements>({
    risk: false,
    retention: false,
    indemnity: false,
  });

  const allChecked = agreed.risk && agreed.retention && agreed.indemnity;

  const handleChange = (key: keyof LegalAgreements) => {
    const newAgreed = { ...agreed, [key]: !agreed[key] };
    setAgreed(newAgreed);
    onAgreedChange(newAgreed.risk && newAgreed.retention && newAgreed.indemnity);
  };

  if (variant === 'compact') {
    return (
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-lg p-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={allChecked}
            onChange={() => {
              const newValue = !allChecked;
              setAgreed({ risk: newValue, retention: newValue, indemnity: newValue });
              onAgreedChange(newValue);
            }}
            className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-accent-gold focus:ring-accent-gold"
          />
          <span className="text-sm text-slate-300">
            I have read and agree to the <a href="#terms" className="text-accent-gold underline">Terms of Service</a>
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">⚖️</span>
        <h3 className="text-lg font-medium text-white">Legal Acknowledgment Required</h3>
      </div>
      
      <p className="text-sm text-slate-400 mb-4">
        You must acknowledge all three clauses below before sending emails. This is a legal requirement.
      </p>

      {/* Clause 1: Use at Your Own Risk */}
      <label className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors cursor-pointer">
        <input
          type="checkbox"
          checked={agreed.risk}
          onChange={() => handleChange('risk')}
          className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-accent-gold focus:ring-accent-gold"
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-accent-gold">☠️ Use at Your Own Risk</span>
          <p className="text-xs text-slate-400 mt-1">
            This service is provided strictly as a technical facilitator for email transmission. By using this tool, 
            you acknowledge that you are entirely responsible for the content of your emails and the legality of your 
            recipient lists.
          </p>
        </div>
      </label>

      {/* Clause 2: No Data Retention */}
      <label className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors cursor-pointer">
        <input
          type="checkbox"
          checked={agreed.retention}
          onChange={() => handleChange('retention')}
          className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-accent-gold focus:ring-accent-gold"
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-accent-gold">🔒 No Data Retention</span>
          <p className="text-xs text-slate-400 mt-1">
            To protect your privacy, we operate a zero-storage policy. Once an email is processed, all data 
            (HTML content and lead lists) is permanently purged from our volatile memory. We cannot recover lost 
            data or provide logs of past campaigns.
          </p>
        </div>
      </label>

      {/* Clause 3: Indemnification */}
      <label className="flex items-start gap-3 p-4 bg-slate-800/50 rounded-lg border border-slate-700/30 hover:border-slate-600/50 transition-colors cursor-pointer">
        <input
          type="checkbox"
          checked={agreed.indemnity}
          onChange={() => handleChange('indemnity')}
          className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-accent-gold focus:ring-accent-gold"
        />
        <div className="flex-1">
          <span className="text-sm font-medium text-accent-gold">⚖️ Indemnification</span>
          <p className="text-xs text-slate-400 mt-1">
            The provider shall not be held liable for any direct, indirect, or consequential damages 
            (including loss of business or profits) resulting from the use or inability to use this service. 
            You agree to indemnify the provider against any legal claims arising from your use of this tool.
          </p>
        </div>
      </label>

      {/* Status Indicator */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-700/30">
        <div className="flex items-center gap-2">
          {allChecked ? (
            <>
              <span className="text-green-400">✓</span>
              <span className="text-sm text-green-400">All terms accepted</span>
            </>
          ) : (
            <>
              <span className="text-slate-500">○</span>
              <span className="text-sm text-slate-500">
                {3 - [agreed.risk, agreed.retention, agreed.indemnity].filter(Boolean).length} terms remaining
              </span>
            </>
          )}
        </div>
        <div className="w-24 h-2 bg-slate-700/50 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${allChecked ? 'bg-green-500' : 'bg-accent-gold'}`}
            style={{ width: `${([agreed.risk, agreed.retention, agreed.indemnity].filter(Boolean).length / 3) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Hook for managing legal agreements
export function useLegalAgreement() {
  const [agreed, setAgreed] = useState(false);
  const [agreements, setAgreements] = useState<LegalAgreements>({
    risk: false,
    retention: false,
    indemnity: false,
  });

  const allAgreed = agreements.risk && agreements.retention && agreements.indemnity;

  const updateAgreement = (key: keyof LegalAgreements, value: boolean) => {
    const newAgreements = { ...agreements, [key]: value };
    setAgreements(newAgreements);
    setAgreed(newAgreements.risk && newAgreements.retention && newAgreements.indemnity);
  };

  const resetAgreements = () => {
    setAgreed(false);
    setAgreements({ risk: false, retention: false, indemnity: false });
  };

  return {
    agreed: allAgreed,
    agreements,
    updateAgreement,
    resetAgreements,
  };
}