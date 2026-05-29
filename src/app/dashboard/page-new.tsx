'use client';
 
 import { useState, useEffect } from 'react';
 import { ProtectedRoute } from '@/components/ProtectedRoute';
 import { Navigation } from '@/components/Navigation';
 import { useAuth } from '@/context/AuthContext';
 import { useCredits } from '@/hooks/useCredits';
 import DragDropUpload from '@/components/DragDropUpload';
import { DomainSection } from '@/components/DomainSection';
 import PDFConverter from '@/components/PDFConverter';
 
 interface SummaryItem {
   id: string;
   fileName: string;
   date: string;
   wordCount: number;
   summaryLength: number;
   audioUrl?: string;
   videoUrl?: string;
 }
 
 export default function DashboardPage() {
   const { user } = useAuth();
   const { credits, loading: creditsLoading, deductCredit } = useCredits(user?.id);
   const [isProcessing, setIsProcessing] = useState(false);
   const [processingFile, setProcessingFile] = useState<string>('');
   const [processingProgress, setProcessingProgress] = useState(0);
   const [uploadError, setUploadError] = useState<string>('');
  const [domains, setDomains] = useState<string[]>([]);
   const [summaries, setSummaries] = useState<SummaryItem[]>([
    // initial summaries

     { id: '1', fileName: 'Q4_Financial_Report.pdf', date: 'Mar 15, 2026', wordCount: 2847, summaryLength: 412 },
     { id: '2', fileName: 'Product_Strategy_2026.pdf', date: 'Mar 10, 2026', wordCount: 3521, summaryLength: 589 },
     { id: '3', fileName: 'Annual_Review_Summary.pdf', date: 'Mar 5, 2026', wordCount: 1956, summaryLength: 287 },
   ]);
 
   const handleFileSelect = async (file: File) => {

     setUploadError('');
     if ((credits ?? 0) < 1) {
       setUploadError('Insufficient credits. Please upgrade your plan to continue.');
       return;
     }
 
     setProcessingFile(file.name);
     setIsProcessing(true);
     setProcessingProgress(0);
 
     // UX-only simulated progress while API runs
     const progressInterval = setInterval(() => {
       setProcessingProgress((p) => Math.min(95, p + Math.floor(Math.random() * 10) + 5));
     }, 600);
 
     try {
       const formData = new FormData();
       formData.append('pdf', file);
       formData.append('userId', user?.id || '');
 
       const response = await fetch('/api/summarize', { method: 'POST', body: formData });
 
       if (response.status === 402) {
         clearInterval(progressInterval);
         setUploadError('Insufficient credits. Please upgrade your plan.');
         setIsProcessing(false);
         setProcessingFile('');
         setProcessingProgress(0);
         return;
       }
 
       if (!response.ok) {
         clearInterval(progressInterval);
         const err = await response.json().catch(() => ({}));
         throw new Error(err.error || 'Failed to summarize document');
       }
 
       const result = await response.json();
 
       clearInterval(progressInterval);
       setProcessingProgress(100);
 
       await deductCredit(1);
 
       const newSummary: SummaryItem = {
         id: Date.now().toString(),
         fileName: file.name,
         date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
         wordCount: result.textLength ?? 0,
         summaryLength: (result.summary || '').split(' ').filter(Boolean).length,
       };
 
       setSummaries((s) => [newSummary, ...s]);
       setIsProcessing(false);
       setProcessingFile('');
       setProcessingProgress(0);
     } catch (error: any) {
       clearInterval(progressInterval);
       console.error('Upload error:', error);
       setUploadError(error?.message || 'Failed to process document');
       setIsProcessing(false);
       setProcessingFile('');
       setProcessingProgress(0);
     }
   };
 
   return (
     <ProtectedRoute>
       <Navigation />
       <main className="min-h-screen bg-gradient-to-b from-background via-background-secondary to-background">
         {/* Hero */}
         <section className="section-container mt-12">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
             <div className="lg:col-span-2 glass-lg p-8 animate-fade-in-up">
               <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                 <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent-gold to-accent-neon-blue flex items-center justify-center text-3xl
 font-serif font-bold text-black">
                   {user?.name?.charAt(0).toUpperCase() || 'U'}
                 </div>
                 <div>
                   <h1 className="text-4xl font-serif text-white mb-2 leading-tight">
                     Welcome back, <span className="text-accent-gold">{user?.name?.split(' ')[0] || 'User'}</span>
                   </h1>
                   <p className="text-foreground-secondary text-lg">Transform your documents into actionable insights</p>
                 </div>
               </div>
 
               <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-4">
                 <div className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-accent-gold/50 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-accent-gold/10">
                   <p className="text-foreground-secondary text-sm mb-1">Documents Analyzed</p>
                   <p className="text-2xl font-serif font-bold text-accent-gold">{summaries.length}</p>
                 </div>
                 <div className="p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-accent-neon-blue/50 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-accent-neon-blue/10">
                   <p className="text-foreground-secondary text-sm mb-1">Credits Used</p>
                   <p className="text-2xl font-serif font-bold text-accent-neon-blue">{summaries.length}</p>
                 </div>
                 <div className="p-4 bg-white/5 border border-white/10 rounded-lg col-span-2 sm:col-span-1 hover:bg-white/10 hover:border-accent-gold/50 transition-all duration-300 cursor-pointer hover:shadow-lg hover:shadow-accent-gold/10">
                   <p className="text-foreground-secondary text-sm mb-1">Remaining</p>
                   <p className="text-2xl font-serif font-bold text-accent-gold">{creditsLoading ? '...' : credits}</p>
                 </div>
               </div>
             </div>
 
             <div className="glass-lg p-8 animate-fade-in-up hover:shadow-xl hover:shadow-accent-gold/20 transition-all duration-300" style={{ animationDelay: '0.1s' }}>
               <h3 className="text-lg font-serif text-white mb-6 group flex items-center gap-2">
                 <span className="inline-block group-hover:animate-spin">🎯</span> Plan Overview
               </h3>
               <div className="space-y-4">
                 <div className="flex justify-between items-center group cursor-pointer">
                   <span className="text-foreground-secondary group-hover:text-white transition-colors">Trial Credits</span>
                   <span className="font-mono text-accent-gold font-bold group-hover:text-accent-neon-blue transition-colors">{credits}/2</span>
                 </div>
                 <div className="w-full bg-white/10 rounded-full h-2 hover:h-3 transition-all group cursor-pointer">
                   <div className="bg-gradient-to-r from-accent-gold to-accent-neon-blue h-full rounded-full transition-all group-hover:shadow-lg group-hover:shadow-accent-gold/40" style={{ width: `${((credits ?? 0) / 2) * 100}%` }} />
                 </div>
                 <p className="text-xs text-foreground-secondary group-hover:text-white transition-colors pt-2">Upgrade to Pro for unlimited documents</p>
                 <button className="w-full bg-gradient-to-r from-accent-gold to-accent-gold-light hover:from-accent-gold-light hover:to-accent-gold text-black font-bold py-2 px-4 rounded-lg transition-all duration-200 hover:shadow-xl hover:shadow-accent-gold/40 hover:-translate-y-0.5 active:translate-y-0 mt-4">View Plans</button>
               </div>
             </div>
           </div>
         </section>
 
         {/* Upload */}
         <section className="section-container mb-16">
           <div className="mb-6">
             <h2 className="text-2xl font-serif text-white mb-2">Start Summarizing</h2>
             <p className="text-foreground-secondary">Upload a new PDF to get started</p>
           </div>
           <DragDropUpload onFileSelect={handleFileSelect} isProcessing={isProcessing} />
           {uploadError && <p className="text-sm text-red-400 mt-3">{uploadError}</p>}
         </section>

         {/* PDF Converter Coming Soon */}
         <section className="section-container mb-16">
           <div className="mb-6">
             <h2 className="text-2xl font-serif text-white mb-2">Convert PDFs</h2>
             <p className="text-foreground-secondary">Convert your PDFs to multiple formats</p>
           </div>
           <div className="glass-lg p-12 text-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/8 transition-all duration-300">
             <div className="inline-block mb-6 p-4 bg-accent-gold/10 rounded-full">
               <span className="text-4xl">🔄</span>
             </div>
             <h3 className="text-2xl font-serif text-white mb-3">PDF Converter</h3>
             <p className="text-foreground-secondary text-lg mb-6 max-w-2xl mx-auto">
               Convert your PDFs to Text, JSON, CSV, HTML, Markdown, Word (DOCX), Excel (XLSX), and PowerPoint (PPTX) formats.
             </p>
             <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-accent-gold/20 to-accent-neon-blue/20 border border-accent-gold/50 rounded-lg">
               <span className="w-2 h-2 bg-accent-gold rounded-full animate-pulse"></span>
               <span className="font-medium text-accent-gold">Coming Soon</span>
             </div>
           </div>
         </section>
 
         {/* Processing State */}
         {isProcessing && (
           <section className="section-container mb-16">
             <div className="glass-lg p-12 text-center animate-fade-in-up">
               <div className="flex justify-center mb-12">
                 <div className="relative w-32 h-32">
                   <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-accent-gold border-r-accent-neon-blue 
 animate-spin" />
                   <div className="absolute inset-4 rounded-full border-2 border-accent-gold/30 animate-pulse" />
                   <div className="absolute inset-6 rounded-full bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20" />
                   <div className="absolute inset-0 flex items-center justify-center">
                     <div className="w-4 h-4 rounded-full bg-accent-gold animate-pulse" />
                   </div>
                 </div>
               </div>
 
               <h3 className="text-3xl font-serif text-white mb-3">Analyzing Your Document</h3>
               <p className="text-foreground-secondary mb-8 text-lg font-mono">{processingFile}</p>
 
               <div className="max-w-md mx-auto mb-8">
                 <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden mb-2">
                   <div className="bg-gradient-to-r from-accent-gold via-accent-neon-blue to-accent-gold h-2 rounded-full transition-all duration-700" 
 style={{ width: `${processingProgress}%` }} />
                 </div>
                 <p className="text-xs text-foreground-secondary">{processingProgress}% complete</p>
               </div>
 
               <div className="space-y-3 text-left max-w-xl mx-auto">
                 <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 hover:border-accent-gold/30 transition-all">
                   <div className="w-8 h-8 rounded-full bg-accent-gold flex items-center justify-center text-black text-lg font-bold">✓</div>
                   <div className="flex-1">
                     <p className="text-white font-medium">Extracting content</p>
                     <p className="text-xs text-foreground-secondary">Reading PDF and identifying text</p>
                   </div>
                 </div>
 
                 <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-accent-neon-blue/30 transition-all animate-pulse">
                   <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-neon-blue to-accent-gold flex items-center justify-center 
 text-black text-sm font-bold">⚡</div>
                   <div className="flex-1">
                     <p className="text-white font-medium">Processing with AI</p>
                     <p className="text-xs text-foreground-secondary">Analyzing and creating summary</p>
                   </div>
                 </div>
 
                 <div className="flex items-center gap-4 p-4 rounded-lg bg-white/5 border border-white/10 opacity-60">
                   <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">🎵</div>
                   <div className="flex-1">
                     <p className="text-white font-medium">Generating audio</p>
                     <p className="text-xs text-foreground-secondary">Converting text to speech</p>
                   </div>
                 </div>
               </div>
 
               <p className="text-xs text-foreground-secondary mt-8">Estimated time remaining: ~30 seconds</p>
             </div>
           </section>
         )}
 
         {/* Project Gallery */}
         <section className="section-container pb-16">
           <div className="mb-10">
             <h2 className="text-3xl font-serif text-white mb-2">Your Document Library</h2>
             <p className="text-foreground-secondary text-lg">
               {summaries.length} {summaries.length === 1 ? 'document' : 'documents'} summarized
             </p>
           </div>
 
           {summaries.length === 0 ? (
             <div className="glass-lg p-16 text-center">
               <div className="mb-6">
                 <svg className="w-16 h-16 mx-auto text-accent-gold/40 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" 
 width="18" height="16" rx="2" /></svg>
               </div>
               <p className="text-foreground-secondary text-lg">No documents yet. Upload your first PDF to start summarizing!</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {summaries.map((summary, index) => (
                 <div key={summary.id} className="group card glass-lg p-6 hover:shadow-2xl hover:shadow-accent-gold/20 hover:border-accent-gold/40 
 transition-all duration-300 animate-fade-in-up hover:-translate-y-1" style={{ animationDelay: `${index * 0.08}s` }}>
                   <div className="flex items-start justify-between mb-6">
                     <div className="flex-1">
                       <h3 className="font-serif text-xl text-white group-hover:text-accent-gold transition-colors line-clamp-2 
 mb-2">{summary.fileName.replace(/\.[^/.]+$/, '')}</h3>
                       <p className="text-sm text-foreground-secondary">{summary.date}</p>
                     </div>
                     <div className="w-12 h-12 rounded-full bg-gradient-to-br from-accent-gold/20 to-accent-neon-blue/20 flex items-center 
 justify-center flex-shrink-0">
                       <svg className="w-6 h-6 text-accent-gold" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"
  /></svg>
                     </div>
                   </div>
 
                   <div className="space-y-4 mb-6 pb-6 border-b border-white/10">
                     <div>
                       <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-medium text-foreground-secondary">Original Length</span>
                         <span className="text-sm font-mono font-bold text-accent-gold">{summary.wordCount.toLocaleString()}</span>
                       </div>
                       <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                         <div className="bg-accent-gold h-1.5 rounded-full" style={{ width: '100%' }} />
                       </div>
                     </div>
 
                     <div>
                       <div className="flex justify-between items-center mb-2">
                         <span className="text-xs font-medium text-foreground-secondary">Summary Length</span>
                         <span className="text-sm font-mono font-bold text-accent-neon-blue">{summary.summaryLength}</span>
                       </div>
                       <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                         <div className="bg-accent-neon-blue h-1.5 rounded-full" style={{ width: `${(summary.summaryLength / Math.max(1, 
 summary.wordCount)) * 100}%` }} />
                       </div>
                     </div>
 
                     <div className="flex items-center justify-between pt-2">
                       <span className="text-xs font-medium text-foreground-secondary">Compression</span>
                       <span className="text-sm font-mono font-bold text-accent-gold bg-accent-gold/10 px-3 py-1 
 rounded-full">{Math.round((summary.summaryLength / Math.max(1, summary.wordCount)) * 100)}%</span>
                     </div>
                   </div>
 
                   <div className="grid grid-cols-2 gap-3">
                     <button className="relative overflow-hidden bg-white/5 hover:bg-accent-gold hover:text-black border border-white/10 hover:border-accent-gold text-white py-2 px-3 rounded-lg font-medium text-sm transition-all duration-200 hover:shadow-lg hover:shadow-accent-gold/30 hover:-translate-y-0.5 active:translate-y-0 group">
                       <span className="relative z-10 flex items-center justify-center gap-1">
                         <span className="group-hover:scale-110 transition-transform">👁️</span>
                         View
                       </span>
                     </button>
                     <button className="relative overflow-hidden bg-white/5 hover:bg-accent-neon-blue hover:text-black border border-white/10 hover:border-accent-neon-blue text-white py-2 px-3 rounded-lg font-medium text-sm transition-all duration-200 hover:shadow-lg hover:shadow-accent-neon-blue/30 hover:-translate-y-0.5 active:translate-y-0 group">
                       <span className="relative z-10 flex items-center justify-center gap-1">
                         <span className="group-hover:scale-110 transition-transform">🎵</span>
                         Listen
                       </span>
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </section>
       </main>
     </ProtectedRoute>
   );
 }
