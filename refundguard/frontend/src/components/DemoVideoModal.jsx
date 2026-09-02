import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Zap,
  AlertTriangle,
  ArrowRight,
  ShoppingBag,
  CreditCard,
  RotateCcw as RefundIcon,
  Mic,
  Volume1
} from 'lucide-react';
import { triggerLiveSimulation } from '../api/client';

export default function DemoVideoModal({ isOpen, onClose, onComplete }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [simulationResult, setSimulationResult] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const isSpeakingRef = useRef(false);

  const chapters = [
    {
      num: 1,
      label: '00:00 — Transaction Ingestion',
      title: '1. Order & Payment Ingested',
      detail: 'Order ORD-DEMO-4821 created for ₹30,000. Payment PAY-DEMO-4821 captured via Payment Gateway.',
      narration: 'Step 1. Customer order created for 30,000 Rupees. Payment captured successfully via Payment Gateway.',
    },
    {
      num: 2,
      label: '00:05 — Duplicate Refund Attack',
      title: '2. Duplicate Refund Received',
      detail: 'Refund RFD-DEMO-102 requested 1.8 seconds after RFD-DEMO-101 on payment PAY-DEMO-4821.',
      narration: 'Step 2. Two duplicate refund requests received within 1.8 seconds on payment 4821.',
    },
    {
      num: 3,
      label: '00:10 — Invariant Violated',
      title: '3. Invariant Engine Triggered',
      detail: 'Rule DUPLICATE_REFUND triggered. Total refunded (₹60,000) > Captured (₹30,000).',
      narration: 'Step 3. Deterministic invariant check violated. 60,000 Rupees total refunded exceeds 30,000 Rupees captured.',
    },
    {
      num: 4,
      label: '00:15 — Exposure Calculated',
      title: '4. Exposure Calculation',
      detail: 'Financial exposure calculated: ₹30,000 excess money at risk.',
      narration: 'Step 4. Financial impact engine calculates 30,000 Rupees of excess leakage at risk.',
    },
    {
      num: 5,
      label: '00:20 — AI Investigation',
      title: '5. AI Investigator Analysis',
      detail: 'AI root cause: Duplicate API request via concurrent worker thread without idempotency lock.',
      narration: 'Step 5. AI investigator analyzes proven evidence and deduces duplicate API request via concurrent worker thread.',
    },
    {
      num: 6,
      label: '00:25 — Policy Gate Action',
      title: '6. Bounded Policy Gate',
      detail: 'Action: HUMAN_APPROVAL_REQUIRED (Exposure ≥ ₹25,000 threshold).',
      narration: 'Step 6. Bounded policy gate enforces Human Approval Required and creates ticket for finance ops queue.',
    },
  ];

  const stopVoice = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
  };

  // Speak narration completely from start to end without truncation
  const speakChapterNarration = (index) => {
    if (!('speechSynthesis' in window) || !isVoiceEnabled) return;

    try {
      window.speechSynthesis.cancel(); // cancel any previous utterance cleanly
      const text = chapters[index].narration;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95 * speed; // natural speech pace
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
      };

      // When the entire sentence finishes reading completely:
      utterance.onend = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);

        // Auto-advance to next chapter if video is currently playing
        if (isPlaying) {
          if (index < chapters.length - 1) {
            setTimeout(() => {
              setCurrentChapterIndex(index + 1);
            }, 600);
          } else {
            setIsPlaying(false);
          }
        }
      };

      utterance.onerror = (err) => {
        console.warn('Speech synthesis error:', err);
        isSpeakingRef.current = false;
        setIsSpeaking(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis exception:', e);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setIsPlaying(false);
      setCurrentChapterIndex(0);
      setSimulationResult(null);
      stopVoice();
      return;
    }

    // Auto-start presentation when opened
    setIsPlaying(true);
    setCurrentChapterIndex(0);

    triggerLiveSimulation()
      .then((res) => setSimulationResult(res))
      .catch((err) => console.error('Error triggering live simulation:', err));

    return () => {
      stopVoice();
    };
  }, [isOpen]);

  // When currentChapterIndex changes or play status toggles
  useEffect(() => {
    if (isOpen && isPlaying) {
      if (isVoiceEnabled) {
        speakChapterNarration(currentChapterIndex);
      } else {
        // Fallback timer if voice is muted
        const timer = setTimeout(() => {
          if (currentChapterIndex < chapters.length - 1) {
            setCurrentChapterIndex((prev) => prev + 1);
          } else {
            setIsPlaying(false);
          }
        }, 5000 / speed);
        return () => clearTimeout(timer);
      }
    } else {
      stopVoice();
    }
  }, [currentChapterIndex, isPlaying, isVoiceEnabled, isOpen]);

  if (!isOpen) return null;

  const activeChapter = chapters[currentChapterIndex];
  const progressPercent = Math.min(100, ((currentChapterIndex + 1) / chapters.length) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#0b0e29] border border-[#1d2a68] rounded-3xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
        
        {/* Top Header */}
        <div className="p-4 sm:p-5 bg-[#07091f] border-b border-[#182352] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <Zap className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
                  RefundGuard Interactive Voice Demo
                </h3>
                {isSpeaking && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center space-x-1 animate-pulse">
                    <Mic className="w-3 h-3 text-purple-400 mr-1" />
                    <span>READING FULL SENTENCE...</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">Step-by-step video replay reading complete voice narration</p>
            </div>
          </div>

          <button
            onClick={() => {
              stopVoice();
              onClose();
            }}
            className="p-2 rounded-xl bg-[#141c50] hover:bg-[#1d2a68] text-slate-300 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Video Screen Container */}
        <div className="p-4 sm:p-6 space-y-4">
          
          {/* Main Video Viewport Frame */}
          <div className="relative bg-gradient-to-br from-purple-950 via-indigo-950 to-purple-900 border border-[#182352] rounded-2xl p-6 sm:p-8 min-h-[310px] flex flex-col justify-between overflow-hidden shadow-2xl group text-white">
            
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -left-24 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Video Overlay Watermark & Chapter Pill */}
            <div className="flex items-center justify-between z-10">
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-white/10 text-white border border-white/20 font-mono backdrop-blur-md">
                {activeChapter.label}
              </span>

              <div className="flex items-center space-x-3 text-xs font-mono text-purple-200">
                {isSpeaking && (
                  <span className="flex items-center space-x-1 text-emerald-300 font-bold animate-pulse">
                    <Volume1 className="w-4 h-4 mr-0.5" />
                    <span>AI VOICE SPEAKING...</span>
                  </span>
                )}
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping"></span>
                <span>STEP {currentChapterIndex + 1} OF 6</span>
              </div>
            </div>

            {/* Animated Transaction Topology Node Flow */}
            <div className="my-6 z-10 grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
              
              {/* Node 1: Order */}
              <div className={`p-3 rounded-xl border transition-all duration-500 ${currentChapterIndex >= 0 ? 'bg-blue-950/60 border-blue-400/50 text-blue-200 shadow-lg' : 'bg-slate-900/40 border-slate-800 opacity-40'}`}>
                <div className="flex items-center space-x-2">
                  <ShoppingBag className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-xs font-bold">ORD-DEMO-4821</span>
                </div>
                <div className="text-[10px] text-slate-300 mt-1">₹30,000 Created</div>
              </div>

              {/* Node 2: Payment */}
              <div className={`p-3 rounded-xl border transition-all duration-500 ${currentChapterIndex >= 1 ? 'bg-cyan-950/60 border-cyan-400/50 text-cyan-200 shadow-lg' : 'bg-slate-900/40 border-slate-800 opacity-40'}`}>
                <div className="flex items-center space-x-2">
                  <CreditCard className="w-4 h-4 text-cyan-400" />
                  <span className="font-mono text-xs font-bold">PAY-DEMO-4821</span>
                </div>
                <div className="text-[10px] text-slate-300 mt-1">₹30,000 Captured</div>
              </div>

              {/* Node 3: Refunds */}
              <div className={`p-3 rounded-xl border transition-all duration-500 ${currentChapterIndex >= 2 ? 'bg-purple-950/60 border-purple-400/50 text-purple-200 shadow-lg' : 'bg-slate-900/40 border-slate-800 opacity-40'}`}>
                <div className="flex items-center space-x-2">
                  <RefundIcon className="w-4 h-4 text-purple-300" />
                  <span className="font-mono text-xs font-bold">RFD-101 & RFD-102</span>
                </div>
                <div className="text-[10px] text-slate-300 mt-1">2 Requests (1.8s apart)</div>
              </div>

              {/* Node 4: Violation */}
              <div className={`p-3 rounded-xl border transition-all duration-500 ${currentChapterIndex >= 3 ? 'bg-rose-950/80 border-rose-400/60 text-rose-200 ring-2 ring-rose-400/40 shadow-xl' : 'bg-slate-900/40 border-slate-800 opacity-40'}`}>
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span className="font-bold text-xs">DUPLICATE_REFUND</span>
                </div>
                <div className="text-[10px] text-rose-300 font-bold mt-1">₹30,000 Excess Exposure</div>
              </div>

            </div>

            {/* Video Frame Text Content & Spoken Narration Subtitle */}
            <div className="z-10 space-y-2">
              <h4 className="text-xl font-black text-white tracking-tight">
                {activeChapter.title}
              </h4>
              <p className="text-xs sm:text-sm text-purple-100 leading-relaxed max-w-2xl font-medium">
                {activeChapter.detail}
              </p>
              
              {/* Spoken Narration Subtitle Banner */}
              <div className="p-3.5 rounded-xl bg-white/10 border border-white/20 text-xs text-purple-100 font-sans backdrop-blur-md flex items-start space-x-2 shadow-md">
                <Mic className="w-4 h-4 text-purple-300 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono font-bold text-purple-300 uppercase block">Full Voice Narration:</span>
                  <span className="font-semibold text-white">"{activeChapter.narration}"</span>
                </div>
              </div>
            </div>

            {/* Interactive Video Controls Bar */}
            <div className="mt-6 pt-4 border-t border-white/20 space-y-3 z-10">
              
              {/* Progress Scrubber */}
              <div className="relative w-full bg-white/20 h-2.5 rounded-full overflow-hidden">
                <div
                  style={{ width: `${progressPercent}%` }}
                  className="bg-gradient-to-r from-emerald-400 via-purple-400 to-indigo-400 h-full transition-all duration-300"
                ></div>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between text-xs text-purple-200 font-mono">
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => {
                      if (isPlaying) {
                        setIsPlaying(false);
                        stopVoice();
                      } else {
                        setIsPlaying(true);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-white text-purple-950 font-black shadow-lg transition"
                  >
                    {isPlaying ? <Pause className="w-4 h-4 text-purple-950" /> : <Play className="w-4 h-4 text-purple-950 fill-current" />}
                  </button>

                  <button
                    onClick={() => {
                      stopVoice();
                      setCurrentChapterIndex(0);
                      setIsPlaying(true);
                    }}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
                    title="Restart Video Replay"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <span className="font-bold">Step {currentChapterIndex + 1} of 6</span>
                </div>

                {/* Voice Toggle & Speed Controls */}
                <div className="flex items-center space-x-3">
                  
                  {/* AI Voice Narration Toggle */}
                  <button
                    onClick={() => {
                      const next = !isVoiceEnabled;
                      setIsVoiceEnabled(next);
                      if (!next) {
                        stopVoice();
                      } else if (isPlaying) {
                        speakChapterNarration(currentChapterIndex);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold font-sans flex items-center space-x-1.5 transition ${
                      isVoiceEnabled
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/40 border border-purple-400'
                        : 'bg-white/10 text-purple-300 border border-white/20'
                    }`}
                    title="Toggle Full Voice Narration"
                  >
                    {isVoiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-white" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                    <span>{isVoiceEnabled ? 'Voice: ON' : 'Voice: OFF'}</span>
                  </button>

                  <div className="flex items-center space-x-1 bg-white/10 p-1 rounded-xl border border-white/20">
                    {[1, 1.25, 1.5].map((s) => (
                      <button
                        key={s}
                        onClick={() => setSpeed(s)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          speed === s ? 'bg-white text-purple-950' : 'text-purple-300 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>

                </div>

              </div>

            </div>

          </div>

          {/* Interactive Chapter Selector Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {chapters.map((ch, idx) => {
              const isActive = currentChapterIndex === idx;
              return (
                <button
                  key={ch.num}
                  onClick={() => {
                    stopVoice();
                    setCurrentChapterIndex(idx);
                    setIsPlaying(true);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition ${
                    isActive
                      ? 'bg-purple-900 border-purple-400 text-white shadow-lg ring-2 ring-purple-400'
                      : 'bg-[#07091f] border-[#182352] text-slate-400 hover:bg-[#141c50]'
                  }`}
                >
                  <div className="text-[10px] font-mono font-bold text-purple-300">Step {ch.num}</div>
                  <div className="text-[11px] font-bold truncate mt-0.5">{ch.title}</div>
                </button>
              );
            })}
          </div>

        </div>

        {/* Footer Bar */}
        <div className="p-4 bg-[#07091f] border-t border-[#182352] flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">
            {!isPlaying ? 'Playback paused or finished.' : 'Reading full sentence voice narration...'}
          </span>

          <button
            onClick={() => {
              stopVoice();
              onClose();
              if (simulationResult?.incident?.id) {
                onComplete(simulationResult.incident.id);
              }
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-800 hover:to-indigo-700 text-white font-extrabold text-xs shadow-lg shadow-purple-600/30 transition flex items-center space-x-2"
          >
            <span>Open Generated Incident Proof</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
