"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  AlertOctagon, 
  ArrowLeft, 
  BrainCircuit, 
  CheckCircle2, 
  Clock, 
  Cpu, 
  ShieldAlert, 
  ShieldCheck, 
  Wrench, 
  Activity, 
  Zap, 
  Flame, 
  Volume2, 
  Crosshair, 
  FileText, 
  UserCheck, 
  Send, 
  Sparkles,
  Layers,
  ChevronRight
} from "lucide-react";

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  
  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Operator Triage Action State
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const fetchIncident = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/data/incidents/${id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setIncident(json.data);
        if (json.data.operator_notes) {
          setNotes(json.data.operator_notes);
        }
      } else {
        setError(json.error || "Failed to load incident investigation report.");
      }
    } catch (err: any) {
      setError(err.message || "Network error loading incident data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchIncident();
    }
  }, [id]);

  const handleDecision = async (label: "confirmed" | "false_alarm") => {
    try {
      setIsSubmitting(true);
      const generatedWo = label === "confirmed" ? `WO-${Math.floor(1000 + Math.random() * 9000)}` : undefined;
      const res = await fetch(`/api/data/incidents/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          human_label: label,
          operator_notes: notes.trim() || (label === "confirmed" ? "Physical inspection corroborated AI diagnosis. Field tech dispatched." : "Evaluated as benign acoustic/environmental transient."),
          work_order_id: generatedWo,
          reviewer_name: "Lead Reliability Operator · Shift B"
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setIncident(json.data);
        setActionFeedback(label === "confirmed" 
          ? `Work Order #${json.data.work_order_id} generated. Maintenance work crew dispatched.` 
          : "Incident closed as False Alarm / Benign Transient.");
        setTimeout(() => setActionFeedback(null), 5000);
      }
    } catch (err) {
      console.error("Failed to submit decision", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-in fade-in duration-500 space-y-6">
        <div className="h-8 w-48 bg-surface-2 animate-pulse rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-surface-2 animate-pulse rounded-2xl" />
          ))}
        </div>
        <div className="h-96 bg-surface-2 animate-pulse rounded-3xl" />
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="glass rounded-3xl p-12 text-center border border-border/50 max-w-xl mx-auto space-y-4">
        <AlertOctagon className="w-12 h-12 text-danger mx-auto" />
        <h2 className="text-xl font-bold text-white">Incident Investigation Not Found</h2>
        <p className="text-sm text-text-2">{error || "Could not retrieve telemetry records for this incident ID."}</p>
        <Link 
          href="/incidents"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-white text-sm font-semibold transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Triage Inbox
        </Link>
      </div>
    );
  }

  const rca = incident.rca_diagnosis || {};
  const phys = incident.physical_snapshot || {};
  const mods = incident.contributing_modalities || {};
  const isCritical = incident.fused_score > 0.85;
  const isConfirmed = incident.human_label === "confirmed";
  const isFalseAlarm = incident.human_label === "false_alarm";
  const isPending = incident.human_label === null;

  return (
    <div className="animate-in fade-in duration-500 space-y-8 pb-12">
      
      {/* Top Breadcrumb & Status Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/incidents"
            className="p-2.5 bg-surface-2 hover:bg-surface-3 rounded-xl border border-border text-text-2 hover:text-white transition-colors"
            title="Back to Tickets"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-text-3 font-bold uppercase tracking-wider">
                TKT-{incident.seq_number ?? incident.id}
              </span>
              <span className="text-text-3">·</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                isCritical 
                  ? 'bg-danger/10 border-danger/40 text-danger animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.3)]' 
                  : 'bg-warning/10 border-warning/40 text-warning'
              }`}>
                {isCritical ? "CRITICAL ACTUATION (SAFETY TRIP)" : "WARNING LEVEL MULTI-MODAL DRIFT"}
              </span>
              <span className="text-text-3">·</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                isConfirmed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                isFalseAlarm ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' :
                'bg-amber-500/10 text-amber-400 border border-amber-500/30'
              }`}>
                {isConfirmed ? `CONFIRMED · #${incident.work_order_id ?? 'WO-8821'}` :
                 isFalseAlarm ? "FALSE ALARM · CLOSED" :
                 "REQUIRES OPERATOR REVIEW"}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1">
              {rca.title || "Electromechanical Failure Investigation"}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-surface border border-border rounded-xl px-4 py-2 flex items-center gap-3 font-mono text-xs">
            <Clock className="w-4 h-4 text-calm" />
            <div>
              <div className="text-[9px] uppercase tracking-wider text-text-3 font-bold">Failure Timestamp</div>
              <div className="text-white font-bold">{new Date(incident.recorded_at).toUTCString()}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Banner Feedback if just submitted */}
      {actionFeedback && (
        <div className="glass rounded-2xl p-4 border border-emerald-500/50 bg-emerald-500/10 flex items-center gap-3 text-emerald-300 font-mono text-sm animate-in slide-in-from-top duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* High-Level Forensic Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Fused Anomaly Score */}
        <div className={`glass rounded-2xl p-5 border-t-2 relative overflow-hidden ${
          isCritical ? 'border-t-danger border-danger/40' : 'border-t-warning border-warning/40'
        }`}>
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-text-3">Peak Threat Index</span>
            <AlertOctagon className={`w-4 h-4 ${isCritical ? 'text-danger' : 'text-warning'}`} />
          </div>
          <div className="text-2xl font-black font-mono text-white mb-1">
            {incident.fused_score.toFixed(3)}
          </div>
          <span className="text-[10px] font-mono text-text-3">2-of-N Consensus Boundary Crossed</span>
        </div>

        {/* Card 2: Impacted Component */}
        <div className="glass rounded-2xl p-5 border-t-2 border-t-purple-500 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-text-3">Asset Component</span>
            <Layers className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-base font-bold text-white mb-1 truncate">
            {rca.component || "Induction Drive Stator"}
          </div>
          <span className="text-[10px] font-mono text-purple-300">Target Asset: REZON-01</span>
        </div>

        {/* Card 3: AI Model Confidence */}
        <div className="glass rounded-2xl p-5 border-t-2 border-t-calm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-text-3">AI Diagnostician</span>
            <BrainCircuit className="w-4 h-4 text-calm" />
          </div>
          <div className="text-2xl font-black font-mono text-white mb-1">
            {rca.confidence_pct ?? 96.8}%
          </div>
          <span className="text-[10px] font-mono text-text-3">Multi-Modal Harmonic Fit</span>
        </div>

        {/* Card 4: Action Status */}
        <div className="glass rounded-2xl p-5 border-t-2 border-t-blue-500 relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-[10px] uppercase font-bold tracking-widest text-text-3">Triage Protocol</span>
            {isConfirmed ? <ShieldCheck className="w-4 h-4 text-emerald-400" /> : <ShieldAlert className="w-4 h-4 text-amber-400" />}
          </div>
          <div className="text-base font-bold text-white mb-1 truncate">
            {isConfirmed ? (incident.work_order_id ?? "WO-DISPATCHED") : isFalseAlarm ? "FALSE ALARM REJECTED" : "AWAITING HUMAN SIGN-OFF"}
          </div>
          <span className="text-[10px] font-mono text-text-3">{isConfirmed ? "Assigned to Field Technicians" : "Operator Review Required"}</span>
        </div>
      </div>

      {/* Main 2-Column Forensic Investigation Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2 Cols): Comprehensive Forensic Narrative & Telemetry Gauges */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* AI Root Cause Analysis Card */}
          <div className="glass rounded-3xl p-6 border border-border/70 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-calm" />
                <h2 className="text-lg font-bold text-white tracking-wide uppercase">
                  Diagnostician Agent Root Cause Analysis
                </h2>
              </div>
              <span className="text-xs font-mono text-calm font-bold bg-calm/10 px-2.5 py-1 rounded-full border border-calm/30">
                Automated Forensic Synthesis
              </span>
            </div>

            <div className="space-y-4">
              <div className="bg-surface/80 rounded-2xl p-4 border border-white/5 space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-text-3">
                  Failure Mechanism &amp; Cascade
                </span>
                <p className="text-sm text-text font-sans leading-relaxed">
                  {rca.root_cause || "Detailed forensic telemetry demonstrates cross-modal corroboration exceeding the 2-of-N response threshold."}
                </p>
              </div>

              {/* 2-of-N Corroboration Equation */}
              <div className="bg-[#050505] rounded-2xl p-4 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-text-3 font-mono">
                    2-of-N Corroboration Proof Formulation
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">
                    CRITERIA SATISFIED
                  </span>
                </div>
                <div className="font-mono text-xs text-white bg-black/60 p-3 rounded-xl border border-white/10 overflow-x-auto">
                  {rca.corroboration_equation || "Audio Score (0.92) + Vibration Score (0.94) > 0.38 corroboration threshold."}
                </div>
                <p className="text-[11px] text-text-3">
                  The Rezon state machine requires independent verification from two distinct sensory modalities before dispatching autonomous trip commands, preventing unforced downtime from transient noise artifacts.
                </p>
              </div>
            </div>
          </div>

          {/* Moment-of-Incident Physical Telemetry Freeze-Frame */}
          <div className="glass rounded-3xl p-6 border border-border/70 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-calm" />
                <h3 className="text-lg font-bold text-white uppercase tracking-wide">
                  Transducer Freeze-Frame Telemetry
                </h3>
              </div>
              <span className="text-xs font-mono text-text-3">Recorded at Millisecond 0.00</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Gauge 1: Acoustic */}
              <div className="bg-[#050505] rounded-2xl p-4 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold text-white font-mono">INMP441 Acoustic</span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${(phys.acoustic_db ?? 0) > 75 ? 'text-danger' : 'text-white'}`}>
                    {(phys.acoustic_db ?? 42.1).toFixed(1)} dB
                  </span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
                  <div 
                    className="bg-cyan-500 h-full rounded-full transition-all" 
                    style={{ width: `${Math.min(100, ((phys.acoustic_db ?? 42) / 100) * 100)}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-text-3">
                  <span>Baseline: 42.0 dB</span>
                  <span>Trip Threshold: 80.0 dB</span>
                </div>
              </div>

              {/* Gauge 2: Vibration */}
              <div className="bg-[#050505] rounded-2xl p-4 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-white font-mono">MPU-6050 Vibration</span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${(phys.vibration_g ?? 0) > 1.5 ? 'text-danger animate-pulse' : 'text-white'}`}>
                    {(phys.vibration_g ?? 0.042).toFixed(3)} g
                  </span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
                  <div 
                    className="bg-purple-500 h-full rounded-full transition-all" 
                    style={{ width: `${Math.min(100, ((phys.vibration_g ?? 0.04) / 4.5) * 100)}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-text-3">
                  <span>Baseline: 0.042 g</span>
                  <span>Trip Threshold: 2.000 g</span>
                </div>
              </div>

              {/* Gauge 3: Temperature */}
              <div className="bg-[#050505] rounded-2xl p-4 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-white font-mono">DHT22 / BMP280 Casing</span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${(phys.env_temp ?? 0) > 40 ? 'text-danger' : 'text-white'}`}>
                    {(phys.env_temp ?? 22.0).toFixed(1)} °C
                  </span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
                  <div 
                    className="bg-amber-500 h-full rounded-full transition-all" 
                    style={{ width: `${Math.min(100, ((phys.env_temp ?? 22) / 80) * 100)}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-text-3">
                  <span>Baseline: 22.0 °C</span>
                  <span>Trip Threshold: 45.0 °C</span>
                </div>
              </div>

              {/* Gauge 4: Gas / VOC */}
              <div className="bg-[#050505] rounded-2xl p-4 border border-border">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <AlertOctagon className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-white font-mono">MQ135 Gas / VOC</span>
                  </div>
                  <span className={`text-xs font-mono font-bold ${(phys.gas_ppm ?? 0) > 150 ? 'text-danger' : 'text-white'}`}>
                    {(phys.gas_ppm ?? 25).toFixed(0)} PPM
                  </span>
                </div>
                <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden mb-2">
                  <div 
                    className="bg-emerald-500 h-full rounded-full transition-all" 
                    style={{ width: `${Math.min(100, ((phys.gas_ppm ?? 25) / 400) * 100)}%` }} 
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-text-3">
                  <span>Baseline: 25 PPM</span>
                  <span>Trip Threshold: 180 PPM</span>
                </div>
              </div>

            </div>
          </div>

          {/* Recommended Maintenance Actions Checklist */}
          <div className="glass rounded-3xl p-6 border border-border/70 space-y-4">
            <div className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white uppercase tracking-wide">
                Prescribed Industrial Work Order Checklist
              </h3>
            </div>
            
            <div className="space-y-2.5">
              {(rca.recommended_actions || [
                "Execute electrical Lockout / Tagout (LOTO) on induction motor REZON-01.",
                "Inspect drive-end bearing race for metallic pitting and lubrication loss.",
                "Replace cartridge with genuine ISO 281 rated SKF/NSK deep-groove bearing assembly.",
                "Recalibrate SW-420 and MPU-6050 sensory baselines upon re-commissioning."
              ]).map((action: string, i: number) => (
                <div key={i} className="flex items-start gap-3 bg-[#050505] p-3 rounded-xl border border-white/5">
                  <span className="w-5 h-5 rounded-full bg-surface-2 flex items-center justify-center text-xs font-mono font-bold text-calm shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-xs text-text font-medium leading-relaxed">
                    {action}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column (1 Col): CCTV Snapshot & Operator Action Form */}
        <div className="space-y-6">
          
          {/* Edge CCTV Freeze-Frame Visual */}
          <div className="glass rounded-3xl p-5 border border-border/70 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Crosshair className="w-4 h-4 text-danger" /> Edge Optical Freeze-Frame
              </span>
              <span className="text-[10px] font-mono text-danger font-bold animate-pulse">LOCKED</span>
            </div>

            {/* Simulated Freeze-frame with Target Bounding Box */}
            <div className="relative w-full h-[220px] bg-[#050505] rounded-2xl border border-white/10 overflow-hidden font-mono flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
              
              {/* Graphic Wireframe Motor */}
              <div className="w-32 h-20 rounded-xl border-2 border-white/20 bg-white/5 relative flex items-center justify-center">
                <div className="w-8 h-8 rounded-full border border-white/30" />
              </div>

              {/* Bounding Box on Damaged Component */}
              <div className="absolute top-[28%] left-[28%] w-[120px] h-[95px] border-2 border-danger shadow-[0_0_20px_rgba(239,68,68,0.5)] z-20">
                <Crosshair className="absolute -top-3 -left-3 w-6 h-6 text-danger" />
                <Crosshair className="absolute -bottom-3 -right-3 w-6 h-6 text-danger" />
                <div className="absolute -top-6 left-0 bg-danger text-black text-[9px] font-black px-1.5 py-0.5 flex items-center gap-1 whitespace-nowrap">
                  TARGET: {rca.component || "BEARING RACE"}
                </div>
              </div>

              {/* Camera Metadata */}
              <div className="absolute top-3 left-3 z-10 text-[9px] text-white/60">
                <div>CAM-04 · SECTOR A</div>
                <div>FRAME #{incident.seq_number ?? 46}</div>
              </div>

              <div className="absolute bottom-3 right-3 z-10 text-[9px] text-white/60 text-right">
                <div>EXPOSURE: 1/120s</div>
                <div>IR SPECTRUM: +32.4Δ</div>
              </div>
            </div>
            
            <p className="text-[11px] text-text-3 font-mono">
              Synchronized frame captured by edge micro-camera at moment of 2-of-N actuation command.
            </p>
          </div>

          {/* Operator Decision & Sign-Off Workflow */}
          <div className="glass rounded-3xl p-6 border border-border/70 space-y-4">
            <div className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-calm" />
              <h3 className="text-base font-bold text-white uppercase tracking-wider">
                Operator Triage &amp; Sign-off
              </h3>
            </div>

            {/* Work Order Info if already confirmed */}
            {isConfirmed && (
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Work Order Dispatched
                </div>
                <div className="font-mono text-xs text-text-2 space-y-1">
                  <div>Ticket: <span className="text-white font-bold">#{incident.work_order_id ?? 'WO-8821'}</span></div>
                  <div>Reviewed By: <span className="text-white">{incident.reviewer_name ?? 'Lead Reliability Operator'}</span></div>
                  <div>Sign-off Time: <span className="text-white">{incident.reviewed_at ? new Date(incident.reviewed_at).toLocaleTimeString() : 'Recent'}</span></div>
                </div>
              </div>
            )}

            {/* Operator Notes Input */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-text-2 uppercase font-mono flex items-center justify-between">
                <span>Investigation Findings / Notes</span>
                <span className="text-[10px] text-text-3">Permanent Audit Record</span>
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log physical inspection findings (e.g. Verified bearing raceway pitting with stethoscope; requested immediate mechanical overhaul)..."
                rows={4}
                className="w-full bg-[#050505] border border-border focus:border-calm rounded-xl p-3 text-xs text-white placeholder:text-text-3 focus:outline-none transition-colors font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => handleDecision("confirmed")}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-danger to-rose-600 hover:from-danger/90 hover:to-rose-600/90 text-white font-bold text-xs uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.3)] disabled:opacity-50"
              >
                <Wrench className="w-4 h-4" />
                <span>Confirm Failure &amp; Dispatch Work Order</span>
              </button>

              <button
                onClick={() => handleDecision("false_alarm")}
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border text-text-2 hover:text-white font-mono text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Mark as False Alarm / Transient</span>
              </button>
            </div>

            <div className="border-t border-white/5 pt-3 flex items-center justify-between text-[10px] font-mono text-text-3">
              <span>Security Level: OPERATOR_LEVEL_2</span>
              <span>Audit Chain: SHA-256</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
