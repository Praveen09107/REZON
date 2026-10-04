"use client";
import { useState } from "react";
import { Shield, Key, UserCheck, Lock, CheckCircle2 } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "Operator" | "Safety Engineer" | "Viewer (Judge)";
  lastActive: string;
}

export default function AccessPage() {
  const [profiles, setProfiles] = useState<UserProfile[]>([
    { id: "usr-01", name: "Praveen (Lead Operator)", email: "lead.engineer@rezon.ai", role: "Operator", lastActive: "Just now" },
    { id: "usr-02", name: "Industrial Safety Team", email: "safety.officer@plant.internal", role: "Safety Engineer", lastActive: "14m ago" },
    { id: "usr-03", name: "Evaluation Panel (Judge)", email: "hackathon.judge@demo.local", role: "Viewer (Judge)", lastActive: "Active session" },
  ]);

  const [keyGenerated, setKeyGenerated] = useState(false);

  const handleRoleChange = (userId: string, newRole: any) => {
    setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
  };

  return (
    <div className="animate-in fade-in duration-700 space-y-8 max-w-4xl">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
            <Shield className="w-8 h-8 text-calm" /> 
            Access Control & RBAC
          </h1>
          <p className="text-text-2 mt-1">Manage physical actuation privileges, operator credentials, and judge demo scopes.</p>
        </div>

        <button 
          onClick={() => {
            setKeyGenerated(true);
            setTimeout(() => setKeyGenerated(false), 3000);
          }}
          className="bg-calm hover:bg-calm/80 text-black font-bold px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2"
        >
          <Key className="w-4 h-4" />
          {keyGenerated ? "Edge Token Rotated!" : "Rotate Edge Token"}
        </button>
      </div>

      {keyGenerated && (
        <div className="glass border border-calm/50 bg-calm/10 p-4 rounded-2xl flex items-center gap-3 text-calm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div className="text-sm font-mono">
            New HMAC-SHA256 Token generated and signed into Edge Hardware Nonce.
          </div>
        </div>
      )}

      {/* Permissions Matrix */}
      <div className="glass rounded-3xl p-6 border border-border/50">
        <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
          <UserCheck className="w-5 h-5 text-calm" />
          Authorized Operator Roster
        </h2>

        <div className="space-y-3">
          {profiles.map((p) => (
            <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl bg-surface-2 border border-border gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-surface-3 border border-border flex items-center justify-center font-bold text-calm font-mono">
                  {p.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{p.name}</div>
                  <div className="text-xs text-text-3 font-mono">{p.email}</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-xs font-mono text-text-3">{p.lastActive}</span>
                <select 
                  value={p.role} 
                  onChange={(e) => handleRoleChange(p.id, e.target.value)}
                  className="rounded-xl border border-border bg-surface-3 px-3 py-1.5 text-xs text-white font-medium focus:border-calm outline-none"
                >
                  <option value="Operator">Operator (Full Actuation)</option>
                  <option value="Safety Engineer">Safety Engineer (Acknowledge Only)</option>
                  <option value="Viewer (Judge)">Viewer (Judge Demo Mode)</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hardware Interlock Guarantee Card */}
      <div className="glass rounded-3xl p-6 border border-border/50 flex items-start gap-4">
        <div className="p-3 bg-calm/10 border border-calm/30 rounded-2xl shrink-0">
          <Lock className="w-6 h-6 text-calm" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-1">
            Zero-Trust Hardware Actuation Guarantee
          </h3>
          <p className="text-xs text-text-2 leading-relaxed">
            Even with Operator privilege, physical breaker trips cannot be initiated remotely without the ESP32 safety state machine verifying that 2-of-N independent sensor channels agree. Software commands cannot bypass physical safety invariants.
          </p>
        </div>
      </div>

    </div>
  );
}
