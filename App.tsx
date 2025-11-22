import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from "@google/genai";
import { decode, decodeAudioData, encode } from './utils';

import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import ReportsPage from './pages/ReportsPage';
import CommercialProposalsPage from './pages/CommercialProposalsPage';
import ComparePeriodsPage from './pages/ComparePeriodsPage';
import ConversionsPage from './pages/ConversionsPage';
import NetConversionsPage from './pages/NetConversionsPage';
import AdCampaignsPage from './pages/AdCampaignsPage';
import UnitEconomicsPage from './pages/UnitEconomicsPage';
import CloudStoragePage from './pages/CloudStoragePage';
import LoginPage from './pages/LoginPage';
import SettingsPage from './pages/SettingsPage';
import PaymentsPage from './pages/PaymentsPage';
import AIAssistantPage from './pages/AIAssistantPage';
import OtherReportsPage from './pages/OtherReportsPage';
import VoiceAssistantOverlay from './components/VoiceAssistantOverlay';
import { initialUserData, mockUser } from './services/mockData';
import { User, UserData } from './types';

import { 
  fetchFullUserData, 
  apiAddReport, apiUpdateReport, apiDeleteReport,
  apiAddProposal, apiUpdateProposal, apiDeleteProposal,
  apiAddCampaign, apiDeleteCampaign,
  apiAddOtherReport, apiUpdateOtherReport, apiDeleteOtherReport,
  apiAddPayment, apiUpdatePayment, apiDeletePayment,
  apiAddLink, apiDeleteLink,
  apiAddFile, apiDeleteFile,
  apiUpdateCompanyProfile
} from './services/api';

import Logo from './components/Logo';

// --- ИНСТРУМЕНТЫ ---
const navigationTool = {
    name: "navigateToPage",
    description: "Переходит на указанную страницу.",
    parameters: {
        type: "OBJECT",
        properties: { page: { type: "STRING" } },
        required: ["page"],
    },
};

const createProposalTool = {
    name: "createCommercialProposal",
    description: "Создает КП.",
    parameters: {
        type: "OBJECT",
        properties: {
            company: { type: "STRING" },
            item: { type: "STRING" },
            amount: { type: "NUMBER" },
            direction: { type: "STRING" },
        },
        required: ["company", "item", "amount"],
    },
};

const addMarketingIdeaTool = {
    name: "addMarketingIdea",
    description: "Сохраняет идею.",
    parameters: {
        type: "OBJECT",
        properties: {
            name: { type: "STRING" },
            budget: { type: "NUMBER" },
        },
        required: ["name"],
    },
};

const calculateMarginTool = {
    name: "calculateMargin",
    description: "Считает маржу.",
    parameters: {
        type: "OBJECT",
        properties: {
            costPrice: { type: "NUMBER" },
            salePrice: { type: "NUMBER" },
        },
        required: ["costPrice", "salePrice"],
    },
};

const App: React.FC = () => {
    const [userData, setUserData] = useState<UserData>(initialUserData);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState<boolean>(true);
    
    const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState<'idle' | 'greeting' | 'listening' | 'speaking'>('idle');
    const [liveUserTranscript, setLiveUserTranscript] = useState('');
    const [liveAiTranscript, setLiveAiTranscript] = useState('');

    const sessionRef = useRef<LiveSession | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const userTranscriptRef = useRef('');
    const aiTranscriptRef = useRef('');
    
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                const data = await fetchFullUserData();
                setUserData(data);
            } catch (error) { console.error(error); } 
            finally { setIsLoadingData(false); }
        };
        loadData();
    }, []);

    useEffect(() => { document.documentElement.classList.remove('dark'); }, [userData.companyProfile.darkModeEnabled]);

    useEffect(() => {
        const rememberedUserJSON = localStorage.getItem('rememberedUser');
        if (rememberedUserJSON) {
            try {
                const u = JSON.parse(rememberedUserJSON);
                if (u.email === mockUser.email) setCurrentUser({...mockUser});
            } catch (e) { localStorage.removeItem('rememberedUser'); }
        }
    }, []);

    const handleLogin = useCallback((e: string, p: string, r: boolean) => {
        if (e === mockUser.email && p === mockUser.password) {
            setCurrentUser({...mockUser});
            if(r) localStorage.setItem('rememberedUser', JSON.stringify({...mockUser}));
            else localStorage.removeItem('rememberedUser');
            return true;
        } return false;
    }, []);
    const handleLogout = useCallback(() => { setCurrentUser(null); localStorage.removeItem('rememberedUser'); }, []);
    
    const crudFunctions = useMemo(() => ({
        setReports: (u: any) => setUserData(p => ({ ...p, reports: typeof u === 'function' ? u(p.reports) : u })),
        addReport: async (i: any) => { const n = { ...i, id: uuidv4() }; await apiAddReport(n); setUserData(p => ({ ...p, reports: [n, ...p.reports] })); },
        updateReport: async (i: any) => { await apiUpdateReport(i); setUserData(p => ({ ...p, reports: p.reports.map(r => r.id === i.id ? i : r) })); },
        deleteReport: async (id: string) => { await apiDeleteReport(id); setUserData(p => ({ ...p, reports: p.reports.filter(r => r.id !== id) })); },
        addOtherReport: async (i: any) => { const n = { ...i, id: uuidv4() }; await apiAddOtherReport(n); setUserData(p => ({ ...p, otherReports: [n, ...p.otherReports] })); },
        updateOtherReport: async (i: any) => { await apiUpdateOtherReport(i); setUserData(p => ({ ...p, otherReports: p.otherReports.map(r => r.id === i.id ? i : r) })); },
        deleteOtherReport: async (id: string) => { await apiDeleteOtherReport(id); setUserData(p => ({ ...p, otherReports: p.otherReports.filter(r => r.id !== id) })); },
        setProposals: (u: any) => setUserData(p => ({ ...p, proposals: typeof u === 'function' ? u(p.proposals) : u })),
        addProposal: async (i: any) => { const n = { ...i, id: uuidv4() }; await apiAddProposal(n); setUserData(p => ({ ...p, proposals: [n, ...p.proposals] })); },
        updateProposal: async (i: any) => { await apiUpdateProposal(i); setUserData(p => ({ ...p, proposals: p.proposals.map(r => r.id === i.id ? i : r) })); },
        addMultipleProposals: async (l: any[]) => { const n = l.map(i => ({ ...i, id: uuidv4() })); for(const x of n) await apiAddProposal(x); setUserData(p => ({ ...p, proposals: [...n, ...p.proposals] })); },
        deleteProposal: async (id: string) => { await apiDeleteProposal(id); setUserData(p => ({ ...p, proposals: p.proposals.filter(r => r.id !== id) })); },
        setCampaigns: (u: any) => setUserData(p => ({ ...p, campaigns: typeof u === 'function' ? u(p.campaigns) : u })),
        addCampaign: async (i: any) => { const n = { ...i, id: uuidv4() }; await apiAddCampaign(n); setUserData(p => ({ ...p, campaigns: [n, ...p.campaigns] })); },
        addMultipleCampaigns: async (l: any[]) => { const n = l.map(i => ({ ...i, id: uuidv4() })); for(const x of n) await apiAddCampaign(x); setUserData(p => ({ ...p, campaigns: [...n, ...p.campaigns] })); },
        deleteCampaign: async (id: string) => { await apiDeleteCampaign(id); setUserData(p => ({ ...p, campaigns: p.campaigns.filter(r => r.id !== id) })); },
        addLink: async (i: any) => { const n = { ...i, id: uuidv4() }; await apiAddLink(n); setUserData(p => ({ ...p, links: [n, ...p.links] })); },
        deleteLink: async (id: string) => { await apiDeleteLink(id); setUserData(p => ({ ...p, links: p.links.filter(r => r.id !== id) })); },
        addFile: async (i: any) => { const n = { ...i, id: uuidv4() }; await apiAddFile(n); setUserData(p => ({ ...p, files: [n, ...p.files] })); return n; },
        deleteFile: async (id: string) => { await apiDeleteFile(id); setUserData(p => ({ ...p, files: p.files.filter(r => r.id !== id) })); },
        addPayment: async (i: any) => { const n = { ...i, id: uuidv4() }; await apiAddPayment(n); setUserData(p => ({ ...p, payments: [n, ...p.payments] })); },
        updatePayment: async (i: any) => { await apiUpdatePayment(i); setUserData(p => ({ ...p, payments: p.payments.map(r => r.id === i.id ? i : r) })); },
        deletePayment: async (id: string) => { await apiDeletePayment(id); setUserData(p => ({ ...p, payments: p.payments.filter(r => r.id !== id) })); },
        setCompanyProfile: async (i: any) => { await apiUpdateCompanyProfile(i); setUserData(p => ({ ...p, companyProfile: i })); },
        setAllUserData: (d: UserData) => { setUserData(d); },
    }), []);
    
    const navigate = useNavigate();
    const handleNavigation = (page: string) => { navigate(page); };

    // Функция остановки всего (Safety Stop)
    const stopEverything = useCallback(() => {
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current = null;
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }
        inputAudioContextRef.current?.close().catch(() => {});
        outputAudioContextRef.current?.close().catch(() => {});
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) {}
            sessionRef.current = null;
        }
        audioSourcesRef.current.forEach(source => { try { source.stop(); } catch(e){} });
        audioSourcesRef.current.clear();
        setIsVoiceControlActive(false);
        setIsConnecting(false);
        setVoiceStatus('idle');
    }, []);

    useEffect(() => { return () => stopEverything(); }, [stopEverything]);

    // --- ИСПРАВЛЕННАЯ ГЕНЕРАЦИЯ КОНТЕКСТА (ФИЛЬТРАЦИЯ ДАННЫХ) ---
    const generateContext = (data: UserData) => {
        const today = new Date().toLocaleDateString('ru-RU');
        
        // ОПТИМИЗАЦИЯ: Берем только последние данные, чтобы не превысить лимит токенов (131072)
        // и ОБЯЗАТЕЛЬНО убираем содержимое файлов, если оно есть.
        const optimizedDb = {
            // Берем последние 5 отчетов
            reports: data.reports.slice(0, 5).map(r => ({
                name: r.name, metrics: r.metrics
            })),
            // Берем последние 20 КП
            proposals: data.proposals.slice(0, 20).map(p => ({
                company: p.company, item: p.item, amount: p.amount, status: p.status, direction: p.direction
            })),
            // Кампании
            campaigns: data.campaigns.slice(0, 10).map(c => ({
                name: c.name, status: c.status, spend: c.spend
            })),
            // Файлы: ТОЛЬКО ИМЕНА. Никакого содержимого!
            storage: data.files.map(f => f.name), 
            // Ссылки
            links: data.links,
            // Платежи (последние 10)
            payments: data.payments.slice(0, 10)
        };

        return `
        SYSTEM_INSTRUCTION:
        DATE: ${today}
        ROLE: Lumi, Эксперт KZ TRANSIT (Инженер РТИ/3D, Маркетолог).
        LANG: PURE RUSSIAN (No accent).
        CONTEXT_DATA_JSON: ${JSON.stringify(optimizedDb)}
        USER_INSTRUCTION: ${data.companyProfile.aiSystemInstruction}
        `;
    };

    const connectToGemini = async () => {
        if (isConnecting) return;
        setIsConnecting(true);
        stopEverything();

        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) { alert("API Key not found"); setIsConnecting(false); return; }

        let isSessionActive = true;

        try {
            setIsVoiceControlActive(true);
            setVoiceStatus('greeting');
            setLiveUserTranscript('');
            setLiveAiTranscript('');
            userTranscriptRef.current = '';
            aiTranscriptRef.current = '';
            nextStartTimeRef.current = 0;

            const ai = new GoogleGenAI({ apiKey: apiKey });
            // Генерируем ОБЛЕГЧЕННЫЙ контекст
            const fullContext = generateContext(userData);

            const toolsArray: any[] = [
                { googleSearch: {} },
                { functionDeclarations: [navigationTool, createProposalTool, addMarketingIdeaTool, calculateMarginTool] }
            ];

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (!isSessionActive) { stream.getTracks().forEach(t => t.stop()); return; }
            mediaStreamRef.current = stream;

            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const inputContext = new AudioContextClass({ sampleRate: 16000 });
            await inputContext.resume();
            inputAudioContextRef.current = inputContext;

            const outputContext = new AudioContextClass({ sampleRate: 24000 });
            outputAudioContextRef.current = outputContext;

            const source = inputContext.createMediaStreamSource(stream);
            mediaStreamSourceRef.current = source;
            
            const processor = inputContext.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = processor;

            const sessionPromise = ai.live.connect({
                model: 'models/gemini-2.0-flash-exp',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                    systemInstruction: fullContext,
                    tools: toolsArray,
                },
                callbacks: {
                    onopen: () => {
                        if (!isSessionActive) return;
                        setVoiceStatus('listening');
                        setIsConnecting(false);
                        console.log("Lumi Connected");
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (!isSessionActive) return;

                        if (message.serverContent?.outputTranscription) {
                            setVoiceStatus('speaking');
                            aiTranscriptRef.current += message.serverContent.outputTranscription.text;
                            setLiveAiTranscript(aiTranscriptRef.current);
                        }
                        if (message.serverContent?.inputTranscription) {
                            userTranscriptRef.current += message.serverContent.inputTranscription.text;
                            setLiveUserTranscript(userTranscriptRef.current);
                        }
                        
                        if (message.toolCall) {
                            const functionResponses: any[] = [];
                            for (const fc of message.toolCall.functionCalls) {
                                let result: any = { result: "Ok" };
                                try {
                                    if (fc.name === 'navigateToPage') {
                                       handleNavigation(fc.args.page as string);
                                    } 
                                    else if (fc.name === 'createCommercialProposal') {
                                        const { company, item, amount, direction } = fc.args as any;
                                        let normDir: 'РТИ' | '3D' = (direction && direction.includes('3D')) ? '3D' : 'РТИ';
                                        crudFunctions.addProposal({
                                           date: new Date().toISOString().split('T')[0],
                                           direction: normDir,
                                           proposalNumber: `КП-${Math.floor(10000 + Math.random() * 90000)}`,
                                           company, item, amount, status: 'Ожидание', invoiceNumber: null, invoiceDate: null, paymentDate: null, paymentType: null,
                                        });
                                    }
                                    else if (fc.name === 'addMarketingIdea') {
                                        const { name, budget } = fc.args as any;
                                        crudFunctions.addCampaign({ name, status: 'Черновик', spend: budget || 0, clicks: 0, leads: 0, sales: 0 });
                                    }
                                    else if (fc.name === 'calculateMargin') {
                                        const { costPrice, salePrice } = fc.args as any;
                                        result = { result: `Margin: ${(((salePrice-costPrice)/salePrice)*100).toFixed(1)}%` };
                                    }
                                } catch(e) { result = { error: "Failed" }; }
                                functionResponses.push({ id: fc.id, name: fc.name, response: result });
                            }
                            if (functionResponses.length > 0 && isSessionActive) {
                                sessionRef.current?.sendToolResponse({ functionResponses }).catch(() => {});
                            }
                        }
                        
                        if (message.serverContent?.turnComplete) {
                            userTranscriptRef.current = '';
                            aiTranscriptRef.current = '';
                            setTimeout(() => { 
                                if(isSessionActive) {
                                    setLiveUserTranscript(''); 
                                    setLiveAiTranscript(''); 
                                    setVoiceStatus('listening'); 
                                }
                            }, 2000);
                        }
                        
                        const modelTurn = message.serverContent?.modelTurn;
                        if (modelTurn?.parts) {
                            for (const part of modelTurn.parts) {
                                const base64Audio = part.inlineData?.data;
                                if (base64Audio && outputAudioContextRef.current) {
                                    const outCtx = outputAudioContextRef.current;
                                    const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                                    const now = outCtx.currentTime;
                                    if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
                                    const source = outCtx.createBufferSource();
                                    source.buffer = audioBuffer;
                                    source.connect(outCtx.destination);
                                    source.start(nextStartTimeRef.current);
                                    nextStartTimeRef.current += audioBuffer.duration;
                                    audioSourcesRef.current.add(source);
                                    source.onended = () => audioSourcesRef.current.delete(source);
                                }
                            }
                        }
                    },
                    onclose: (e: any) => {
                        console.log("Session closed", e);
                        if (isSessionActive) {
                            isSessionActive = false;
                            stopEverything();
                        }
                    },
                    onerror: (e: any) => {
                        console.error("Session error", e);
                        if (isSessionActive) {
                            isSessionActive = false;
                            stopEverything();
                        }
                    }
                }
            });

            const session = await sessionPromise;
            if (!isSessionActive) { session.close(); stopEverything(); return; }
            sessionRef.current = session;

            processor.onaudioprocess = (event) => {
                if (!isSessionActive || !sessionRef.current) return;
                const inputData = event.inputBuffer.getChannelData(0);
                const int16 = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
                const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                try { sessionRef.current.sendRealtimeInput({ media: pcmBlob }); } catch (e) {}
            };

            source.connect(processor);
            processor.connect(inputContext.destination);

        } catch (err) {
            console.error("Failed to connect:", err);
            isSessionActive = false;
            stopEverything();
            alert("Сбой подключения (возможно перегрузка токенов).");
        }
    };

    const handleToggleVoiceControl = () => {
        if (isVoiceControlActive) {
            stopEverything();
        } else {
            connectToGemini();
        }
    };
    
    if (isLoadingData) return <div className="flex h-screen items-center justify-center bg-gray-100"><div className="text-center"><Logo className="mx-auto h-14 w-auto"/><div className="mt-4 text-slate-500">Загрузка...</div></div></div>;
    if (!currentUser) return <LoginPage onLogin={handleLogin} />;

    return (
            <div className="flex h-screen bg-gray-100 text-slate-800">
                <Sidebar isOpen={isSidebarOpen} setOpen={setSidebarOpen} companyProfile={userData.companyProfile} setCompanyProfile={crudFunctions.setCompanyProfile} onLogout={handleLogout} isVoiceControlActive={isVoiceControlActive} onToggleVoiceControl={handleToggleVoiceControl} />
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8 relative">
                        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="lg:hidden fixed top-4 left-4 z-20 p-2 bg-white/60 rounded-full shadow-md"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<DashboardPage reports={userData.reports} proposals={userData.proposals}/>} />
                            <Route path="/ai-assistant" element={<AIAssistantPage userData={userData} addReport={crudFunctions.addReport} addMultipleProposals={crudFunctions.addMultipleProposals} addMultipleCampaigns={crudFunctions.addMultipleCampaigns} addOtherReport={crudFunctions.addOtherReport} updateOtherReport={crudFunctions.updateOtherReport} addProposal={crudFunctions.addProposal} updateProposal={crudFunctions.updateProposal} isGlobalVoiceActive={isVoiceControlActive} onDisableGlobalVoice={() => stopEverything()} />} />
                            <Route path="/reports" element={<ReportsPage reports={userData.reports} addReport={crudFunctions.addReport} deleteReport={crudFunctions.deleteReport} updateReport={crudFunctions.updateReport} />} />
                            <Route path="/other-reports" element={<OtherReportsPage reports={userData.otherReports} addReport={crudFunctions.addOtherReport} updateReport={crudFunctions.updateOtherReport} deleteReport={crudFunctions.deleteOtherReport} />} />
                            <Route path="/proposals" element={<CommercialProposalsPage proposals={userData.proposals} addProposal={crudFunctions.addProposal} deleteProposal={crudFunctions.deleteProposal} setProposals={crudFunctions.setProposals} updateProposal={crudFunctions.updateProposal} />} />
                            <Route path="/compare" element={<ComparePeriodsPage reports={userData.reports} />} />
                            <Route path="/conversions" element={<ConversionsPage reports={userData.reports} />} />
                            <Route path="/net-conversions" element={<NetConversionsPage reports={userData.reports} updateReport={crudFunctions.updateReport} />} />
                            <Route path="/campaigns" element={<AdCampaignsPage campaigns={userData.campaigns} addCampaign={crudFunctions.addCampaign} deleteCampaign={crudFunctions.deleteCampaign} setCampaigns={crudFunctions.setCampaigns} />} />
                            <Route path="/unit-economics" element={<UnitEconomicsPage proposals={userData.proposals} reports={userData.reports} />} />
                            <Route path="/storage" element={<CloudStoragePage links={userData.links} files={userData.files} addLink={crudFunctions.addLink} deleteLink={crudFunctions.deleteLink} addFile={crudFunctions.addFile} deleteFile={crudFunctions.deleteFile} />} />
                            <Route path="/payments" element={<PaymentsPage payments={userData.payments} files={userData.files} addPayment={crudFunctions.addPayment} updatePayment={crudFunctions.updatePayment} deletePayment={crudFunctions.deletePayment} addFile={crudFunctions.addFile} />} />
                            <Route path="/settings" element={<SettingsPage fullUserData={userData} setAllUserData={crudFunctions.setAllUserData} setCompanyProfile={crudFunctions.setCompanyProfile} />} />
                            <Route path="*" element={<Navigate to="/dashboard" replace />} />
                        </Routes>
                    </main>
                </div>
                {isVoiceControlActive && <VoiceAssistantOverlay status={voiceStatus} userTranscript={liveUserTranscript} aiTranscript={liveAiTranscript} onClose={handleToggleVoiceControl} />}
            </div>
    );
};

const AppWithRouter: React.FC = () => ( <HashRouter> <App /> </HashRouter> );
export default AppWithRouter;
