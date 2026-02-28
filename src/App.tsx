import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Terminal, 
  Cpu, 
  Code2, 
  CheckCircle2, 
  XCircle, 
  Play, 
  History, 
  Zap, 
  Bug, 
  ChevronRight,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Activity,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Share2,
  FileText,
  X,
  Lightbulb,
  BrainCircuit,
  Settings,
  Wrench,
  Rocket,
  CloudUpload
} from 'lucide-react';
import { analyzeProblem, generateInitialCode, generateTestCases, debugAndRepair, optimizeCode, explainCode, validateCode, analyzeAlgorithm, reviewCode, ProblemAnalysis, TestCase } from './services/ai';
import Chatbot from './components/Chatbot';

type Step = 'idle' | 'analyzing' | 'coding' | 'testing' | 'debugging' | 'optimizing' | 'completed' | 'failed';

interface LogEntry {
  type: 'info' | 'success' | 'error' | 'ai';
  message: string;
  timestamp: string;
}

const PIPELINE_STEPS = [
  { id: 'analyzing', label: 'Analysis', icon: BrainCircuit },
  { id: 'coding', label: 'Synthesis', subLabel: '(Coding)', icon: Settings },
  { id: 'testing', label: 'Validation', subLabel: '(Testing)', icon: ShieldCheck },
  { id: 'debugging', label: 'Repair', subLabel: '(Debugging)', icon: Wrench },
  { id: 'optimizing', label: 'Optimization', icon: Rocket },
  { id: 'completed', label: 'Deployment', icon: CloudUpload },
];

const ErrorLogDisplay = ({ errorText }: { errorText: string }) => {
  if (!errorText) return <span className="text-zinc-500 italic">{'<empty output>'}</span>;

  const handleLineClick = (lineNum: number) => {
    const el = document.getElementById(`code-line-${lineNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-red-500/30', 'transition-colors', 'duration-300');
      setTimeout(() => el.classList.remove('bg-red-500/30'), 2000);
    }
  };

  const lines = errorText.split('\n');
  
  return (
    <div className="bg-[#1e1e1e] p-3 rounded border border-red-500/20 text-zinc-300 break-all font-mono text-[11px] leading-relaxed whitespace-pre-wrap overflow-x-auto">
      {lines.map((line, i) => {
        // Traceback header
        if (line.trim() === 'Traceback (most recent call last):') {
          return <div key={i} className="text-red-400 font-bold mb-1">{line}</div>;
        }
        
        // File and line number match
        const fileLineMatch = line.match(/File "([^"]+)", line (\d+)(.*)/);
        if (fileLineMatch) {
          const [_, file, lineNumStr, rest] = fileLineMatch;
          const lineNum = parseInt(lineNumStr, 10);
          return (
            <div key={i} className="text-zinc-400 ml-2 bg-white/5 px-2 py-0.5 rounded my-0.5 inline-block w-full">
              File <span className="text-emerald-400/70">"{file}"</span>,{' '}
              <button 
                onClick={() => handleLineClick(lineNum)}
                className="text-emerald-400 hover:text-emerald-300 underline decoration-emerald-500/50 hover:decoration-emerald-400 transition-colors cursor-pointer"
              >
                line {lineNum}
              </button>
              {rest}
            </div>
          );
        }
        
        // Error type match (e.g., NameError: name 'x' is not defined)
        const errorTypeMatch = line.match(/^([A-Z][a-zA-Z]+Error|Exception):(.*)/);
        if (errorTypeMatch) {
          return (
            <div key={i} className="mt-2 text-red-400 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 inline-block w-full">
              <span className="font-bold text-red-500">{errorTypeMatch[1]}:</span>
              {errorTypeMatch[2]}
            </div>
          );
        }
        
        // Code snippet in traceback (usually indented with 4 spaces)
        if (line.startsWith('    ')) {
          return <div key={i} className="text-zinc-300 ml-4 border-l-2 border-red-500/30 pl-2 my-1">{line.trim()}</div>;
        }
        
        // Fallback for other lines with "line X"
        const lineMatch = line.match(/line (\d+)/);
        if (lineMatch) {
          const lineNum = parseInt(lineMatch[1], 10);
          const parts = line.split(lineMatch[0]);
          return (
            <div key={i} className="text-zinc-400 bg-white/5 px-2 py-0.5 rounded my-0.5 inline-block w-full">
              {parts[0]}
              <button 
                onClick={() => handleLineClick(lineNum)}
                className="text-emerald-400 hover:text-emerald-300 underline decoration-emerald-500/50 hover:decoration-emerald-400 transition-colors cursor-pointer"
              >
                {lineMatch[0]}
              </button>
              {parts[1]}
            </div>
          );
        }
        
        return <div key={i} className="text-zinc-400">{line}</div>;
      })}
    </div>
  );
};

export default function App() {
  const [problem, setProblem] = useState(() => {
    return localStorage.getItem('zeroth_problem_description') || '';
  });
  const [sampleInput, setSampleInput] = useState('');
  const [sampleOutput, setSampleOutput] = useState('');
  const [step, setStep] = useState<Step>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [analysis, setAnalysis] = useState<ProblemAnalysis | null>(null);
  const [code, setCode] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [proMode, setProMode] = useState(true);
  const [explanation, setExplanation] = useState('');
  const [isExplaining, setIsExplaining] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isAnalyzingAlgorithm, setIsAnalyzingAlgorithm] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [generatedTests, setGeneratedTests] = useState<any[]>([]);
  const [showTestLibrary, setShowTestLibrary] = useState(false);
  const [allTests, setAllTests] = useState<any[]>([]);
  const [telemetryTab, setTelemetryTab] = useState<'logs' | 'errors'>('logs');
  const [isCopied, setIsCopied] = useState(false);
  const [language, setLanguage] = useState<'python' | 'cpp' | 'java'>('python');
  const [contestMode, setContestMode] = useState(false);
  const [contestTime, setContestTime] = useState(0);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: any;
    if (contestMode) {
      interval = setInterval(() => {
        setContestTime(prev => prev + 1);
      }, 1000);
    } else {
      setContestTime(0);
    }
    return () => clearInterval(interval);
  }, [contestMode]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    localStorage.setItem('zeroth_problem_description', problem);
  }, [problem]);

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, { message, type, timestamp: new Date().toLocaleTimeString() }]);
  };

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleExplain = async () => {
    if (!code) return;
    setIsExplaining(true);
    setShowExplanation(true);
    try {
      const result = await explainCode(problem, code);
      setExplanation(result);
    } catch (err: any) {
      setExplanation(`Failed to generate explanation: ${err.message}`);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleValidate = async () => {
    if (!code) return;
    setIsValidating(true);
    setShowExplanation(true);
    setExplanation('Running deep validation and stress testing...');
    try {
      const result = await validateCode(problem, code);
      setExplanation(result);
    } catch (err: any) {
      setExplanation(`Failed to run validation: ${err.message}`);
    } finally {
      setIsValidating(false);
    }
  };

  const handleAnalyzeAlgorithm = async () => {
    if (!problem.trim()) return;
    setIsAnalyzingAlgorithm(true);
    setShowExplanation(true);
    setExplanation('Consulting Algorithm Expert...\n\nAnalyzing problem type and optimal approaches...');
    try {
      const result = await analyzeAlgorithm(problem);
      setExplanation(result);
    } catch (err: any) {
      setExplanation(`Failed to analyze algorithm: ${err.message}`);
    } finally {
      setIsAnalyzingAlgorithm(false);
    }
  };

  const handleReviewCode = async () => {
    if (!code) return;
    setIsReviewing(true);
    setShowExplanation(true);
    setExplanation('AI Code Reviewer analyzing code for mistakes and improvements...');
    try {
      const result = await reviewCode(problem, code);
      setExplanation(result);
    } catch (err: any) {
      setExplanation(`Failed to review code: ${err.message}`);
    } finally {
      setIsReviewing(false);
    }
  };

  const runAgent = async () => {
    if (!problem.trim()) return;

    setStep('analyzing');
    setLogs([]);
    addLog('ZEROTH CORE INITIALIZED', 'info');
    addLog(`Establishing neural link with ${proMode ? 'Gemini 3.1 Pro (Thinking: HIGH)' : 'Gemini 3.0 Flash (Thinking: LOW)'}...`, 'ai');
    
    try {
      // 1. Analyze
      addLog('Parsing problem semantics and constraints...', 'ai');
      const analysisResponse = await analyzeProblem(problem, proMode);
      const analysisData = analysisResponse.data;
      if (analysisResponse.reasoning) {
        addLog(`Reasoning: ${analysisResponse.reasoning}`, 'ai');
      }
      setAnalysis(analysisData);
      addLog(`Target Identified: ${analysisData.title}`, 'success');
      addLog(`Complexity Objective: ${analysisData.complexityGoal}`, 'info');

      // 2. Generate Initial Code
      setStep('coding');
      addLog(`Synthesizing algorithmic structure in ${language.toUpperCase()}...`, 'ai');
      const codeResponse = await generateInitialCode(analysisData, language, proMode);
      let currentCode = codeResponse.data;
      if (codeResponse.reasoning) {
        addLog(`Reasoning: ${codeResponse.reasoning}`, 'ai');
      }
      setCode(currentCode);
      addLog('Base architecture established.', 'success');

      // 3. Generate Test Cases Once
      setStep('testing');
      addLog('Generating adversarial test cases...', 'ai');
      const newGeneratedTests = await generateTestCases(problem, analysisData, currentCode);
      setGeneratedTests(newGeneratedTests);
      setShowTestLibrary(true); // Automatically show the test library so the user can see the generated tests
      
      const inputPublicTests = [];
      if (sampleInput.trim() && sampleOutput.trim()) {
        inputPublicTests.push({
          input: sampleInput.trim(),
          expectedOutput: sampleOutput.trim(),
          description: 'User provided test case'
        });
      }

      const allTests = [...inputPublicTests, ...newGeneratedTests];
      setAllTests(allTests);
      addLog(`Stress testing with ${allTests.length} scenarios...`, 'info');

      // 4. Test & Repair Loop
      let iterations = 0;
      const MAX_ITERATIONS = 5;
      let allPassed = false;
      let bestCode = currentCode;
      let maxPassedCount = -1;
      let bestTestResults: any[] = [];

      while (!allPassed && iterations < MAX_ITERATIONS) {
        iterations++;
        addLog(`Validation Cycle ${iterations}: Executing code...`, 'ai');

        const response = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: currentCode, language: language, testCases: allTests }),
        });
        
        const { results } = await response.json();
        setTestResults(results);
        
        const passedCount = results.filter((r: any) => r.passed).length;
        if (passedCount > maxPassedCount) {
          maxPassedCount = passedCount;
          bestCode = currentCode;
          bestTestResults = results;
        }
        
        const failed = results.filter((r: any) => !r.passed);
        if (failed.length === 0) {
          allPassed = true;
          setTelemetryTab('logs');
          addLog('All validation cycles passed. Integrity confirmed.', 'success');
        } else {
          setStep('debugging');
          setTelemetryTab('errors');
          addLog(`${failed.length} anomalies detected. Initiating self-repair protocols...`, 'error');
          
          if (iterations < MAX_ITERATIONS) {
            const repairResponse = await debugAndRepair(problem, currentCode, failed, proMode);
            if (!repairResponse.data || repairResponse.data.trim() === '') {
              throw new Error('Self-repair generated empty code. Aborting.');
            }
            currentCode = repairResponse.data;
            if (repairResponse.reasoning) {
              addLog(`Reasoning: ${repairResponse.reasoning}`, 'ai');
            }
            setCode(currentCode);
            addLog('Repair successful. Re-verifying...', 'info');
          }
        }
      }

      if (!allPassed) {
        addLog(`Neural convergence incomplete. Returning best solution (${maxPassedCount}/${allTests.length} passed).`, 'error');
        currentCode = bestCode;
        setCode(currentCode);
        setTestResults(bestTestResults);
      }

      // 5. Optimize
      setStep('optimizing');
      addLog('Correctness verified. Commencing performance optimization...', 'ai');
      const optimizeResponse = await optimizeCode(problem, currentCode, proMode);
      const optimizedCode = optimizeResponse.data;
      if (optimizeResponse.reasoning) {
        addLog(`Reasoning: ${optimizeResponse.reasoning}`, 'ai');
      }
      setCode(optimizedCode);
      addLog('Optimization complete. Finalizing solution...', 'success');

      setStep('completed');
      addLog('ZEROTH AI: MISSION ACCOMPLISHED', 'success');
    } catch (err: any) {
      setStep('failed');
      addLog(`CRITICAL FAILURE: ${err.message}`, 'error');
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden selection:bg-emerald-500/30">
      <div className="atmosphere" />
      
      {/* Premium Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 px-8 py-6 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <motion.div 
            initial={{ rotate: -45, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.4)]"
          >
            <Zap className="text-black w-6 h-6 fill-current" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-display italic font-semibold tracking-tight text-white glow-text">Zeroth AI</h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold">Autonomous Intelligence Unit</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6 pointer-events-auto">
          <div className="hidden md:flex items-center gap-8 text-[10px] uppercase tracking-widest font-bold text-zinc-500">
            <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setProMode(!proMode)}>
              <span className={`transition-colors ${proMode ? 'text-cyan-400' : 'text-zinc-500'}`}>PRO MODE</span>
              <div className={`w-8 h-4 rounded-full relative transition-colors ${proMode ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-zinc-800 border-zinc-700'} border`}>
                <motion.div 
                  animate={{ x: proMode ? 16 : 0 }}
                  className={`absolute top-0.5 left-0.5 w-2.5 h-2.5 rounded-full ${proMode ? 'bg-cyan-500' : 'bg-zinc-600'}`}
                />
              </div>
            </div>
            <span className="hover:text-emerald-400 cursor-pointer transition-colors">Documentation</span>
            <span className="hover:text-emerald-400 cursor-pointer transition-colors">Benchmarks</span>
          </div>
          <div className="h-8 w-[1px] bg-white/10 hidden md:block" />
          <div className="px-4 py-2 rounded-full glass-panel flex items-center gap-3 border-emerald-500/20">
            <Activity className="w-3 h-3 text-emerald-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">{step}</span>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-12 px-8 max-w-[1600px] mx-auto flex flex-col gap-8 min-h-[calc(100vh-80px)] h-auto">
        
        {/* Pipeline Visualizer */}
        <div className="flex flex-col gap-4 shrink-0">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full relative py-8 px-12"
          >
            {/* Background Track */}
            <div className="absolute top-1/2 left-12 right-12 h-6 bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-full border border-white/10 shadow-inner -translate-y-1/2 z-0 overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1vcGFjaXR5PSIwLjA1IiBmaWxsPSJub25lIj48cGF0aCBkPSJNMCA0MGw0MC00ME0tMTAgMTBsMjAtMjBNMzAgNTBsMjAtMjAiLz48L2c+PC9zdmc+')] opacity-20" />
            </div>
            
            {/* Active Progress Line */}
            <motion.div 
              className="absolute top-1/2 left-12 h-6 bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.6)] -translate-y-1/2 z-0 origin-left overflow-hidden"
              initial={{ scaleX: 0 }}
              animate={{ 
                scaleX: step === 'idle' ? 0 : 
                        step === 'failed' ? 1 :
                        step === 'completed' ? 1 : 
                        Math.max(0, PIPELINE_STEPS.findIndex(s => s.id === step)) / (PIPELINE_STEPS.length - 1) 
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              style={{ width: 'calc(100% - 6rem)' }}
            >
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGcgc3Ryb2tlPSIjZmZmIiBzdHJva2Utd2lkdGg9IjEiIHN0cm9rZS1vcGFjaXR5PSIwLjIiIGZpbGw9Im5vbmUiPjxwYXRoIGQ9Ik0wIDQwbDQwLTQwTS0xMCAxMGwyMC0yME0zMCA1MGwyMC0yMCIvPjwvZz48L3N2Zz4')] opacity-50" />
              <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
            </motion.div>

            <div className="relative z-10 flex justify-between items-center">
              {PIPELINE_STEPS.map((s, i) => {
                const currentIndex = PIPELINE_STEPS.findIndex(x => x.id === step);
                const isActive = step === s.id;
                const isPast = currentIndex > i || step === 'completed';
                const isFailed = step === 'failed';
                
                return (
                  <div key={s.id} className="flex flex-col items-center gap-4 relative">
                    {/* Glowing ring for active state */}
                    {isActive && !isFailed && (
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-cyan-500/20 blur-xl animate-pulse" />
                    )}
                    
                    {/* Icon Container */}
                    <div className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all duration-500 z-10 ${
                      isActive && !isFailed ? 'bg-gradient-to-b from-cyan-400 to-cyan-600 shadow-[0_0_30px_rgba(34,211,238,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] scale-110 border-2 border-cyan-200' : 
                      isPast && !isFailed ? 'bg-gradient-to-b from-zinc-300 to-zinc-500 shadow-[inset_0_2px_4px_rgba(255,255,255,0.6)] border border-zinc-400' : 
                      isFailed && isActive ? 'bg-gradient-to-b from-red-500 to-red-700 shadow-[0_0_30px_rgba(239,68,68,0.6),inset_0_2px_4px_rgba(255,255,255,0.4)] scale-110 border-2 border-red-300' :
                      'bg-gradient-to-b from-zinc-700 to-zinc-800 shadow-[inset_0_2px_4px_rgba(255,255,255,0.1)] border border-zinc-600'
                    }`}>
                      {/* Inner metallic ring */}
                      <div className={`absolute inset-1 rounded-full border ${
                        isActive && !isFailed ? 'border-cyan-300/50' :
                        isPast && !isFailed ? 'border-white/30' :
                        isFailed && isActive ? 'border-red-300/50' :
                        'border-black/50'
                      }`} />
                      
                      <s.icon className={`w-6 h-6 relative z-10 transition-colors duration-500 ${
                        isActive && !isFailed ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' : 
                        isPast && !isFailed ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' : 
                        isFailed && isActive ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]' :
                        'text-zinc-500 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
                      }`} />
                    </div>
                    
                    {/* Labels */}
                    <div className="flex flex-col items-center absolute top-[110%] w-32 text-center">
                      <span className={`text-[11px] font-bold tracking-wider transition-colors duration-500 ${
                        isActive && !isFailed ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]' : 
                        isPast && !isFailed ? 'text-zinc-300' : 
                        isFailed && isActive ? 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]' :
                        'text-zinc-500'
                      }`}>
                        {s.label}
                      </span>
                      {s.subLabel && (
                        <span className={`text-[9px] font-medium tracking-widest mt-0.5 transition-colors duration-500 ${
                          isActive && !isFailed ? 'text-cyan-500/80' : 
                          isPast && !isFailed ? 'text-zinc-500' : 
                          isFailed && isActive ? 'text-red-500/80' :
                          'text-zinc-600'
                        }`}>
                          {s.subLabel}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>

          {/* Collapsible Analysis Panel */}
          <AnimatePresence>
            {analysis && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="glass-panel p-6 bg-emerald-500/[0.02] border-emerald-500/20">
                  <div className="flex items-start gap-6">
                    <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 shrink-0">
                      <Cpu className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div className="flex-1 space-y-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-widest">{analysis.title}</h3>
                          {analysis.difficulty && (
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest ${
                              analysis.difficulty.toLowerCase() === 'hard' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                              analysis.difficulty.toLowerCase() === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {analysis.difficulty}
                            </span>
                          )}
                        </div>
                        <p className="text-zinc-400 text-xs leading-relaxed">{analysis.complexityGoal}</p>
                      </div>
                      
                      {analysis.algorithm && (
                        <>
                          <div className="h-[1px] bg-emerald-500/10" />
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-1">Algorithm</h4>
                              <p className="text-xs text-zinc-300 font-mono">{analysis.algorithm}</p>
                            </div>
                            <div>
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-1">Time Complexity</h4>
                              <p className="text-xs text-zinc-300 font-mono">{analysis.timeComplexity}</p>
                            </div>
                            <div>
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-1">Space Complexity</h4>
                              <p className="text-xs text-zinc-300 font-mono">{analysis.spaceComplexity}</p>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="h-[1px] bg-emerald-500/10" />
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60 mb-2">Constraints & Edge Cases</h4>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {analysis.constraints.map((constraint, i) => (
                            <li key={i} className="flex items-start gap-2 text-[11px] text-zinc-300">
                              <span className="text-emerald-500 mt-0.5">›</span>
                              {constraint}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 overflow-hidden">
          
          {/* Left Wing: Input & Analysis */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 overflow-hidden">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel p-8 flex flex-col gap-6 flex-1 overflow-hidden relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <Terminal className="w-4 h-4 text-emerald-500" />
                </div>
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Problem Input</h2>
              </div>
              <div className="flex items-center gap-3">
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  disabled={step !== 'idle' && step !== 'completed' && step !== 'failed'}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-400 outline-none focus:border-emerald-500/50 transition-colors"
                >
                  <option value="python" className="bg-zinc-900 text-zinc-300">Python</option>
                  <option value="cpp" className="bg-zinc-900 text-zinc-300">C++</option>
                  <option value="java" className="bg-zinc-900 text-zinc-300">Java</option>
                </select>
                <button
                  onClick={handleAnalyzeAlgorithm}
                  disabled={!problem.trim() || isAnalyzingAlgorithm}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-zinc-400 hover:text-white text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                  title="Get Algorithm Strategy"
                >
                  {isAnalyzingAlgorithm ? <Loader2 className="w-3 h-3 animate-spin text-emerald-500" /> : <Lightbulb className="w-3 h-3" />}
                  Strategy
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden relative z-10">
              <textarea
                className="w-full flex-1 premium-input rounded-2xl p-6 text-sm leading-relaxed outline-none custom-scrollbar resize-none font-sans"
                placeholder="Describe the challenge..."
                value={problem}
                onChange={(e) => setProblem(e.target.value)}
                disabled={step !== 'idle' && step !== 'completed' && step !== 'failed'}
              />
              
              <div className="h-[1px] bg-white/5" />

              <div className="flex items-center gap-3 mb-1">
                <div className="p-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                  <Layers className="w-3 h-3 text-emerald-500" />
                </div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Sample Vectors</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Input</span>
                  <textarea
                    className="w-full h-32 premium-input rounded-xl p-4 text-xs font-mono outline-none custom-scrollbar resize-none text-emerald-500/80"
                    placeholder="Sample Input"
                    value={sampleInput}
                    onChange={(e) => setSampleInput(e.target.value)}
                    disabled={step !== 'idle' && step !== 'completed' && step !== 'failed'}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500">Expected Output</span>
                  <textarea
                    className="w-full h-32 premium-input rounded-xl p-4 text-xs font-mono outline-none custom-scrollbar resize-none text-emerald-500/80"
                    placeholder="Sample Output"
                    value={sampleOutput}
                    onChange={(e) => setSampleOutput(e.target.value)}
                    disabled={step !== 'idle' && step !== 'completed' && step !== 'failed'}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={runAgent}
              disabled={step !== 'idle' && step !== 'completed' && step !== 'failed'}
              className="group relative w-full py-5 bg-emerald-500 text-black rounded-2xl font-bold uppercase tracking-widest text-xs overflow-hidden transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 shadow-[0_0_40px_rgba(16,185,129,0.2)] z-10"
            >
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              <span className="relative flex items-center justify-center gap-3">
                {step === 'idle' || step === 'completed' || step === 'failed' ? (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    Initiate Autonomous Sequence
                  </>
                ) : (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing Neural Cycles
                  </>
                )}
              </span>
            </button>
          </motion.div>
        </div>

        {/* Center Wing: Code & Terminal */}
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 overflow-hidden min-h-[700px]">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`glass-panel flex flex-col gap-4 overflow-hidden transition-all duration-500 ${isExpanded ? 'flex-[3]' : 'flex-1'}`}
          >
            <div className="px-8 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-4">
                <Code2 className="w-4 h-4 text-emerald-500" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Neural Synthesis Output</h2>
                <div className="relative group cursor-help">
                  <div className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1.5 transition-colors hover:bg-emerald-500/20">
                    <Cpu className="w-3 h-3" />
                    Python 3.12
                  </div>
                  
                  {/* Tooltip */}
                  <div className="absolute top-full left-0 mt-2 w-64 p-4 rounded-xl bg-[#0a0a0a] border border-white/10 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-3 h-3 text-emerald-500" />
                      Execution Environment
                    </h3>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Runtime:</span>
                        <span className="text-emerald-400">Python 3.12.2</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Sandbox:</span>
                        <span className="text-emerald-400">Isolated Subprocess</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Time Limit:</span>
                        <span className="text-emerald-400">2.0s</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Memory Limit:</span>
                        <span className="text-emerald-400">256 MB</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500">Network:</span>
                        <span className="text-red-400">Disabled</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button 
                  onClick={handleValidate}
                  disabled={!code || isValidating || isExplaining || isReviewing}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white disabled:opacity-30"
                  title="Stress Test / Validate"
                >
                  {isValidating ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <ShieldCheck className="w-4 h-4" />}
                </button>
                <button 
                  onClick={handleReviewCode}
                  disabled={!code || isExplaining || isValidating || isReviewing}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white disabled:opacity-30"
                  title="AI Code Review"
                >
                  {isReviewing ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <Bug className="w-4 h-4" />}
                </button>
                <button 
                  onClick={handleExplain}
                  disabled={!code || isExplaining || isValidating || isReviewing}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white disabled:opacity-30"
                  title="Explain Code"
                >
                  {isExplaining ? <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> : <FileText className="w-4 h-4" />}
                </button>
                <button 
                  onClick={handleCopy}
                  disabled={!code}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white disabled:opacity-30"
                  title="Copy Code"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-[#0a0a0a]/80 m-4 rounded-xl border border-white/5 shadow-inner">
              <div className="absolute top-0 left-0 w-full h-full p-6 overflow-auto custom-scrollbar font-mono text-sm leading-relaxed text-zinc-300">
                {code ? (
                  <pre className="whitespace-pre-wrap">
                    <code className="block">
                      {code.split('\n').map((line, i) => (
                        <div key={i} id={`code-line-${i + 1}`} className="flex gap-6 group hover:bg-white/[0.02] px-2 -mx-2 rounded transition-colors">
                          <span className="w-8 text-right text-zinc-700 select-none group-hover:text-zinc-500 transition-colors">{i + 1}</span>
                          <span className={line.trim().startsWith('#') ? 'text-zinc-500 italic' : 'text-emerald-400/90'}>{line}</span>
                        </div>
                      ))}
                    </code>
                  </pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center gap-4 text-zinc-700">
                    <div className="w-12 h-12 rounded-full border-2 border-dashed border-zinc-800 animate-spin" />
                    <p className="text-xs uppercase tracking-widest font-bold">Awaiting Input Signal</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Bottom Grid: Logs & Results */}
          <div className="h-64 shrink-0 grid grid-cols-12 gap-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="col-span-7 glass-panel p-6 flex flex-col gap-4 overflow-hidden relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex items-center gap-6 relative z-10 border-b border-white/5 pb-2">
                <button 
                  onClick={() => setTelemetryTab('logs')}
                  className={`flex items-center gap-3 pb-2 -mb-[9px] border-b-2 transition-colors ${telemetryTab === 'logs' ? 'border-emerald-500 text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-400'}`}
                >
                  <div className={`p-1.5 rounded-lg ${telemetryTab === 'logs' ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}`}>
                    <History className={`w-3.5 h-3.5 ${telemetryTab === 'logs' ? 'text-emerald-500' : 'text-zinc-500'}`} />
                  </div>
                  <h2 className="text-[10px] font-bold uppercase tracking-widest">System Telemetry</h2>
                </button>
                <button 
                  onClick={() => setTelemetryTab('errors')}
                  className={`flex items-center gap-3 pb-2 -mb-[9px] border-b-2 transition-colors ${telemetryTab === 'errors' ? 'border-red-500 text-zinc-300' : 'border-transparent text-zinc-500 hover:text-zinc-400'}`}
                >
                  <div className={`p-1.5 rounded-lg ${telemetryTab === 'errors' ? 'bg-red-500/10 border border-red-500/20' : ''}`}>
                    <AlertTriangle className={`w-3.5 h-3.5 ${telemetryTab === 'errors' ? 'text-red-500' : 'text-zinc-500'}`} />
                  </div>
                  <h2 className="text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    Error Logs
                    {testResults.filter(r => !r.passed).length > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-500 text-[8px]">{testResults.filter(r => !r.passed).length}</span>
                    )}
                  </h2>
                </button>
              </div>
              
              <div className="flex-1 overflow-auto custom-scrollbar font-mono text-[10px] pr-2 relative z-10">
                {telemetryTab === 'logs' ? (
                  <div className="space-y-2">
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-4 items-start group/log">
                        <span className="text-zinc-700 shrink-0 font-bold group-hover/log:text-zinc-500 transition-colors">{log.timestamp}</span>
                        <span className={`leading-relaxed ${
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'success' ? 'text-emerald-400' :
                          log.type === 'ai' ? 'text-blue-400 italic' :
                          'text-zinc-400'
                        }`}>
                          <span className="text-zinc-800 mr-2">›</span>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={terminalEndRef} />
                  </div>
                ) : contestMode ? (
                  <div className="h-full flex flex-col items-center justify-center text-amber-500/50 gap-2 pt-8">
                    <Zap className="w-6 h-6 text-amber-500/30" />
                    <span className="uppercase tracking-widest font-bold text-[9px]">Error Logs Hidden in Contest Mode</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {testResults.filter(r => !r.passed).length > 0 ? (
                      testResults.filter(r => !r.passed).map((res, i) => (
                        <div key={i} className="p-3 rounded-lg bg-red-500/5 border border-red-500/10 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-red-400 font-bold uppercase tracking-widest text-[9px]">Failed Test Case</span>
                            {res.error && <span className="text-red-500/60 text-[8px] uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded">Crash / Exception</span>}
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <span className="text-zinc-500 uppercase tracking-widest text-[8px] block mb-1">Input</span>
                              <div className="bg-black/40 p-2 rounded border border-white/5 text-zinc-300 break-all">{res.input}</div>
                            </div>
                            <div>
                              <span className="text-zinc-500 uppercase tracking-widest text-[8px] block mb-1">Expected</span>
                              <div className="bg-black/40 p-2 rounded border border-white/5 text-emerald-500/80 break-all">{res.expectedOutput}</div>
                            </div>
                          </div>
                          <div>
                            <span className="text-zinc-500 uppercase tracking-widest text-[8px] block mb-1">Actual Output / Error</span>
                            <ErrorLogDisplay errorText={res.error || res.actualOutput} />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-2 pt-8">
                        <CheckCircle2 className="w-6 h-6 text-zinc-700" />
                        <span className="uppercase tracking-widest font-bold">No Errors Detected</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="col-span-5 glass-panel p-6 flex flex-col gap-4 relative group"
            >
              <div className="absolute inset-0 bg-gradient-to-bl from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <Activity className="w-4 h-4 text-emerald-500" />
                  </div>
                  <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Validation Matrix</h2>
                </div>
                <div className="flex items-center gap-3">
                  {allTests.length > 0 && !contestMode && (
                    <button 
                      onClick={() => setShowTestLibrary(true)}
                      className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20"
                    >
                      <Layers className="w-3 h-3" />
                      Test Library ({allTests.length})
                    </button>
                  )}
                  <div className="text-[10px] font-bold text-zinc-500 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                    {contestMode ? (
                      <span className="text-amber-500">CONTEST ACTIVE</span>
                    ) : testResults.length > 0 ? (
                      <span className={testResults.every(r => r.passed) ? 'text-emerald-500' : 'text-amber-500'}>
                        {testResults.filter(r => r.passed).length}/{testResults.length} PASSED
                      </span>
                    ) : (
                      '0/0 PASSED'
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex-1 grid grid-cols-4 gap-3 overflow-auto custom-scrollbar pr-2 relative z-10">
                {contestMode ? (
                  <div className="col-span-4 h-full flex flex-col items-center justify-center border border-dashed border-amber-500/30 rounded-xl bg-amber-500/5">
                    <Zap className="w-6 h-6 text-amber-500 mb-2" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-amber-500">Hidden in Contest Mode</span>
                    <span className="text-[12px] font-bold text-amber-400 mt-2 font-mono">{formatTime(contestTime)}</span>
                  </div>
                ) : testResults.length > 0 ? (
                  testResults.map((res, i) => (
                    <button 
                      key={i} 
                      onClick={() => setShowTestLibrary(true)}
                      className={`h-12 rounded-xl border flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
                        res.passed 
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:bg-emerald-500/20' 
                          : 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:bg-red-500/20'
                      }`}
                    >
                      {res.passed ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </button>
                  ))
                ) : (
                  <div className="col-span-4 h-full flex flex-col items-center justify-center border border-dashed border-zinc-800 rounded-xl bg-black/20">
                    <Activity className="w-6 h-6 text-zinc-800 mb-2" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-700">Awaiting Data</span>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
        </div>
      </main>

      {/* Cinematic Footer */}
      <footer className="fixed bottom-0 left-0 w-full px-8 py-4 flex items-center justify-between bg-gradient-to-t from-black to-transparent pointer-events-none">
        <div className="flex items-center gap-8 pointer-events-auto">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Core: Online</span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full ${proMode ? 'bg-cyan-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-zinc-800'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Pro Mode: {proMode ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-zinc-800" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Sandbox: Docker Container</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4 pointer-events-auto">
          <button
            onClick={() => setContestMode(!contestMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              contestMode ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'bg-white/5 text-zinc-500 hover:text-zinc-400 border border-white/5'
            }`}
          >
            <Zap className="w-3 h-3" />
            Contest Mode
          </button>
          <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">v2.4.0-Neural</div>
          <div className="h-4 w-[1px] bg-white/10" />
          <Share2 className="w-4 h-4 text-zinc-600 hover:text-white cursor-pointer transition-colors" />
        </div>
      </footer>

      {/* Explanation Modal */}
      <AnimatePresence>
        {showExplanation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-3xl max-h-[80vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <FileText className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Neural Logic Explanation</h2>
                </div>
                <button 
                  onClick={() => setShowExplanation(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-8 custom-scrollbar">
                {isExplaining ? (
                  <div className="h-full flex flex-col items-center justify-center gap-6 py-12">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                    <p className="text-xs uppercase tracking-[0.3em] font-bold text-zinc-500 animate-pulse">Deconstructing Logic Gates</p>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none">
                    <div className="text-zinc-300 leading-relaxed space-y-4 font-sans text-sm">
                      {explanation.split('\n').map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-8 py-4 bg-white/[0.01] border-t border-white/5 flex justify-end">
                <button 
                  onClick={() => setShowExplanation(false)}
                  className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Test Library Modal */}
      <AnimatePresence>
        {showTestLibrary && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="glass-panel w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <Layers className="w-5 h-5 text-emerald-500" />
                  <h2 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Neural Test Library</h2>
                </div>
                <button 
                  onClick={() => setShowTestLibrary(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-500 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-auto p-8 custom-scrollbar space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {allTests.map((test, i) => {
                    const result = testResults.find(r => r.input === test.input && r.expectedOutput === test.expectedOutput);
                    return (
                    <div key={i} className={`glass-panel p-6 bg-white/[0.01] flex flex-col gap-4 transition-colors ${result ? (result.passed ? 'border-emerald-500/30' : 'border-red-500/30') : 'border-white/5'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/60">Vector #{i + 1}</span>
                          {result && (
                            <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${result.passed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                              {result.passed ? 'Passed' : 'Failed'}
                            </span>
                          )}
                        </div>
                        <span className="text-[8px] font-bold uppercase tracking-tighter text-zinc-600 px-2 py-0.5 rounded border border-white/5">{test.description}</span>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-[8px] uppercase font-bold text-zinc-500 mb-1 tracking-widest">Input</p>
                          <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-zinc-300 border border-white/5 break-all">
                            {test.input}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-[8px] uppercase font-bold text-zinc-500 mb-1 tracking-widest">Expected Output</p>
                            <div className="bg-black/40 rounded-lg p-3 font-mono text-xs text-emerald-500/80 border border-white/5 break-all h-full">
                              {test.expectedOutput}
                            </div>
                          </div>
                          <div>
                            <p className="text-[8px] uppercase font-bold text-zinc-500 mb-1 tracking-widest">Actual Output</p>
                            <div className={`bg-black/40 rounded-lg p-3 font-mono text-xs border border-white/5 break-all h-full ${result ? (result.passed ? 'text-emerald-500/80' : 'text-red-500/80') : 'text-zinc-500'}`}>
                              {result ? (result.error ? `Error: ${result.error}` : (result.actualOutput || '')) : 'Pending...'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>

              <div className="px-8 py-4 bg-white/[0.01] border-t border-white/5 flex justify-end">
                <button 
                  onClick={() => setShowTestLibrary(false)}
                  className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-colors"
                >
                  Close Library
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Chatbot />
    </div>
  );
}
