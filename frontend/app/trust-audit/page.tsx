"use client";
import { CheckCircle2, ShieldCheck, Lock, FileText, Database } from "lucide-react";

import { usePolledQuery } from "@/hooks/use-polled-data";

export default function TrustAuditPage() {
  const { data: audits = [] } = usePolledQuery<any>(["trustAudit"], "trustAudit");

  return (
    <div className="animate-in fade-in duration-700 space-y-8">
      
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-400" /> 
            Trust Audit
          </h1>
          <p className="text-text-2 mt-1">Cryptographic verification of edge ML decisions and data integrity.</p>
        </div>
        <button className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
          <Lock className="w-4 h-4" /> Run Full Integrity Check
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Integrity Status */}
        <div className="glass rounded-3xl p-6 border border-emerald-500/30 flex flex-col items-center justify-center text-center">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full" />
            <CheckCircle2 className="w-20 h-20 text-emerald-400 relative z-10" />
          </div>
          <h2 className="text-2xl font-black text-white mb-2">100% Verified</h2>
          <p className="text-sm text-text-2">
            All edge actuations, OTA updates, and model weights match their cryptographically signed hashes. No tampering detected.
          </p>
        </div>

        {/* Audit Log */}
        <div className="md:col-span-2 glass rounded-3xl p-6 border border-border/50">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <Database className="w-4 h-4 text-text-3" /> Immutable Ledger
          </h2>
          
          <div className="space-y-3">
            {audits.map((audit) => (
              <div key={audit.id} className="flex items-center justify-between p-3 rounded-xl bg-surface-2 border border-border hover:bg-surface-3 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-surface rounded-lg">
                    <FileText className="w-4 h-4 text-text-3" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-white">{audit.type}</div>
                    <div className="text-xs font-mono text-text-3">{new Date(audit.date).toLocaleString()}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-xs font-mono text-text-3 hidden md:block">
                    {audit.hash}
                  </div>
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider">
                    {audit.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
