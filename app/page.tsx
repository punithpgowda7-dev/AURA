"use client";
import { useState, useRef } from "react";
import { Menu, Sun, Moon, Plus, ArrowUp, Check, Sparkles, X, MessageSquare, Square } from "lucide-react";

const AVAILABLE_MODELS = ["Perplexity", "Gemini", "Grok", "ChatGPT", "Claude", "DeepSeek"];

export default function Home() {
  const [isDark, setIsDark] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [sentPrompt, setSentPrompt] = useState(""); 
  
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  // NEW STATE: Tracks if the user has clicked "Proceed"
  const [hasProceeded, setHasProceeded] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, string>>({});
  const [chatHistory, setChatHistory] = useState<string[]>([]);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  const toggleModel = (model: string) => {
    setSelectedModels((prev) => {
      if (prev.includes(model)) {
        return prev.filter((m) => m !== model);
      }
      if (prev.length >= 3) return prev;
      return [...prev, model];
    });
  };

  const handleSend = async () => {
    if (!prompt.trim() || selectedModels.length < 1 || loading) return;
    
    const currentPrompt = prompt;
    setSentPrompt(currentPrompt);
    setPrompt(""); 
    
    setChatHistory((prevHistory) => [currentPrompt, ...prevHistory]);
    
    setLoading(true);
    setShowModelMenu(false);
    
    const loadingResults: Record<string, string> = {};
    selectedModels.forEach(m => loadingResults[m] = "Generating...");
    setResults(loadingResults);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: currentPrompt, models: selectedModels }),
        signal: abortControllerRef.current.signal, 
      });
      
      const data = await response.json();
      
      const finalResults: Record<string, string> = {};
      selectedModels.forEach(m => {
        finalResults[m] = data[m] || "Error retrieving response.";
      });
      setResults(finalResults);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        const stoppedResults: Record<string, string> = {};
        selectedModels.forEach(m => stoppedResults[m] = "Generation stopped by user.");
        setResults(stoppedResults);
      } else {
        const errorResults: Record<string, string> = {};
        selectedModels.forEach(m => errorResults[m] = "Network error.");
        setResults(errorResults);
      }
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); 
    }
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

  return (
    <div className={`h-screen flex flex-col transition-colors duration-300 font-sans overflow-hidden ${bgClass}`}>
      
      <header className="flex-none flex justify-between items-center px-4 py-3 z-10 relative">
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
          
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white select-none ${isDark ? 'bg-purple-900' : 'bg-purple-600'}`}>
            P
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative w-full">
        
        {/* HISTORY SIDEBAR - Cleaned up borders and boxes */}
        <div className={`absolute top-0 left-0 h-full w-64 md:w-72 shadow-2xl z-40 transition-transform duration-300 flex flex-col ${showHistory ? 'translate-x-0' : '-translate-x-full'} ${elementBgClass} ${borderClass} border-r`}>
          <div className="p-4 flex justify-between items-center border-b border-white/5">
            <span className="font-medium tracking-wide">Recent Chats</span>
            <button onClick={() => setShowHistory(false)} className="p-1 rounded-full hover:bg-white/10">
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {chatHistory.length === 0 ? (
              <div className="text-sm opacity-50 text-center mt-4">
                No recent chats.
              </div>
            ) : (
              chatHistory.map((historyItem, index) => (
                <div key={index} className={`py-3 flex items-center gap-3 cursor-pointer transition-colors ${isDark ? 'hover:text-white text-gray-300' : 'hover:text-black text-gray-600'}`}>
                  <MessageSquare size={16} className="opacity-60 flex-none" />
                  <span className="text-sm truncate">{historyItem}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 md:p-6 overflow-hidden max-w-7xl mx-auto w-full">
          
          {/* THE NEW INTEGRATED LANDING PAGE */}
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
            
            // THE CHAT INTERFACE
            selectedModels.map((modelName) => (
              <div key={modelName} className={`flex-1 flex flex-col h-full rounded-2xl border ${borderClass} ${elementBgClass} overflow-hidden`}>
                
                {/* BIGGER BOLD MODEL NAME */}
                <div className={`px-6 py-5 flex justify-between items-center border-b ${borderClass} flex-none`}>
                  <div className="flex items-center gap-2 font-bold text-xl md:text-2xl tracking-tight">
                    {modelName}
                  </div>
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

      {/* FOOTER INPUT - Only visible after Proceeding */}
      {hasProceeded && (
        <footer className="flex-none px-4 md:px-8 pb-6 flex items-end gap-3 max-w-4xl mx-auto w-full relative z-10 animate-in slide-in-from-bottom-10">
          
          <div className="relative">
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