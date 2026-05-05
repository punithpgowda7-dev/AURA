"use client";
import { useState, useRef } from "react";
import { Menu, Sun, Moon, Plus, ArrowUp, Check, Sparkles, X, MessageSquare, Square, SquarePen, User, Mail, Key, Lock, Rocket, BarChart3 } from "lucide-react";

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
  "1. Undergraduate level knowledge",
  "2. Graduate level reasoning",
  "3. Grade school math",
  "4. Maths problem solving",
  "5. Multilingual math",
  "6. Code generation",
  "7. Reasoning over text",
  "8. Mixed evaluation",
  "9. Knowledge Q&A",
  "10. Common Knowledge"
];

type ChatSession = {
  id: string;
  title: string; 
  prompt: string;
  models: string[];
  results: Record<string, string>;
  bestModel: string | null; 
};

export default function Home() {
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
  const [prompt, setPrompt] = useState("");
  const [sentPrompt, setSentPrompt] = useState(""); 
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [hasProceeded, setHasProceeded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const [bestModel, setBestModel] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);

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
      setTimeout(() => {
        setIsAuthenticated(true);
      }, 2000); 
    } else {
      setToastMessage("Invalid Verification Code. Please try again.");
      setTimeout(() => setToastMessage(""), 3000);
    }
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
    setSentPrompt(currentPrompt);
    setPrompt(""); 
    setLoading(true);
    setShowModelMenu(false);
    setBestModel(null);
    
    const loadingResults: Record<string, string> = {};
    selectedModels.forEach(m => loadingResults[m] = "Generating...");
    setResults(loadingResults);

    abortControllerRef.current = new AbortController();
    let finalSessionResults: Record<string, string> = {};

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, models: selectedModels }),
        signal: abortControllerRef.current.signal, 
      });
      
      const data = await response.json();
      selectedModels.forEach(m => {
        finalSessionResults[m] = data[m] || "Error retrieving response.";
      });
      setResults(finalSessionResults);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        selectedModels.forEach(m => finalSessionResults[m] = "Generation stopped by user.");
      } else {
        selectedModels.forEach(m => finalSessionResults[m] = "Network error.");
      }
      setResults(finalSessionResults);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      
      const calculatedWinner = evaluateBestResponse(finalSessionResults, selectedModels);
      setBestModel(calculatedWinner);
      
      if (activeSessionId) {
        setChatHistory((prev) => prev.map(session => 
          session.id === activeSessionId 
            ? { ...session, prompt: currentPrompt, models: [...selectedModels], results: finalSessionResults, bestModel: calculatedWinner }
            : session
        ));
      } else {
        const newSessionId = Date.now().toString();
        setChatHistory((prev) => [
          {
            id: newSessionId,
            title: currentPrompt, 
            prompt: currentPrompt,
            models: [...selectedModels],
            results: finalSessionResults,
            bestModel: calculatedWinner
          },
          ...prev
        ]);
        setActiveSessionId(newSessionId); 
      }
    }
  };

  const loadChat = (session: ChatSession) => {
    setActiveSessionId(session.id); 
    setPrompt(""); 
    setSentPrompt(session.prompt); 
    setSelectedModels(session.models); 
    setResults(session.results); 
    setBestModel(session.bestModel);
    setHasProceeded(true); 
    if (window.innerWidth < 768) setShowHistory(false);
  };

  const handleNewChat = () => {
    setActiveSessionId(null);
    setPrompt("");
    setSentPrompt("");
    setResults({});
    setBestModel(null);
    setHasProceeded(false); 
    if (window.innerWidth < 768) setShowHistory(false);
  };

  const handleStop = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort(); 
    setPrompt(sentPrompt); 
    setLoading(false);
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

          {/* FIXED: suppressHydrationWarning added here to stop browser extensions from crashing Next.js */}
          <div className="flex flex-col gap-5" suppressHydrationWarning>
            <div className="relative" suppressHydrationWarning>
              <User size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 opacity-50" />
              <input
                type="text"
                placeholder="Enter Your Name"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                disabled={authStep > 1}
                suppressHydrationWarning
                className={`w-full py-4 pl-12 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${isDark ? 'bg-[#131314] border-white/10 text-white' : 'bg-white border-gray-300 text-black'} ${authStep > 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>
            
            <div className="relative" suppressHydrationWarning>
              <Mail size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 opacity-50" />
              <input
                type="email"
                placeholder="Enter Your Gmail ID"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                disabled={authStep > 1}
                suppressHydrationWarning
                className={`w-full py-4 pl-12 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors ${isDark ? 'bg-[#131314] border-white/10 text-white' : 'bg-white border-gray-300 text-black'} ${authStep > 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            </div>

            {authStep >= 2 && (
              <div className="relative animate-in slide-in-from-bottom-4 fade-in" suppressHydrationWarning>
                <Key size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 opacity-50" />
                <input
                  type="text"
                  placeholder="Enter Verification Code"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  maxLength={6}
                  disabled={authStep === 3}
                  suppressHydrationWarning
                  className={`w-full py-4 pl-12 pr-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors tracking-widest font-mono text-lg ${isDark ? 'bg-[#131314] border-white/10 text-white' : 'bg-white border-gray-300 text-black'}`}
                />
              </div>
            )}

            <button
              onClick={authStep === 1 ? handleAuthenticate : handleLogin}
              disabled={authStep === 3}
              className="w-full mt-2 py-4 rounded-xl font-bold tracking-widest uppercase text-white bg-gradient-to-r from-cyan-500 to-purple-600 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:scale-[1.02] transition-all flex justify-center items-center gap-2"
            >
              {authStep === 1 ? (
                <>Authenticate <Lock size={18} /></>
              ) : (
                <>Log In <Rocket size={18} /></>
              )}
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
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-full hover:${isDark ? 'bg-white/10' : 'bg-black/5'} transition-colors`}
          >
            <Menu size={24} className={isDark ? 'text-white' : 'text-gray-700'} />
          </button>
          <div className="flex items-center gap-2 select-none">
            <span className="text-xl font-medium tracking-wide">AURA</span>
            <Sparkles size={18} className="text-[#a8c7fa]" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsDark(!isDark)}
            className={`p-2 rounded-full hover:${isDark ? 'bg-white/10' : 'bg-black/5'} transition-colors`}
          >
            {isDark ? <Sun size={20} className="text-[#e3e3e3]" /> : <Moon size={20} />}
          </button>
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white select-none shadow-md ${isDark ? 'bg-purple-900' : 'bg-purple-600'}`} title={userEmail}>
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden w-full relative">
        
        <div 
          className={`flex-none h-full transition-all duration-300 ease-in-out flex flex-col ${elementBgClass} ${
            showHistory ? `w-64 md:w-72 opacity-100 border-r ${borderClass}` : "w-0 opacity-0 border-r-0 border-transparent overflow-hidden"
          }`}
        >
          <div className="p-4 flex justify-between items-center border-b border-white/5 min-w-[16rem]">
            <span className="font-medium tracking-wide">Recent Chats</span>
            <button onClick={() => setShowHistory(false)} className="p-1 rounded-full hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar min-w-[16rem]">
            {chatHistory.length === 0 ? (
              <div className="text-sm opacity-50 text-center mt-4">
                No recent chats.
              </div>
            ) : (
              chatHistory.map((session) => (
                <div 
                  key={session.id} 
                  onClick={() => loadChat(session)}
                  className={`py-3 px-3 rounded-xl flex items-center gap-3 cursor-pointer transition-colors ${
                    activeSessionId === session.id 
                      ? (isDark ? 'bg-white/10 text-white' : 'bg-black/10 text-black') 
                      : (isDark ? 'hover:bg-white/5 text-gray-400 hover:text-white' : 'hover:bg-black/5 text-gray-600 hover:text-black')
                  }`}
                >
                  <MessageSquare size={16} className="opacity-60 flex-none" />
                  <span className="text-sm truncate">{session.title}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden w-full transition-all duration-300 ease-in-out">
          
          {!hasProceeded ? (
            <div className="flex-1 flex flex-col items-center justify-center w-full h-full select-none overflow-y-auto pb-10">
              <Sparkles size={64} className="text-[#a8c7fa] mb-6 animate-pulse" />
              <h1 className="text-6xl md:text-8xl font-semibold tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500">
                AURA
              </h1>
              <p className="text-xl md:text-2xl font-medium opacity-80 tracking-widest text-center mb-10">
                AI Unified Response Analyzer
              </p>
              
              <div className={`w-full max-w-lg p-8 rounded-3xl border ${borderClass} ${elementBgClass} shadow-lg flex flex-col items-center`}>
                <p className="text-sm opacity-60 font-bold tracking-widest mb-6">SELECT ANY MODELS (MAX 3)</p>
                
                <div className="grid grid-cols-2 gap-4 w-full mb-8">
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModels.includes(model);
                    const isDisabled = !isSelected && selectedModels.length >= 3;
                    return (
                      <div 
                        key={model} 
                        onClick={() => { if (!isDisabled) toggleModel(model); }}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${isSelected ? 'border-purple-500 bg-purple-500/10' : (isDark ? 'border-gray-700 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400')} ${isDisabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${isSelected ? 'bg-purple-500 border-purple-500' : (isDark ? 'border-gray-600' : 'border-gray-400')}`}>
                          {isSelected && <Check size={14} className="text-white" />}
                        </div>
                        <span className="text-base font-medium">{model}</span>
                      </div>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setHasProceeded(true)}
                  disabled={selectedModels.length === 0}
                  className={`w-full py-4 rounded-xl font-bold tracking-wide transition-all ${selectedModels.length > 0 ? 'bg-gradient-to-r from-cyan-500 to-purple-600 text-white shadow-md hover:scale-[1.02]' : 'bg-gray-500/20 text-gray-500 cursor-not-allowed'}`}
                >
                  PROCEED
                </button>
              </div>
            </div>
          ) : (
            
            selectedModels.map((modelName) => (
              <div 
                key={modelName} 
                className={`flex-1 flex flex-col h-full rounded-2xl border transition-all duration-500 ${elementBgClass} overflow-hidden ${
                  bestModel === modelName 
                    ? 'border-green-500 shadow-[0_0_20px_rgba(34,197,94,0.3)] ring-1 ring-green-500' 
                    : borderClass
                }`}
              >
                <div className={`px-6 py-5 flex justify-between items-center border-b ${
                  bestModel === modelName ? 'border-green-500/30' : borderClass
                } flex-none`}
                >
                  <div className="flex items-baseline gap-2 font-bold text-xl md:text-2xl tracking-tight">
                    {modelName}
                    <span className="text-xs md:text-sm font-normal opacity-50 tracking-normal">
                      ({MODEL_VERSIONS[modelName] || "v1.0"})
                    </span>
                  </div>
                  
                  {bestModel === modelName && !loading && (
                    <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30 animate-in fade-in zoom-in">
                      BEST RESPONSE
                    </span>
                  )}
                  {loading && <span className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>}
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 whitespace-pre-wrap text-[15px] leading-relaxed">
                  {results[modelName] || ""}
                </div>
              </div>
            ))
          )}
        </main>
      </div>

      {hasProceeded && (
        <footer className="flex-none px-4 md:px-8 pb-6 flex items-end gap-3 max-w-5xl mx-auto w-full relative z-10 animate-in slide-in-from-bottom-10">
          
          <button 
            onClick={handleNewChat}
            title="New Chat"
            className={`h-12 px-4 flex-none flex items-center justify-center gap-2 rounded-full transition-colors font-medium text-sm ${isDark ? 'bg-[#1e1f20] hover:bg-white/10 text-[#e3e3e3]' : 'bg-[#f0f4f9] hover:bg-black/5 text-gray-700'}`}
          >
            <SquarePen size={18} />
            <span className="hidden sm:inline">New Chat</span>
          </button>

          <button 
            onClick={() => setShowReport(true)}
            title="Report Analysis"
            className={`h-12 px-4 flex-none flex items-center justify-center gap-2 rounded-full transition-colors font-medium text-sm border ${isDark ? 'bg-[#1e1f20] border-purple-500/30 hover:bg-purple-500/10 text-purple-400' : 'bg-white border-purple-300 hover:bg-purple-50 text-purple-600'}`}
          >
            <BarChart3 size={18} />
            <span className="hidden sm:inline">Report Analysis</span>
          </button>

          <div className="relative flex-none">
            <button 
              onClick={() => setShowModelMenu(!showModelMenu)}
              className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-[#1e1f20] hover:bg-white/10' : 'bg-[#f0f4f9] hover:bg-black/5'}`}
            >
              <Plus size={24} className={isDark ? 'text-[#e3e3e3]' : 'text-gray-700'} />
            </button>

            {showModelMenu && (
              <div className={`absolute bottom-16 left-0 p-3 rounded-2xl shadow-xl border w-48 mb-2 z-50 ${elementBgClass} ${borderClass}`}>
                <p className="text-xs font-semibold opacity-60 mb-2 px-2 select-none">Models (Max 3)</p>
                {AVAILABLE_MODELS.map((model) => {
                  const isSelected = selectedModels.includes(model);
                  const isDisabled = !isSelected && selectedModels.length >= 3;
                  return (
                    <div 
                      key={model} 
                      onClick={() => { if (!isDisabled) toggleModel(model); }}
                      className={`flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer ${isDisabled ? 'opacity-40 cursor-not-allowed' : `hover:${isDark ? 'bg-white/5' : 'bg-black/5'}`}`}
                    >
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
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a prompt here"
              rows={1}
              className="w-full py-4 pl-6 pr-14 bg-transparent focus:outline-none resize-none custom-scrollbar"
              style={{ minHeight: '56px', maxHeight: '200px' }}
            />
            
            <button 
              onClick={loading ? handleStop : handleSend}
              disabled={(!prompt.trim() && !loading) || selectedModels.length === 0}
              className={`absolute right-2 bottom-2 p-2 rounded-full transition-colors ${
                loading 
                  ? 'bg-[#1a1a1a] text-[#e3e3e3] hover:bg-[#333] border border-white/20' 
                  : prompt.trim() && selectedModels.length > 0 
                    ? (isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800') 
                    : 'text-gray-500 cursor-not-allowed opacity-50'
              }`}
            >
              {loading ? <Square size={16} className="fill-current" /> : <ArrowUp size={20} />}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}