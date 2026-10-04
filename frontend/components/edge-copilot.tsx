"use client";
import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Cpu, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { TelemetryRow } from "@/lib/api-client";

export function EdgeCopilot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user'|'assistant', content: string}[]>([
    { role: 'assistant', content: 'Edge Copilot online. I am connected directly to the live telemetry stream. How can I assist you with Asset 01-A?' }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput("");
    setIsTyping(true);

    // Simulate AI thinking and querying local database
    setTimeout(async () => {
      let response = "I'm monitoring the stream, but I couldn't understand that query.";
      const lower = userMsg.toLowerCase();

      try {
        if (lower.includes("anomaly") || lower.includes("score") || lower.includes("status")) {
          const res = await fetch("/api/telemetry?mode=latest");
          const json = await res.json();
          if (json.data) {
            response = `The current fused anomaly score is **${json.data.fused_score.toFixed(3)}**. ` + 
                       (json.data.fused_score > 0.85 ? "The system is currently in ACTUATION lockdown." : "The system is operating within normal parameters.");
          }
        } 
        else if (lower.includes("temperature") || lower.includes("hot")) {
          const res = await fetch("/api/telemetry?mode=latest");
          const json = await res.json();
          if (json.data) {
            response = `Ambient temperature is currently **${json.data.env_temp}°C**.`;
            if (json.data.env_temp > 30) response += " This is abnormally high. Recommend checking for overheating.";
          }
        }
        else if (lower.includes("inject") || lower.includes("trigger") || lower.includes("simulate")) {
          let scenario = null;
          if (lower.includes("bearing")) scenario = "bearing_failure";
          else if (lower.includes("heat") || lower.includes("overheating")) scenario = "overheating";
          else if (lower.includes("fire") || lower.includes("gas")) scenario = "fire";

          if (scenario) {
            await fetch("/api/control", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ scenario })
            });
            response = `I have injected the **${scenario}** scenario into the Edge Simulator. You should see the charts react immediately.`;
          } else {
            response = "I can inject anomalies. Try asking me to 'trigger a bearing failure' or 'simulate overheating'.";
          }
        }
        else if (lower.includes("stop") || lower.includes("abort") || lower.includes("reset")) {
          await fetch("/api/control", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenario: null })
          });
          response = "Injection aborted. The simulator has been reset to baseline noise.";
        }
        else {
          response = "I am an Edge Copilot. I can report on live metrics (anomaly scores, temperature) or inject failure scenarios for testing. What would you like to do?";
        }
      } catch (err) {
        response = "Error querying the local telemetry database.";
      }

      setIsTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    }, 1500);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-[380px] h-[500px] glass rounded-3xl border border-border shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden"
          >
            <div className="bg-surface-2 border-b border-border p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-calm/20 p-2 rounded-full relative">
                  <Cpu className="w-5 h-5 text-calm" />
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-calm animate-ping" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-sm">Edge Copilot</h3>
                  <p className="text-xs text-text-2">Connected to Local DB</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-text-2 hover:text-white transition-colors">
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-calm text-black font-medium rounded-br-sm' 
                      : 'bg-surface-3 border border-border text-text rounded-bl-sm'
                  }`}>
                    {msg.content.includes("**") ? (
                      <span dangerouslySetInnerHTML={{ __html: msg.content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>') }} />
                    ) : msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-surface-3 border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5">
                    <motion.div animate={{ y: [0,-3,0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} className="w-2 h-2 rounded-full bg-text-3" />
                    <motion.div animate={{ y: [0,-3,0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 rounded-full bg-text-3" />
                    <motion.div animate={{ y: [0,-3,0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 rounded-full bg-text-3" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-surface border-t border-border">
              <div className="relative">
                <input 
                  type="text" 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask about live data or trigger anomalies..."
                  className="w-full bg-surface-2 border border-border rounded-full py-3 pl-4 pr-12 text-sm text-text focus:outline-none focus:border-calm/50 transition-colors placeholder:text-text-3"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className="absolute right-2 top-2 p-1.5 bg-calm text-black rounded-full hover:bg-calm/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-calm rounded-full flex items-center justify-center text-black shadow-[0_0_20px_rgba(6,182,212,0.4)] hover:scale-105 transition-transform"
      >
        {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
      </button>
    </div>
  );
}
