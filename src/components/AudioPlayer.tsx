import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, Rewind, Square, Volume2, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AudioPlayerProps {
  text: string;
  mode?: 'summarize' | 'audiobook';
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ text, mode = 'summarize' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [activeSectionText, setActiveSectionText] = useState("");
  
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const chunksRef = useRef<string[]>([]);
  const currentChunkIndex = useRef(0);
  const isPlayingRef = useRef(false);
  const [isSoundscapeEnabled, setIsSoundscapeEnabled] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ambientRef = useRef<{ osc: OscillatorNode, gain: GainNode } | null>(null);

  // Initialize Web Audio Context for Soundscape
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioCtxRef.current;
  }, []);

  // Synthetic Sound Effects Generators
  const playSFX = useCallback((type: 'squeak' | 'patter' | 'clink' | 'whoosh' | 'hum') => {
    if (!isSoundscapeEnabled) return;
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    gain.connect(ctx.destination);
    osc.connect(gain);

    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);

    switch (type) {
      case 'squeak': // Zac's friendly squeak
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(1800, now + 0.1);
        gain.gain.linearRampToValueAtTime(0.05, now + 0.05); // 5% volume (safe level)
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      case 'patter': // The ants
        osc.type = 'triangle';
        for (let i = 0; i < 3; i++) {
          const t = now + (i * 0.1);
          osc.frequency.setValueAtTime(400, t);
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.03, t + 0.02);
          gain.gain.linearRampToValueAtTime(0, t + 0.05);
        }
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case 'clink': // The Pan
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2500, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case 'whoosh': // The Fan
        const noise = ctx.createBufferSource();
        const bufferSize = ctx.sampleRate * 0.5;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1000, now);
        noise.connect(filter);
        filter.connect(gain);
        gain.gain.linearRampToValueAtTime(0.04, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        noise.start(now);
        break;
      case 'hum': // Ambient Kitchen hum
        osc.type = 'sine';
        osc.frequency.setValueAtTime(60, now);
        gain.gain.linearRampToValueAtTime(0.02, now + 1);
        osc.start(now);
        return { osc, gain }; // Keep reference to stop it
    }
  }, [isSoundscapeEnabled, getAudioCtx]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    if (!('speechSynthesis' in window)) {
      setIsSupported(false);
      return;
    }
    synthRef.current = window.speechSynthesis;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    const cleanedText = text
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/(\*|_|#|`|\[|\]|\(|\))/g, '') // Remove Markdown
        .replace(/^\s*[\d.+-]+\s+/gm, '') // Remove list markers at start
        .replace(/Step \d+:/gi, '') // Remove phrases like Step 1:
        .trim();

    // Clean voice text for a smooth, simple narration 
    const expressiveText = cleanedText
        .replace(/(\*|_|#|`|\[|\]|\(|\))/g, '') // Scrub any leftover markdown
        .replace(/([.!?])\s+/g, '$1   ') // Natural pauses after sentences
        .replace(/,\s+/g, ',  '); // Slight pause for breath

    chunksRef.current = (expressiveText.match(/[^.!?]+[.!?]+/g) || [expressiveText])
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (chunksRef.current.length === 0 && expressiveText.length > 0) {
      chunksRef.current = [expressiveText.trim()];
    }

    // Auto-restart if text changes while we were potentially interacting
    // or if we want to ensure the new "Big Idea" is heard immediately
    if (isPlayingRef.current) {
      restart();
    }

    return () => {
      synthRef.current?.cancel();
    };
  }, [text]);

  const getBestVoice = useCallback(() => {
    // 1. Filter for English voices first for maximum 5-year-old clarity
    const englishVoices = availableVoices.filter(v => v.lang.startsWith('en-'));
    
    if (englishVoices.length === 0) return availableVoices.find(v => v.default) || availableVoices[0] || null;

    // 2. High-quality human/storyteller names
    const topTierNames = ['samantha', 'google us english', 'natural', 'neural', 'ava', 'zoe', 'junior'];
    const goodNames = ['victoria', 'moira', 'serena', 'karen', 'daniel', 'alex', 'premium', 'enhanced'];

    const sortedVoices = [...englishVoices].sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      // Samantha/Google Neural are top priority
      const aTop = topTierNames.some(n => aName.includes(n)) ? 0 : 1;
      const bTop = topTierNames.some(n => bName.includes(n)) ? 0 : 1;
      if (aTop !== bTop) return aTop - bTop;

      // Prefer en-US for the "Lumina" standard profile
      if (a.lang === 'en-US' && b.lang !== 'en-US') return -1;
      if (a.lang !== 'en-US' && b.lang === 'en-US') return 1;

      // Check others
      const aGood = goodNames.some(n => aName.includes(n)) ? 0 : 1;
      const bGood = goodNames.some(n => bName.includes(n)) ? 0 : 1;
      return aGood - bGood;
    });

    return sortedVoices[0];
  }, [availableVoices]);

  const speakChunk = useCallback((index: number) => {
    if (!synthRef.current || index >= chunksRef.current.length) {
      setIsPlaying(false);
      setProgress(100);
      stopAmbient();
      return;
    }

    const chunk = (chunksRef.current[index] || '').trim();
    if (!chunk) {
      speakChunk(index + 1);
      return;
    }

    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(chunk);
    
    // Explicitly set language to English US
    utterance.lang = 'en-US';

    const voice = getBestVoice();
    if (voice) {
        utterance.voice = voice;
    }
    
    // Warm Storyteller tuning (5-year-old clarity)
    utterance.rate = playbackSpeed * 0.8; // Relaxed but not too slow
    utterance.pitch = 1.1; // Friendly, engaging pitch
    utterance.volume = 1.0; 
    
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const charIndex = event.charIndex;
        const textUpToChar = chunk.substring(0, charIndex);
        const wordCount = textUpToChar.split(/\s+/).length - 1;
        
        const baseWords = chunksRef.current.slice(0, index).join(' ').split(/\s+/).length;
        setCurrentWordIndex(baseWords + wordCount);
      }
    };

    utterance.onstart = () => {
      setActiveSectionText(chunk);
      
      // Trigger Soundscape Cues based on keywords in the chunk
      const textLower = chunk.toLowerCase();
      if (textLower.includes('zac') || textLower.includes('mouse') || textLower.includes('happy')) playSFX('squeak');
      if (textLower.includes('ant') || textLower.includes('run') || textLower.includes('patter')) playSFX('patter');
      if (textLower.includes('pan') || textLower.includes('clink') || textLower.includes('metal')) playSFX('clink');
      if (textLower.includes('fan') || textLower.includes('whoosh') || textLower.includes('wind')) playSFX('whoosh');
    };

    utterance.onend = () => {
      if (currentChunkIndex.current === index) {
        currentChunkIndex.current = index + 1;
        setProgress((currentChunkIndex.current / chunksRef.current.length) * 100);
        
        // Narrative Cadence: Longer deliberate pauses for the story to "breathe"
        const pauseTime = chunk.length > 80 ? 1200 : 800;
        
        setTimeout(() => {
           // Only continue if the component is still in playing state and at the right sequence
           if (isPlayingRef.current && currentChunkIndex.current === index + 1) {
             speakChunk(currentChunkIndex.current);
           }
        }, pauseTime);
      }
    };

    utterance.onerror = (event) => {
      console.error("SpeechSynthesis error:", event);
      if (event.error !== 'interrupted') {
        setIsPlaying(false);
      }
    };

    synthRef.current.speak(utterance);
  }, [playbackSpeed, getBestVoice]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle play with Space (only if not in an input field)
      if (e.code === 'Space' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        togglePlay();
      }
      // Restart with 'r'
      if (e.key.toLowerCase() === 'r' && document.activeElement?.tagName !== 'INPUT') {
        restart();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying]);

  const startAmbient = () => {
    if (!isSoundscapeEnabled || ambientRef.current) return;
    const hum = playSFX('hum');
    if (hum) ambientRef.current = hum as { osc: OscillatorNode, gain: GainNode };
  };

  const stopAmbient = () => {
    if (ambientRef.current) {
      ambientRef.current.gain.gain.linearRampToValueAtTime(0, getAudioCtx().currentTime + 0.5);
      ambientRef.current.osc.stop(getAudioCtx().currentTime + 0.5);
      ambientRef.current = null;
    }
  };

  const togglePlay = () => {
    if (!synthRef.current) return;

    if (isPlaying) {
      synthRef.current.pause();
      setIsPlaying(false);
      stopAmbient();
    } else {
      if (synthRef.current.paused) {
        synthRef.current.resume();
      } else {
        synthRef.current.cancel();
        speakChunk(currentChunkIndex.current);
      }
      setIsPlaying(true);
      startAmbient();
    }
  };

  const stop = () => {
    synthRef.current?.cancel();
    setIsPlaying(false);
    currentChunkIndex.current = 0;
    setCurrentWordIndex(-1);
    setProgress(0);
    stopAmbient();
  };

  const restart = () => {
    stop();
    setTimeout(() => {
        speakChunk(0);
        setIsPlaying(true);
        startAmbient();
    }, 100);
  };

  const cycleSpeed = () => {
    const speeds = [0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    setPlaybackSpeed(newSpeed);
    
    if (isPlaying) {
      currentChunkIndex.current = currentChunkIndex.current;
      synthRef.current?.cancel();
      setTimeout(() => speakChunk(currentChunkIndex.current), 50);
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded-xl text-[10px] uppercase font-bold tracking-widest border border-red-100 italic">
        Neural Voice not available in this environment
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-8 bg-natural-primary text-white rounded-[40px] shadow-2xl shadow-natural-primary/30 relative overflow-hidden group border border-white/10">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[100px] rounded-full translate-x-12 -translate-y-12" />
      
      <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
        <div className="relative">
            <motion.div 
                animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-white/20 rounded-full blur-xl"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause audio synthesis" : "Play audio synthesis"}
              className="relative w-20 h-20 bg-white rounded-full flex items-center justify-center shrink-0 shadow-2xl focus:ring-4 focus:ring-white/20 outline-none"
            >
              {isPlaying ? (
                <Pause size={32} className="text-natural-primary fill-current" aria-hidden="true" />
              ) : (
                <Play size={32} className="text-natural-primary fill-current ml-1" aria-hidden="true" />
              )}
            </motion.button>
        </div>

        <div className="flex-1 w-full min-w-0">
          <div className="flex justify-between items-end mb-4">
            <div aria-live="polite">
              <div className="flex items-center gap-2 mb-1">
                <Volume2 size={12} className="text-white/60" aria-hidden="true" />
                <h4 className="text-[10px] font-black tracking-[0.3em] uppercase opacity-60">Auditory Synthesis</h4>
              </div>
              <p className="text-lg font-serif italic">
                {isPlaying ? "Reading document..." : "Synthesis ready..."} <span className="opacity-40">{playbackSpeed}x</span>
              </p>
            </div>
            
            <div className="flex gap-1" role="group" aria-label="Playback controls">
              <button 
                onClick={() => setIsSoundscapeEnabled(!isSoundscapeEnabled)} 
                aria-label={isSoundscapeEnabled ? "Disable sound effects mode" : "Enable sound effects mode"}
                className={cn(
                  "px-4 h-10 flex items-center gap-2 rounded-full transition-colors border text-[10px] font-bold uppercase tracking-widest focus:ring-2 outline-none",
                  isSoundscapeEnabled ? "bg-white/20 border-white/40 text-white" : "hover:bg-white/10 border-white/10 text-white/40"
                )}
                title="Soundscape Mode"
              >
                <Music size={16} aria-hidden="true" />
                SFX
              </button>
              <button 
                onClick={cycleSpeed} 
                aria-label={`Change playback speed, currently ${playbackSpeed}x`}
                className="px-4 h-10 flex items-center gap-2 hover:bg-white/10 rounded-full transition-colors border border-white/10 text-[10px] font-bold uppercase tracking-widest focus:ring-2 focus:ring-white/20 outline-none"
                title="Playback Speed"
              >
                <FastForward size={16} aria-hidden="true" />
                {playbackSpeed}x
              </button>
              <button 
                onClick={restart} 
                aria-label="Restart audio from beginning"
                className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors focus:ring-2 focus:ring-white/20 outline-none"
                title="Restart"
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
              <button 
                onClick={stop} 
                aria-label="Stop audio"
                className="w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors focus:ring-2 focus:ring-white/20 outline-none"
                title="Stop"
              >
                <Square size={16} className="fill-current" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div 
            className="w-full h-1.5 bg-white/10 rounded-full relative overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Playback progress"
          >
             <motion.div 
               animate={{ width: `${progress}%` }}
               transition={{ duration: 0.5 }}
               className="h-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]"
             />
          </div>
        </div>
      </div>

      {/* Semantic Highlight / Section Display */}
      {mode === 'audiobook' ? (
        <div className="relative min-h-[300px] bg-white dark:bg-slate-900 shadow-inner rounded-[32px] p-10 flex items-center justify-center border border-amber-100/50 dark:border-slate-700">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSectionText}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.02, y: -10 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="w-full text-center"
            >
              <p className="text-2xl md:text-3xl leading-[1.8] text-amber-950 dark:text-amber-500 font-serif italic selection:bg-amber-100 dark:selection:bg-amber-900/50">
                {activeSectionText.split(/\s+/).map((word, i) => (
                  <span 
                    key={i} 
                    className={cn(
                      "transition-all duration-300 mx-1 inline-block",
                      i === currentWordIndex - (chunksRef.current.slice(0, currentChunkIndex.current).join(' ').split(/\s+/).length - 1)
                        ? "text-amber-600 font-bold underline decoration-amber-200 underline-offset-8" 
                        : "opacity-80"
                    )}
                  >
                    {word}
                  </span>
                ))}
              </p>
            </motion.div>
          </AnimatePresence>
          
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
            {chunksRef.current.slice(0, 10).map((_, i) => (
              <div 
                key={i} 
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all duration-500",
                  i === currentChunkIndex.current ? "w-6 bg-amber-500" : "bg-amber-200"
                )}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="relative h-20 bg-black/10 rounded-2xl p-4 overflow-y-auto custom-scrollbar-mini">
          <p className="text-[11px] leading-relaxed text-white/50 font-medium">
              {text.split(/\s+/).slice(0, 1000).map((word, i) => (
                  <span 
                      key={i} 
                      className={cn(
                          "transition-all duration-300 mx-0.5",
                          i === currentWordIndex ? "text-white font-bold bg-white/20 px-1.5 py-0.5 rounded-md shadow-sm scale-110 inline-block" : ""
                      )}
                  >
                      {word}
                  </span>
              ))}
              {text.split(/\s+/).length > 1000 && <span className="ml-1 opacity-20">...</span>}
          </p>
        </div>
      )}

      {/* Dynamic Visualizer Bar */}
      <div className="flex items-end justify-between gap-1 h-8 px-4">
        {[...Array(40)].map((_, i) => (
          <motion.div 
            key={i} 
            animate={{ 
              height: isPlaying ? `${Math.random() * 90 + 10}%` : '4px',
              opacity: isPlaying ? [0.4, 0.8, 0.4] : 0.2
            }}
            transition={{
              duration: 0.4,
              repeat: Infinity,
              repeatType: "reverse",
              delay: i * 0.02
            }}
            className="w-1 bg-white rounded-t-full shadow-[0_0_5px_rgba(255,255,255,0.3)]"
          />
        ))}
      </div>
    </div>
  );
};
