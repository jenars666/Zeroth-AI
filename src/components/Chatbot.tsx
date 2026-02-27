import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Image as ImageIcon, Search, Loader2, Zap } from 'lucide-react';
import Markdown from 'react-markdown';
import { chatWithGemini, analyzeImage, searchWithGemini, fastResponse } from '../services/chat';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  image?: string;
  isFast?: boolean;
  isSearch?: boolean;
}

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'normal' | 'fast' | 'search'>('normal');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() && mode !== 'normal') return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      isFast: mode === 'fast',
      isSearch: mode === 'search'
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let responseText = '';
      if (mode === 'fast') {
        responseText = await fastResponse(userMessage.content);
      } else if (mode === 'search') {
        responseText = await searchWithGemini(userMessage.content);
      } else {
        responseText = await chatWithGemini(userMessage.content);
      }

      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: responseText,
        isFast: mode === 'fast',
        isSearch: mode === 'search'
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: `Error: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Image = reader.result as string;
      
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: 'Analyze this image',
        image: base64Image
      };
      
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const responseText = await analyzeImage(base64Image.split(',')[1], file.type);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: responseText
        }]);
      } catch (error: any) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'ai',
          content: `Error: ${error.message}`
        }]);
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)] hover:scale-110 transition-transform z-40"
      >
        <MessageSquare className="w-6 h-6 text-black fill-current" />
      </button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.9 }}
            className="fixed bottom-24 right-8 w-96 h-[600px] glass-panel flex flex-col overflow-hidden z-50 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Zeroth Assistant</h2>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-zinc-500 gap-4">
                  <MessageSquare className="w-12 h-12 opacity-20" />
                  <p className="text-xs uppercase tracking-widest font-bold text-center">How can I assist your<br/>development today?</p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl p-4 ${
                    msg.role === 'user' 
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-50' 
                      : 'bg-white/5 border border-white/10 text-zinc-300'
                  }`}>
                    {msg.image && (
                      <img src={msg.image} alt="Upload" className="w-full rounded-lg mb-3 object-cover" />
                    )}
                    <div className="text-sm leading-relaxed prose prose-invert max-w-none prose-p:my-1 prose-pre:bg-black/40 prose-pre:border prose-pre:border-white/10 prose-pre:p-3 prose-pre:rounded-lg">
                      <Markdown>{msg.content}</Markdown>
                    </div>
                    
                    {/* Badges */}
                    {(msg.isFast || msg.isSearch) && (
                      <div className="flex gap-2 mt-3">
                        {msg.isFast && (
                          <span className="text-[8px] font-bold uppercase tracking-widest text-amber-500 flex items-center gap-1">
                            <Zap className="w-3 h-3" /> Fast Mode
                          </span>
                        )}
                        {msg.isSearch && (
                          <span className="text-[8px] font-bold uppercase tracking-widest text-blue-500 flex items-center gap-1">
                            <Search className="w-3 h-3" /> Web Search
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start">
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
                    <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">Processing</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white/[0.02] border-t border-white/5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMode('normal')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                    mode === 'normal' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-500 hover:bg-white/5'
                  }`}
                >
                  Pro
                </button>
                <button
                  onClick={() => setMode('fast')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 ${
                    mode === 'fast' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-500 hover:bg-white/5'
                  }`}
                >
                  <Zap className="w-3 h-3" /> Fast
                </button>
                <button
                  onClick={() => setMode('search')}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors flex items-center gap-1 ${
                    mode === 'search' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-zinc-500 hover:bg-white/5'
                  }`}
                >
                  <Search className="w-3 h-3" /> Search
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 hover:bg-white/5 rounded-xl transition-colors text-zinc-500 hover:text-white shrink-0"
                  title="Upload Image"
                >
                  <ImageIcon className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Ask anything..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 transition-colors"
                />
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="p-3 bg-emerald-500 text-black rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
