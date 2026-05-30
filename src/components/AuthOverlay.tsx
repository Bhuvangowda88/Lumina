import React, { useState } from 'react';
import { motion } from 'motion/react';
import { auth } from '../lib/firebase';
import { FirebaseError } from 'firebase/app';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { LogIn, Sparkles } from 'lucide-react';

export const AuthOverlay: React.FC = () => {
  const [authError, setAuthError] = useState<string | null>(null);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      setAuthError(null);
      await signInWithPopup(auth, provider);
    } catch (error) {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'your current origin';
      const friendlyMessage = error instanceof FirebaseError && error.code === 'auth/unauthorized-domain'
        ? `Firebase blocked sign-in because ${origin} is not authorized. Add this origin to Firebase Authentication's Authorized Domains and reload the app.`
        : error instanceof Error ? error.message : String(error);

      setAuthError(friendlyMessage);
      console.error('Login failed:', error);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-natural-bg/80 dark:bg-slate-950/80 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card p-12 max-w-md w-full text-center space-y-8 dark:bg-slate-900/90 dark:border-slate-800"
      >
        <div className="w-20 h-20 bg-natural-primary rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-natural-primary/20">
          <Sparkles size={40} className="text-white" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-3xl font-serif italic text-natural-text dark:text-slate-100">Welcome to Lumina</h2>
          <p className="text-sm text-natural-muted dark:text-slate-400 leading-relaxed">
            Sign in to start synthesizing documents and saving your learning history.
          </p>
        </div>

        <button 
          onClick={login}
          className="w-full py-4 bg-natural-primary text-white rounded-full font-bold uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-natural-primary/90 transition-all shadow-xl shadow-natural-primary/20"
        >
          <LogIn size={16} />
          Sign in with Google
        </button>

        {authError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-left text-[11px] text-red-800">
            <strong className="block mb-1 uppercase tracking-[0.2em] text-[10px] text-red-700">Authentication Error</strong>
            <p>{authError}</p>
          </div>
        )}
        
        <p className="text-[10px] text-natural-muted/40 uppercase tracking-widest">
            Privacy focused • Encrypted storage
        </p>
      </motion.div>
    </div>
  );
};
