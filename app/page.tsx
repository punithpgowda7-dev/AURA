"use client";
import { useState, useRef, useEffect } from "react";
import { Menu, Sun, Moon, Plus, ArrowUp, Check, Sparkles, X, MessageSquare, Square, SquarePen, User, Mail, Key, Lock, Rocket, BarChart3, LogOut, Trash2 } from "lucide-react";

// --- FIREBASE CLOUD DATABASE SETUP ---
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

// Your web app's Firebase configuration (Secured via Environment Variables)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY as string,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN as string,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID as string,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID as string
};

// Initialize Firebase securely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

const AVAILABLE_MODELS = ["Perplexity", "Gemini", "Grok", "ChatGPT", "Claude", "DeepSeek"];

const MODEL_VERSIONS: Record<string, string> = {
  "Perplexity": "sonar-pro",
  "Gemini": "gemini-2.5-flash",
  "Grok": "grok-2-beta",
  "ChatGPT": "gpt-4o",
  "Claude": "claude-3.5-sonnet",
  "DeepSeek": "deepseek-chat"
};

const BENCHMARK_DATA: Record<string, number[]> = {
  "ChatGPT": [88.7, 53.6, 95.6, 76.6, 90.5, 90.2, 83.4, 88.0, 85.0, 96.7],
  "Claude": [88.3, 59.4, 96.4, 71.1, 91.6, 92.0, 83.1, 89.0, 85.2, 96.1],
  "Gemini": [78.9, 41.0, 88.0, 52.0, 80.0, 75.0, 78.0, 75.0, 80.0, 88.0],
  "DeepSeek": [88.5, 59.1, 95.8, 90.2, 91.0, 89.0, 85.0, 88.0, 86.0, 96.0],
  "Perplexity": [73.0, 34.0, 84.5, 50.0, 68.0, 72.0, 70.0, 65.0, 78.0, 83.0],
  "Grok": [73.0, 34.0, 84.5, 50.0, 68.0, 72.0, 70.0, 65.0, 78.0, 83.0],
};

const CRITERIA = [
  "1. Undergraduate level knowledge", "2. Graduate level reasoning", "3. Grade school math",
  "4. Maths problem solving", "5. Multilingual math", "6. Code generation",
  "7. Reasoning over text", "8. Mixed evaluation", "9. Knowledge Q&A", "10. Common Knowledge"
];

// NEW DATA STRUCTURE: Supports multiple messages (turns) per chat
type Turn = {
  prompt: string;
  results: Record<string, string>;
  bestModel: string | null;
};

type ChatSession = {
  id: string;
  title: string; 
  models: string[];
  turns: Turn[]; 
  contextString: string; 
  // Legacy fields so old Firebase data doesn't crash
  prompt?: string;
  results?: Record<string, string>;
  bestModel?: string | null;
};

export default function Home() {
  // --- HYDRATION FIX: Prevents Browser Extensions from crashing Next.js ---
  const [isMounted, setIsMounted] = useState(false);

  const [isDark, setIsDark] = useState(true);

  // --- AUTHENTICATION STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authStep, setAuthStep] = useState(1); 
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [isLaunching, setIsLaunching] = useState(false);

  // --- DASHBOARD STATE ---
  const [showHistory, setShowHistory] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showReport, setShowReport] = useState(false); 
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [prompt, setPrompt] = useState("");
  const [activeTurns, setActiveTurns] = useState<Turn[]>([]); 
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [hasProceeded, setHasProceeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- MOUNT EFFECT (Hydration fix part 2) ---
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const timer = setTimeout(() => {
      const containers = document.querySelectorAll('.chat-scroll-container');
      containers.forEach(c => c.scrollTop = c.scrollHeight);
    }, 100);
    return () => clearTimeout(timer);
  }, [activeTurns]);

  // --- CLOUD DATABASE FUNCTIONS (TypeScript Safe) ---
  const saveToCloud = async (email: string, history: ChatSession[]) => {
    if (!email || !firebaseConfig.apiKey) return; 
    try {
      await setDoc(doc(db, "users", email), { chats: history });
    } catch (e) { console.error("Cloud save failed", e); }
  };

  const loadFromCloud = async (email: string) => {
    if (!email || !firebaseConfig.apiKey) return;
    try {
      const docSnap = await getDoc(doc(db, "users", email));
      if (docSnap.exists()) {
        setChatHistory(docSnap.data().chats || []);
      }
    } catch (e) { console.error("Cloud load failed", e); }
  };

  // --- PERSISTENT LOGIN ---
  useEffect(() => {
    const savedEmail = localStorage.getItem("aura_user_email");
    const savedName = localStorage.getItem("aura_user_name");
    if (savedEmail) {
      setUserEmail(savedEmail);
      setUserName(savedName || "User");
      setIsAuthenticated(true);
      setAuthStep(3);
      loadFromCloud(savedEmail); 
    }
  }, []);

  // --- CLICK AWAY LISTENER ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowModelMenu(false);
      }
    };
    if (showModelMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showModelMenu]);

  // --- AUTHENTICATION LOGIC ---
  const handleAuthenticate = async () => {
    if (!userName.trim() || !userEmail.includes("@")) {
      setToastMessage("Please enter a valid name and Gmail ID.");
      setTimeout(() => setToastMessage(""), 3000);
      return;
    }
    setAuthStep(2);
    setToastMessage("Sending verification code to your email...");
    const uniqueCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(uniqueCode);
    
    try {
      const response = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, otp: uniqueCode })
      });
      if (response.ok) {
        setToastMessage(`Verification code sent to ${userEmail}`);
      } else {
        setToastMessage("Error: Could not send email. Check API credentials.");
      }
    } catch (error) {
      setToastMessage("Network error while trying to send email.");
    }
    setTimeout(() => setToastMessage(""), 5000); 
  };

  const handleLogin = () => {
    if (otpInput === generatedOtp) {
      setAuthStep(3);
      setIsLaunching(true);
      localStorage.setItem("aura_user_email", userEmail);
      localStorage.setItem("aura_user_name", userName);
      loadFromCloud(userEmail);
      setTimeout(() => setIsAuthenticated(true), 2000); 
    } else {
      setToastMessage("Invalid Verification Code. Please try again.");
      setTimeout(() => setToastMessage(""), 3000);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("aura_user_email");
    localStorage.removeItem("aura_user_name");
    setIsAuthenticated(false);
    setAuthStep(1);
    setChatHistory([]);
    setActiveSessionId(null);
    setOtpInput("");
    setShowProfileModal(false);
  };

  // --- DASHBOARD LOGIC ---
  const toggleModel = (model: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(model)) return prev.filter((m) => m !== model);
      if (prev.length >= 3) return prev;
      return [...prev, model];
    });
  };

  const evaluateBestResponse = (finalResults: Record<string, string>, modelsUsed: string[]) => {
    if (modelsUsed.length < 2) return null; 
    let maxScore = -1;
    let winner = null;
    modelsUsed.forEach(m => {
      const text = finalResults[m] || "";
      if (text.includes("Error") || text.includes("busy") || text.includes("Generation stopped")) return;
      let score = text.length; 
      score += (text.match(/`{3}/g) || []).length * 500; 
      score += (text.match(/^\s*[-*]\s/gm) || []).length * 50; 
      if (score > maxScore) {
        maxScore = score;
        winner = m;
      }
    });
    return winner;
  };

  const handleSend = async () => {
    if (!prompt.trim() || selectedModels.length < 1 || loading) return;
    
    const currentPrompt = prompt;
    setPrompt(""); 
    setLoading(true);
    setShowModelMenu(false);
    
    // Create optimistic UI Turn
    const loadingResults: Record<string, string> = {};
    AVAILABLE_MODELS.forEach(m => loadingResults[m] = "Generating...");
    
    setActiveTurns(prev => [...prev, { prompt: currentPrompt, results: loadingResults, bestModel: null }]);

    // Context Memory Construction
    let existingContext = "";
    if (activeSessionId) {
      const session = chatHistory.find(s => s.id === activeSessionId);
      if (session) existingContext = session.contextString;
    }
    const memoryPrompt = existingContext 
      ? `Previous Conversation Context:\n${existingContext}\n\nCurrent Request:\n${currentPrompt}` 
      : currentPrompt;

    abortControllerRef.current = new AbortController();
    let finalSessionResults: Record<string, string> = {};
    let calculatedWinner: string | null = null;

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: memoryPrompt, models: AVAILABLE_MODELS }),
        signal: abortControllerRef.current.signal, 
      });
      
      const data = await response.json();
      AVAILABLE_MODELS.forEach(m => {
        finalSessionResults[m] = data[m] || "Error retrieving response.";
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        AVAILABLE_MODELS.forEach(m => finalSessionResults[m] = "Generation stopped by user.");
      } else {
        AVAILABLE_MODELS.forEach(m => finalSessionResults[m] = "Network error.");
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      
      calculatedWinner = evaluateBestResponse(finalSessionResults, selectedModels);

      // Update the UI Turn with the real data
      const finalTurn = { prompt: currentPrompt, results: finalSessionResults, bestModel: calculatedWinner };
      setActiveTurns(prev => {
        const next = [...prev];
        next[next.length - 1] = finalTurn;
        return next;
      });

      // Update the Database Backend
      const aiResponseToRemember = finalSessionResults[calculatedWinner || selectedModels[0]] || "";
      const newContextAppend = `User: ${currentPrompt}\nAI: ${aiResponseToRemember}\n\n`;
      
      let updatedHistory;
      if (activeSessionId) {
        const existingSession = chatHistory.find(s => s.id === activeSessionId)!;
        const currentTurns = existingSession.turns || 
          (existingSession.prompt ? [{ prompt: existingSession.prompt, results: existingSession.results || {}, bestModel: existingSession.bestModel || null }] : []);
          
        const updatedSession = { 
          ...existingSession, 
          turns: [...currentTurns, finalTurn],
          contextString: existingSession.contextString + newContextAppend
        };
        // PUSH RECENTLY USED CHAT TO TOP OF LIST
        updatedHistory = [updatedSession, ...chatHistory.filter(s => s.id !== activeSessionId)];
      } else {
        const newSessionId = Date.now().toString();
        const newSession = {
          id: newSessionId,
          title: currentPrompt, 
          models: [...selectedModels],
          turns: [finalTurn],
          contextString: newContextAppend
        };
        updatedHistory = [newSession, ...chatHistory];
        setActiveSessionId(newSessionId); 
      }
      
      setChatHistory(updatedHistory);
      saveToCloud(userEmail, updatedHistory); 
    }
  };

  const loadChat = (session: ChatSession) => {
    setActiveSessionId(session.id); 
    setPrompt(""); 
    setSelectedModels(session.models); 
    
    // BACKWARD COMPATIBILITY: Convert old data formats to new Bubble array format seamlessly
    if (session.turns && session.turns.length > 0) {
      setActiveTurns(session.turns);
    } else if (session.prompt && session.results) {
      setActiveTurns([{ prompt: session.prompt, results: session.results, bestModel: session.bestModel || null }]);
    } else {
      setActiveTurns([]);
    }

    setHasProceeded(true); 
    if (window.innerWidth < 768) setShowHistory(false);
    
    // PUSH LOADED CHAT TO TOP OF LIST
    setChatHistory(prev => {
      const active = prev.find(s => s.id === session.id);
      if (!active) return prev;
      const filtered = prev.filter(s => s.id !== session.id);
      return [active, ...filtered];
    });
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setPrompt("");
    setActiveTurns([]);
    setHasProceeded(false); 
    if (window.innerWidth < 768) setShowHistory(false);
  };

  // NEW: Delete Chat Logic
  const deleteChat = (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation(); // Prevents loading the chat when you just want to delete it
    
    const updatedHistory = chatHistory.filter((session) => session.id !== idToDelete);
    setChatHistory(updatedHistory);
    saveToCloud(userEmail, updatedHistory); // Update Firebase database immediately
    
    // If user deletes the chat they are currently looking at, wipe the screen
    if (activeSessionId === idToDelete) {
      handleNewChat();
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort(); 
    setLoading(false);
    setActiveTurns(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = { ...next[next.length - 1] };
      const stoppedResults = { ...last.results };
      AVAILABLE_MODELS.forEach(m => {
        if (stoppedResults[m] === "Generating...") stoppedResults[m] = "Generation stopped by user.";
      });
      last.results = stoppedResults;
      next[next.length - 1] = last;
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const bgClass = isDark ? "bg-[#131314] text-[#e3e3e3]" : "bg-white text-gray-800";
  const elementBgClass = isDark ? "bg-[#1e1f20]" : "bg-[#f0f4f9]";
  const borderClass = isDark ? "border-white/10" : "border-gray-200";

  // --- DO NOT RENDER ANYTHING UNTIL HYDRATED ---
  if (!isMounted) return null;

  // ==========================================
  // --- LOGIN SCREEN RENDER ---
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className={`h-screen flex items-center justify-center transition-colors duration-300 font-sans overflow-hidden ${bgClass}`}>
        {toastMessage && (
          <div className="absolute top-10 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-2xl z-50 animate-in slide-in-from-top-5 font-medium tracking-wide border border-white/20 text-center whitespace-nowrap">
            {toastMessage}
          </div>
        )}
        <div className={`w-full max-w-md p-8 md:p-10 rounded-3xl border ${borderClass} ${elementBgClass} shadow-2xl flex flex-col relative overflow-hidden transition-all duration-500`}>
          {isLaunching && (
            <div className="absolute inset-0 bg-[#0a0a0a] z-40 flex flex-col items-center justify-center animate-out fade-out duration-1000 delay-1000">
              <Rocket size={64} className="text-purple-500 animate-bounce mb-4 drop-shadow-[0_0_20px_rgba(168,85,247,0.6)]" />
              <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 animate-pulse tracking-widest uppercase">
                Authenticating
              </h2>
            </div>
          )}
          <div className="flex justify-center mb-6">
            <Sparkles size={48} className="text-[#a8c7fa] drop-shadow-[0_0_15px_rgba(168,199,250,0.4)]" />
          </div>
          <h1 className="text-3xl font-bold text-center mb-2 tracking-tight">Access AURA</h1>
          <p className="text-center opacity-60 mb-8 text-sm uppercase tracking-widest font-semibold">Secure Login</p>

          <div className="flex flex-col gap-5">
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 opacity-50" />
              <input
                type="text"
                placeholder="Enter Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={authStep > 1}
                className={`w-full py-4 pl-12 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${isDark ? 'bg-[#131314] border-white/10 text-white' : 'bg-white border-gray-300 text-black'} ${authStep > 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 opacity-50" />
              <input
                type="email"
                placeholder="Enter Your Gmail ID"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                disabled={authStep > 1}
                className={`w-full py-4 pl-12 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${isDark ? 'bg-[#131314] border-white/10 text-white' : 'bg-white border-gray-300 text-black'} ${authStep > 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            {authStep >= 2 && (
              <div className="relative animate-in slide-in-from-bottom-4 fade-in">
                <Key size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  placeholder="Enter Verification Code"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  maxLength={6}
                  disabled={authStep === 3}
                  className={`w-full py-4 pl-12 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors tracking-widest font-mono text-lg ${isDark ? 'bg-[#131314] border-white/10 text-white' : 'bg-white border-gray-300 text-black'}`}
                />
              </div>
            )}
            <button
              onClick={authStep === 1 ? handleAuthenticate : handleLogin}
              disabled={authStep === 3}
              className="w-full mt-2 py-4 rounded-xl font-bold tracking-widest uppercase text-white bg-gradient-to-r from-cyan-500 to-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:scale-[1.02] transition-all flex justify-center items-center gap-2"
            >
              {authStep === 1 ? (<>Authenticate <Lock size={18} /></>) : (<>Log In <Rocket size={18} /></>)}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // --- MAIN DASHBOARD RENDER ---
  // ==========================================
  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 font-sans overflow-hidden ${bgClass}`}>
      
      {/* PROFILE INFO MODAL */}
      {showProfileModal && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
          <div className={`w-full max-w-sm rounded-3xl shadow-2xl border ${borderClass} ${elementBgClass} overflow-hidden flex flex-col`}>
            <div className="flex justify-between items-center p-6 border-b border-white/10 flex-none">
              <h2 className="text-xl font-bold tracking-tight">Your Profile</h2>
              <button onClick={() => setShowProfileModal(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-8 flex flex-col items-center gap-4">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-lg ${isDark ? 'bg-purple-900' : 'bg-purple-600'}`}>
                {userName ? userName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-bold tracking-tight">{userName}</h3>
                <p className="text-sm opacity-60 mt-1">{userEmail}</p>
              </div>
              <button 
                onClick={handleLogout} 
                className="mt-6 w-full py-3 rounded-xl font-bold text-red-500 bg-red-500/10 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex justify-center items-center gap-2"
              >
                <LogOut size={18} /> Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REPORT ANALYSIS MODAL */}
      {showReport && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in p-4">
          <div className={`w-full max-w-4xl rounded-2xl shadow-2xl border ${borderClass} ${isDark ? 'bg-[#1e1f20]' : 'bg-white'} overflow-hidden flex flex-col max-h-[90vh]`}>
            <div className="flex justify-between items-center p-6 border-b border-white/10 flex-none">
              <div className="flex items-center gap-3">
                <BarChart3 className="text-purple-500" size={24} />
                <h2 className="text-2xl font-bold tracking-tight">Report Analysis</h2>
              </div>
              <button onClick={() => setShowReport(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              {selectedModels.length === 0 ? (
                <p className="text-center opacity-60 py-10">Select models to view their benchmark analysis.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/10">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className={`${isDark ? 'bg-white/5' : 'bg-black/5'}`}>
                        <th className="p-4 font-semibold text-sm border-b border-white/10">Evaluation Criteria</th>
                        {selectedModels.map(model => (
                          <th key={model} className="p-4 font-bold text-sm border-b border-white/10 border-l">
                            {model} <span className="block text-xs font-normal opacity-60">{MODEL_VERSIONS[model]}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CRITERIA.map((criterion, index) => (
                        <tr key={index} className={`transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                          <td className="p-4 text-sm font-medium opacity-80 border-b border-white/10">{criterion}</td>
                          {selectedModels.map(model => (
                            <td key={model} className="p-4 text-sm font-mono border-b border-white/10 border-l">
                              <span className={`px-2 py-1 rounded-md ${BENCHMARK_DATA[model][index] > 85 ? 'text-green-400 bg-green-400/10' : 'text-yellow-400 bg-yellow-400/10'}`}>
                                {BENCHMARK_DATA[model][index].toFixed(1)}%
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="flex-none flex justify-between items-center px-4 py-3 z-10 relative border-b border-transparent">
        <div className="flex items-center gap-4">
          <button onClick={() => setShowHistory(!showHistory)} className={`p-2 rounded-full hover:${isDark ? 'bg-white/10' : 'bg-black/5'} transition-colors`}>
            <Menu size={24} className={isDark ? 'text-white' : 'text-gray-700'} />
          </button>
          <div className="flex items-center gap-2 select-none">
            <span className="text-xl font-medium tracking-wide">AURA</span>
            <Sparkles size={18} className="text-[#a8c7fa]" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => setIsDark(!isDark)} className={`p-2 rounded-full hover:${isDark ? 'bg-white/10' : 'bg-black/5'} transition-colors`}>
            {isDark ? <Sun size={20} className="text-[#e3e3e3]" /> : <Moon size={20} />}
          </button>
          
          <button 
            onClick={() => setShowProfileModal(true)} 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white select-none shadow-md hover:scale-105 transition-transform ${isDark ? 'bg-purple-900' : 'bg-purple-600'}`} 
            title="View Profile"
          >
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden w-full relative">
        <div className={`flex-none h-full transition-all duration-300 ease-in-out flex flex-col ${elementBgClass} ${showHistory ? `w-64 md:w-72 opacity-100 border-r ${borderClass}` : "w-0 opacity-0 border-r-0 border-transparent overflow-hidden"}`}>
          <div className="p-4 flex justify-between items-center border-b border-white/5 min-w-[16rem]">
            <span className="font-medium tracking-wide">Recent Chats</span>
            <button onClick={() => setShowHistory(false)} className="p-1 rounded-full hover:bg-white/10"><X size={20} /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-w-[16rem]">
            {chatHistory.length === 0 ? (
              <div className="text-sm opacity-50 text-center mt-4">No recent chats.</div>
            ) : (
              chatHistory.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => loadChat(session)} 
                  className={`group py-3 px-3 rounded-xl flex items-center justify-between cursor-pointer transition-colors ${activeSessionId === session.id ? (isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black') : (isDark ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-600 hover:text-black')}`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare size={16} className="opacity-60 flex-none" />
                    <span className="text-sm truncate">{session.title}</span>
                  </div>
                  
                  {/* TRASH ICON TO DELETE CHAT */}
                  <button 
                    onClick={(e) => deleteChat(e, session.id)} 
                    className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-full hover:bg-red-500/20 text-red-500 transition-all flex-none ${activeSessionId === session.id ? 'opacity-100' : ''}`}
                    title="Delete Chat"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden w-full transition-all duration-300 ease-in-out">
          {!hasProceeded ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full h-full select-none overflow-y-auto pb-10">
              <Sparkles size={64} className="text-[#a8c7fa] mb-6 animate-pulse" />
              <h1 className="text-6xl md:text-8xl font-semibold tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500">AURA</h1>
              <p className="text-xl md:text-2xl font-medium opacity-80 tracking-widest text-center mb-10">AI Unified Response Analyzer</p>
              
              <div className={`w-full max-w-lg p-8 rounded-3xl border ${borderClass} ${elementBgClass} shadow-lg flex flex-col items-center`}>
                <p className="text-sm opacity-60 font-bold tracking-widest mb-6">SELECT ANY MODELS (MAX 3)</p>
                <div className="grid grid-cols-2 gap-4 w-full mb-8">
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModels.includes(model);
                    const isDisabled = !isSelected && selectedModels.length >= 3;
                    return (
                      <div key={model} onClick={() => { if (!isDisabled) toggleModel(model); }} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${isSelected ? 'border-purple-500 bg-purple-500/10' : (isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400')} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? 'bg-purple-500 border-purple-500' : (isDark ? 'border-gray-600' : 'border-gray-400')}`}>
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>
                        <span className="text-base font-medium">{model}</span>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setHasProceeded(true)} disabled={selectedModels.length === 0} className={`w-full py-4 rounded-xl font-bold tracking-wide transition-all ${selectedModels.length > 0 ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md hover:scale-[1.02]' : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'}`}>
                  PROCEED
                </button>
              </div>
            </div>
          ) : (
            selectedModels.map((modelName) => {
              const latestTurn = activeTurns[activeTurns.length - 1];
              const isBestOverall = latestTurn?.bestModel === modelName;

              return (
                <div key={modelName} className={`flex-1 flex flex-col h-full rounded-3xl border transition-all duration-500 ${elementBgClass} overflow-hidden ${isBestOverall ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)] ring-1 ring-green-500' : borderClass}`}>
                  <div className={`px-6 py-5 flex justify-between items-center border-b ${isBestOverall ? 'border-green-500/30' : borderClass} flex-none`}>
                    
                    <div className="flex items-baseline gap-2 font-bold text-xl md:text-2xl tracking-tight">
                      {modelName}
                      <span className="text-xs md:text-sm font-normal opacity-50 tracking-normal">({MODEL_VERSIONS[modelName] || "v1.0"})</span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {isBestOverall && !loading && <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30 animate-in fade-in zoom-in">BEST RESPONSE</span>}
                      {loading && <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>}
                      <button onClick={() => toggleModel(modelName)} className="p-1.5 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors opacity-50 hover:opacity-100">
                        <X size={18} />
                      </button>
                    </div>

                  </div>

                  {/* MODERN CHAT BUBBLE LAYOUT */}
                  <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 chat-scroll-container">
                    {activeTurns.map((turn, idx) => (
                      <div key={idx} className="flex flex-col space-y-4 mb-6 animate-in slide-in-from-bottom-2 fade-in duration-300">
                        
                        {/* USER PROMPT BUBBLE (RIGHT) */}
                        <div className="flex justify-end w-full">
                          <div className={`max-w-[85%] px-5 py-3 rounded-3xl rounded-tr-sm text-[15px] leading-relaxed shadow-md ${isDark ? 'bg-gradient-to-r from-purple-600 to-cyan-600 text-white' : 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white'}`}>
                            {turn.prompt}
                          </div>
                        </div>

                        {/* AI RESPONSE BUBBLE (LEFT) */}
                        <div className="flex justify-start w-full">
                          <div className={`max-w-[95%] px-5 py-4 rounded-3xl rounded-tl-sm text-[15px] leading-relaxed shadow-sm whitespace-pre-wrap ${isDark ? 'bg-[#2a2b2c] text-[#e3e3e3] border border-white/5' : 'bg-white text-gray-800 border border-gray-200'}`}>
                            {turn.results[modelName] || "No response generated."}
                          </div>
                        </div>

                      </div>
                    ))}
                  </div>

                </div>
              );
            })
          )}
        </main>
      </div>

      {hasProceeded && (
        <footer className="flex-none px-4 md:px-8 pb-6 flex items-end gap-3 max-w-5xl mx-auto w-full relative z-10 animate-in slide-in-from-bottom-10">
          <button onClick={handleNewChat} title="New Chat" className={`h-12 px-4 flex-none flex items-center justify-center gap-2 rounded-full transition-colors font-medium text-sm ${isDark ? 'bg-[#1e1f20] hover:bg-white/10 text-[#e3e3e3]' : 'bg-[#f0f4f9] hover:bg-black/5 text-gray-700'}`}>
            <SquarePen size={18} /> <span className="hidden sm:inline">New Chat</span>
          </button>
          <button onClick={() => setShowReport(true)} title="Report Analysis" className={`h-12 px-4 flex-none flex items-center justify-center gap-2 rounded-full transition-colors font-medium text-sm border ${isDark ? 'bg-[#1e1f20] border-purple-500/30 hover:bg-purple-500/10 text-purple-400' : 'bg-white border-purple-300 hover:bg-purple-50 text-purple-600'}`}>
            <BarChart3 size={18} /> <span className="hidden sm:inline">Report Analysis</span>
          </button>

          <div ref={menuRef} className="relative flex-none">
            <button onClick={() => setShowModelMenu(!showModelMenu)} className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-[#1e1f20] hover:bg-white/10' : 'bg-[#f0f4f9] hover:bg-black/5'}`}>
              <Plus size={24} className={isDark ? 'text-[#e3e3e3]' : 'text-gray-700'} />
            </button>
            {showModelMenu && (
              <div className={`absolute bottom-16 left-0 p-3 rounded-2xl shadow-xl border w-48 mb-2 z-50 ${elementBgClass} ${borderClass}`}>
                <p className="text-xs font-semibold opacity-60 mb-2 px-2 select-none">Models (Max 3)</p>
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = selectedModels.includes(model);
                  const isDisabled = !isSelected && selectedModels.length >= 3;
                  return (
                    <div key={model} onClick={() => { if (!isDisabled) toggleModel(model); }} className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer ${isDisabled ? 'opacity-40 cursor-not-allowed' : `hover:${isDark ? 'bg-white/5' : 'bg-black/5'}`}`}>
                      <div className={`w-4 h-4 rounded flex items-center justify-center border ${isSelected ? 'bg-blue-500 border-blue-500' : (isDark ? 'border-gray-500' : 'border-gray-400')}`}>
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <span className="text-sm select-none">{model}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`flex-1 relative rounded-3xl ${elementBgClass} ${isDark ? '' : 'border border-gray-200'}`}>
            <textarea
              value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="Enter a prompt here" rows={1} style={{ minHeight: '56px', maxHeight: '200px' }}
              className="w-full py-4 pl-6 pr-14 bg-transparent focus:outline-none resize-none custom-scrollbar"
            />
            <button onClick={loading ? handleStop : handleSend} disabled={(!prompt.trim() && !loading) || selectedModels.length === 0} className={`absolute right-2 bottom-2 p-2 rounded-full transition-colors ${loading ? 'bg-[#1a1a1a] text-[#e3e3e3] hover:bg-[#333] border border-white/20' : prompt.trim() && selectedModels.length > 0 ? (isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800') : 'text-gray-500 cursor-not-allowed opacity-50'}`}>
              {loading ? <Square size={16} className="fill-current" /> : <ArrowUp size={20} />}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}