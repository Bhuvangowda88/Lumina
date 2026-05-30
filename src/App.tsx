import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Sparkles, 
  Plus, 
  Send, 
  History, 
  Menu, 
  X, 
  BookOpen, 
  ChevronRight, 
  Loader2, 
  Trash2,
  LogOut,
  Type,
  Maximize2,
  Sun,
  Moon
} from 'lucide-react';
import Markdown from 'react-markdown';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { AuthOverlay } from './components/AuthOverlay';
import { AnimatedBackground } from './components/AnimatedBackground';
import { FileDropzone } from './components/FileDropzone';
import { AudioPlayer } from './components/AudioPlayer';
import { extractTextFromFile } from './services/pdf';
import { processDocument, chatWithDocument, SummaryDetail } from './services/gemini';
import { 
  createChat, 
  addMessage, 
  subscribeToChats, 
  subscribeToMessages, 
  Chat, 
  Message,
  deleteChat 
} from './services/history';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReProcessing, setIsReProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [processingMode, setProcessingMode] = useState<'summarize' | 'audiobook'>('summarize');
  const [summaryDetail, setSummaryDetail] = useState<SummaryDetail>('standard');
  const [showDocSettings, setShowDocSettings] = useState(false);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToChats(user.uid, setChats);
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!currentChatId) return;
    const unsubscribe = subscribeToMessages(currentChatId, setMessages);
    return () => unsubscribe();
  }, [currentChatId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Automatic Re-Synthesis when depth changes
  useEffect(() => {
    const handleDepthChange = async () => {
      if (!currentChatId || !user || isProcessing || isReProcessing) return;
      
      // Find the last document context
      const lastDocMessage = [...messages].reverse().find(m => m.type === 'document-analysis' && (m.metadata?.context || m.metadata?.imageData));
      if (!lastDocMessage || (!lastDocMessage.metadata?.context && !lastDocMessage.metadata?.imageData)) return;
      if (lastDocMessage.metadata.detail === summaryDetail && lastDocMessage.metadata.mode === processingMode) return;

      setIsReProcessing(true);
      try {
        const text = lastDocMessage.metadata.context || "";
        const imageData = lastDocMessage.metadata.imageData;
        const processedContent = await processDocument(text, processingMode, summaryDetail, imageData);
        
        await addMessage(currentChatId, 'assistant', processedContent, 'document-analysis', { 
          context: text, 
          imageData: imageData,
          mode: processingMode, 
          detail: summaryDetail,
          isUpdate: true 
        });
      } catch (err) {
        console.error("Re-synthesis failed:", err);
      } finally {
        setIsReProcessing(false);
      }
    };

    handleDepthChange();
  }, [summaryDetail, processingMode]);

  const handleSignOut = () => signOut(auth);

  const startNewChat = async () => {
    if (!user) return;
    const id = await createChat(user.uid, "New Synthesis Session");
    setCurrentChatId(id);
    setSidebarOpen(false);
    setInput('');
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!user) return;
    
    let activeChatId = currentChatId;
    if (!activeChatId) {
      activeChatId = await createChat(user.uid, `Analysis: ${file.name}`);
      setCurrentChatId(activeChatId);
    }

    try {
      setIsProcessing(true);
      setError(null);
      
      const isImage = file.type.startsWith('image/');
      let text = "";
      let imageData: { mimeType: string, data: string } | undefined;

      if (isImage) {
        // Handle Image
        const base64 = await fileToBase64(file);
        imageData = {
          mimeType: file.type,
          data: base64.split(',')[1] // Remove data:image/png;base64,
        };
      } else {
        // Handle Document
        text = await extractTextFromFile(file);
        if (!text || text.length < 10) throw new Error("Document too sparse for analysis.");
      }

      // 2. Add user message
      await addMessage(activeChatId, 'user', `I uploaded a ${isImage ? 'picture' : 'document'}: **${file.name}**`, 'document-analysis', { fileName: file.name });

      // 3. Process with Gemini
      let processedContent = await processDocument(text, processingMode, summaryDetail, imageData);
      
      // 4. Add assistant response
      await addMessage(activeChatId, 'assistant', processedContent, 'document-analysis', { 
        context: text, 
        mode: processingMode, 
        detail: summaryDetail,
        imageData: imageData // Store reference if needed (though not currently used in re-synth)
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed.');
    } finally {
      setIsProcessing(false);
      setShowDocSettings(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const sendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !user || !currentChatId || isProcessing) return;

    const messageContent = input.trim();
    const currentMessages = [...messages]; // Capture history BEFORE adding new message
    setInput('');
    setIsProcessing(true);

    try {
      // Find document context or image data if available in previous messages
      const lastDocMessage = [...currentMessages]
        .reverse()
        .find(m => m.type === 'document-analysis' && (m.metadata?.context || m.metadata?.imageData));
      
      const context = lastDocMessage?.metadata?.context;
      const imageData = lastDocMessage?.metadata?.imageData;

      await addMessage(currentChatId, 'user', messageContent);

      const historyForGemini = currentMessages.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await chatWithDocument(historyForGemini, messageContent, context, imageData);
      await addMessage(currentChatId, 'assistant', response);
    } catch (err) {
      setError("AI failed to respond.");
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-natural-bg flex items-center justify-center">
        <Loader2 className="animate-spin text-natural-primary" size={40} />
      </div>
    );
  }

  if (!user) return <AuthOverlay />;

  return (
    <div className={cn(
      "min-h-screen font-sans text-natural-text selection:bg-natural-primary/10 flex overflow-hidden transition-colors duration-1000 dark:text-slate-200",
      processingMode === 'audiobook' ? "bg-[#fdf8f3] dark:bg-slate-900" : "bg-natural-bg dark:bg-slate-950"
    )}>
      <AnimatedBackground />

      {/* Sidebar / History Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-natural-text/40 backdrop-blur-md z-[45]"
            />
            <motion.aside 
              role="navigation"
              aria-label="Synthesis history and user settings"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-slate-900 shadow-2xl border-r border-natural-border dark:border-slate-800 flex flex-col p-8"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-xl transition-colors duration-500",
                    processingMode === 'audiobook' ? "bg-amber-600 shadow-amber-600/20" : "bg-natural-primary shadow-natural-primary/20"
                  )}>
                    <BookOpen size={20} aria-hidden="true" />
                  </div>
                  <h1 className="text-2xl font-bold font-serif italic text-natural-text dark:text-slate-100 transition-colors">
                    Lumina Summarizer
                  </h1>
                </div>
                <button 
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Close archive sidebar"
                  className="p-3 hover:bg-natural-secondary dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <button 
                onClick={startNewChat}
                aria-label="Start a new synthesis session"
                className={cn(
                  "w-full py-4 mb-8 text-white rounded-2xl font-bold uppercase text-[10px] tracking-[0.2em] flex items-center justify-center gap-2 hover:translate-y-[-2px] transition-all shadow-xl",
                  processingMode === 'audiobook' ? "bg-amber-700 shadow-amber-700/20" : "bg-natural-primary shadow-natural-primary/20"
                )}
              >
                <Plus size={16} aria-hidden="true" />
                New Conversation
              </button>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-natural-muted mb-6 opacity-40">Previous Syntheses</h3>
                {chats.length === 0 && (
                    <div className="py-20 text-center space-y-4">
                        <History size={32} className="mx-auto text-natural-muted/20" aria-hidden="true" />
                        <p className="text-[10px] uppercase font-bold text-natural-muted/40 tracking-widest leading-relaxed">No history found.<br/>Start a session to begin.</p>
                    </div>
                )}
                {chats.map(chat => (
                  <motion.div 
                    layout
                    key={chat.id}
                    role="button"
                    aria-label={`Open session: ${chat.title || 'Untitled Session'}`}
                    onClick={() => { setCurrentChatId(chat.id); setSidebarOpen(false); }}
                    className={cn(
                      "group flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border",
                      currentChatId === chat.id 
                        ? "bg-natural-primary/5 border-natural-primary/20 text-natural-primary dark:text-natural-primary" 
                        : "border-transparent hover:bg-natural-secondary dark:hover:bg-slate-800 text-natural-muted dark:text-slate-400"
                    )}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm border border-natural-border dark:border-slate-700">
                        <FileText size={14} className={currentChatId === chat.id ? "text-natural-primary" : "text-natural-muted"} aria-hidden="true" />
                      </div>
                      <span className="text-xs font-bold truncate tracking-tight">{chat.title || 'Untitled Session'}</span>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); deleteChat(chat.id); if(currentChatId === chat.id) setCurrentChatId(null); }}
                        aria-label={`Delete session: ${chat.title || 'Untitled Session'}`}
                        className="opacity-0 group-hover:opacity-100 p-2 hover:text-red-500 transition-opacity"
                    >
                        <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 pt-8 border-t border-natural-border dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={user.photoURL || ''} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-md" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-black text-natural-text dark:text-slate-200 truncate max-w-[120px] uppercase tracking-wider">{user.displayName}</span>
                    <span className="text-[9px] font-bold text-natural-muted uppercase tracking-tighter opacity-60">Verified Learner</span>
                  </div>
                </div>
                <button 
                  onClick={handleSignOut} 
                  aria-label="Sign out"
                  className="p-3 bg-natural-secondary dark:bg-slate-800 text-natural-muted dark:text-slate-400 hover:text-red-500 rounded-full transition-all"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-screen relative">
        {/* Universal Header Toggle */}
        <header className={cn(
          "p-4 md:p-6 flex flex-col md:flex-row items-center gap-4 justify-between border-b sticky top-0 z-40 transition-all duration-500",
          processingMode === 'audiobook' ? "bg-white/60 dark:bg-slate-900/60 border-amber-100 dark:border-slate-800" : "bg-white/40 dark:bg-slate-950/40 border-natural-border/50 dark:border-slate-800/50"
        )}>
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <button 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open archives and history"
              className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-slate-800 border border-natural-border dark:border-slate-700 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-natural-text dark:text-slate-200 hover:bg-natural-secondary dark:hover:bg-slate-700 transition-all shadow-sm group"
            >
              <Menu size={16} className="group-hover:rotate-90 transition-transform" aria-hidden="true" />
              Archives
            </button>

            <div 
              role="group"
              aria-label="Processing mode selection"
              className={cn(
                "flex items-center p-1 rounded-full border transition-all duration-500",
                processingMode === 'audiobook' ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/50" : "bg-natural-secondary/50 dark:bg-slate-800/50 border-natural-border dark:border-slate-700"
              )}
            >
              {(['summarize', 'audiobook'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setProcessingMode(m)}
                  aria-pressed={processingMode === m}
                  aria-label={`Switch to ${m} mode`}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.25em] transition-all",
                    processingMode === m 
                      ? (m === 'audiobook' ? "bg-amber-600 text-white shadow-lg" : "bg-natural-primary text-white shadow-lg") 
                      : "text-natural-muted hover:text-natural-text"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <h1 className={cn(
               "text-sm font-bold font-serif italic transition-colors duration-500",
               processingMode === 'audiobook' ? "text-amber-900 dark:text-amber-500" : "text-natural-text dark:text-slate-100"
            )}>
              Lumina AI
            </h1>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {processingMode === 'summarize' && (
              <div className={cn(
                "flex items-center gap-2 px-3 py-1 rounded-full border transition-all backdrop-blur-sm",
                isReProcessing ? "bg-natural-primary/20 border-natural-primary/40 animate-pulse" : "bg-white/20 border-white/10"
              )}>
                <span className="text-[8px] font-black uppercase tracking-tighter text-natural-muted/60 dark:text-slate-400" id="detail-label">
                  {isReProcessing ? 'Re-thinking...' : 'Depth:'}
                </span>
                <select 
                  value={summaryDetail}
                  onChange={(e) => setSummaryDetail(e.target.value as any)}
                  aria-labelledby="detail-label"
                  disabled={isReProcessing}
                  className="bg-transparent border-none text-[9px] font-black uppercase tracking-widest text-natural-primary dark:text-natural-primary cursor-pointer outline-none hover:text-natural-text dark:hover:text-slate-200 transition-colors disabled:opacity-50"
                >
                  <option value="concise">Concise</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>
              </div>
            )}
            
            <button 
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label="Toggle dark mode"
              className="p-2.5 rounded-full border border-natural-border dark:border-slate-700 bg-white dark:bg-slate-800 text-natural-text dark:text-slate-200 hover:bg-natural-secondary dark:hover:bg-slate-700 transition-all shadow-sm"
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
            
            <button 
              onClick={startNewChat}
              aria-label="Create a new synthesis session"
              className="px-6 py-2.5 bg-natural-primary text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] shadow-lg shadow-natural-primary/20 hover:scale-105 transition-all active:scale-95"
            >
              New Session
            </button>
          </div>
        </header>

        {/* Removed Floating Settings Trigger */}

        {/* Message History */}
        <div 
          role="log"
          aria-label="Message history"
          aria-live="polite"
          className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar"
        >
          <div className="max-w-4xl mx-auto space-y-12">
            {!currentChatId && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-10"
              >
                <div className="w-24 h-24 bg-natural-primary/5 rounded-full flex items-center justify-center text-natural-primary">
                    <Sparkles size={48} className="animate-pulse" aria-hidden="true" />
                </div>
                <div className="space-y-4">
                  <motion.h2 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-5xl md:text-7xl font-serif font-light text-natural-text dark:text-slate-100 leading-tight"
                  >
                    What shall we <i className="italic">synthesize</i> today?
                  </motion.h2>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-lg text-natural-muted dark:text-slate-400 max-w-lg mx-auto leading-relaxed font-medium"
                  >
                    Upload a lecture PDF or research text to instantly extract semantic patterns or generate a verbatim audiobook.
                  </motion.p>
                </div>
                
                <div className="w-full max-w-xl space-y-6">
                  <FileDropzone onFileSelect={handleFileSelect} isLoading={isProcessing} error={error} />
                  <div className="flex items-center justify-center gap-4">
                    <div className="h-px bg-natural-border/30 dark:bg-slate-800/50 flex-1" />
                    <span className="text-[10px] font-black text-natural-muted/40 uppercase tracking-widest">or</span>
                    <div className="h-px bg-natural-border/30 dark:bg-slate-800/50 flex-1" />
                  </div>
                  <button 
                    onClick={startNewChat}
                    aria-label="Start a text-only chat session"
                    className="w-full py-4 rounded-2xl bg-white dark:bg-slate-800 border border-natural-border dark:border-slate-700 text-natural-text dark:text-slate-200 text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-natural-secondary dark:hover:bg-slate-700 transition-all"
                  >
                    Start text-only session
                  </button>
                </div>
              </motion.div>
            )}

            {messages.map((message) => (
              <motion.div 
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex flex-col gap-4",
                  message.role === 'user' ? "items-end" : "items-start"
                )}
                aria-label={`${message.role === 'user' ? 'Your' : 'Lumina AI'} message`}
              >
                <div className={cn(
                  "max-w-[85%] p-6 rounded-[32px] shadow-sm relative",
                  message.role === 'user' 
                    ? "bg-natural-primary text-white rounded-tr-none"
                    : "bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-natural-border dark:border-slate-700 text-natural-text dark:text-slate-200 rounded-tl-none"
                )}>
                  <div className="markdown-body">
                    <Markdown>{message.content}</Markdown>
                  </div>

                  {message.role === 'assistant' && (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mt-8"
                    >
                        <AudioPlayer 
                          mode={message.metadata?.mode || 'summarize'}
                          text={
                            message.metadata?.mode === 'audiobook' 
                              ? (message.metadata.context || message.content) 
                              : message.content.replace(/[#*`]/g, '')
                          } 
                        />
                    </motion.div>
                  )}
                  
                  <span className="absolute -bottom-6 text-[8px] font-bold uppercase tracking-widest text-natural-muted/50">
                    {message.role === 'user' ? 'Me' : 'Lumina Engine'} • {new Date(message.createdAt?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            ))}
            
            {isProcessing && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-3 text-natural-primary py-4"
              >
                <Loader2 className="animate-spin" size={18} />
                <span className="text-[10px] font-bold uppercase tracking-[0.3em]">Processing Logic...</span>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Bar */}
        {currentChatId && (
            <div className="p-4 md:p-12 bg-gradient-to-t from-natural-bg dark:from-slate-950 via-natural-bg/90 dark:via-slate-950/90 to-transparent">
                <form 
                    onSubmit={sendMessage}
                    className="max-w-4xl mx-auto relative group"
                >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                        e.target.value = '';
                      }}
                    />
                    <div className="absolute -inset-1 bg-natural-primary/5 rounded-[40px] blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                    <div className="relative flex items-center bg-white dark:bg-slate-900 border border-natural-border dark:border-slate-800 rounded-[40px] p-2 shadow-2xl shadow-natural-primary/5">
                        <div className="p-4 flex items-center gap-3">
                            <button 
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                aria-label="Upload document to analyze"
                                className="w-10 h-10 rounded-full bg-natural-secondary dark:bg-slate-800 flex items-center justify-center text-natural-primary hover:bg-natural-primary hover:text-white transition-all shadow-inner"
                                title="Upload Document"
                            >
                                <Plus size={20} aria-hidden="true" />
                            </button>
                        </div>
                        
                        <input 
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            aria-label="Chat input"
                            placeholder="Interrogate the document or ask a study question..."
                            className="flex-1 bg-transparent border-none outline-none text-sm font-medium p-4 placeholder:text-natural-muted/40 dark:text-slate-400 dark:text-slate-200"
                            disabled={isProcessing}
                        />

                        <button 
                            type="submit"
                            aria-label="Send message"
                            disabled={!input.trim() || isProcessing}
                            className="w-14 h-14 rounded-[32px] bg-natural-primary flex items-center justify-center text-white disabled:opacity-30 disabled:grayscale transition-all hover:scale-105 active:scale-95 shadow-xl shadow-natural-primary/20 mr-2"
                        >
                            <Send size={20} aria-hidden="true" />
                        </button>
                    </div>
                    
                    <div className="mt-4 flex justify-center gap-8 px-6 text-[8px] font-bold uppercase tracking-[0.2em] text-natural-muted/40">
                        <span className="flex items-center gap-2"><Sparkles size={10} /> Powered by Gemini Flash</span>
                        <span className="flex items-center gap-2"><Type size={10} /> Markdown Supported</span>
                        <span className="flex items-center gap-2"><History size={10} /> Syncing to Cloud</span>
                    </div>
                </form>
            </div>
        )}
      </main>
    </div>
  );
}
