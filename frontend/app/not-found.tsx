import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] animate-in fade-in duration-700">
      <div className="glass rounded-3xl p-12 flex flex-col items-center text-center max-w-lg border border-border/50 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-warning to-transparent" />
        
        <div className="w-24 h-24 rounded-full bg-warning/10 flex items-center justify-center mb-6 border border-warning/20">
          <AlertCircle className="w-12 h-12 text-warning" />
        </div>
        
        <h2 className="text-3xl font-black text-white mb-2">Module Offline</h2>
        <p className="text-text-2 mb-8 leading-relaxed">
          The requested command module or interface is not available in the current deployment configuration.
        </p>
        
        <Link 
          href="/" 
          className="flex items-center gap-2 bg-surface-2 hover:bg-surface-3 border border-border text-white px-6 py-3 rounded-xl font-bold transition-all"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Fleet Command
        </Link>
      </div>
    </div>
  );
}
