import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from "@google/genai";
import { decode, decodeAudioData, encode } from './utils';
import { navigationFunctionDeclaration, createCommercialProposalFunctionDeclaration } from './services/geminiService';

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
import { User, UserData, Report, CommercialProposal, AdCampaign, Link, StoredFile, CompanyProfile, Payment, OtherReport } from './types';

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

const App: React.FC = () => {
    const [userData, setUserData] = useState<UserData>(initialUserData);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isSidebarOpen, setSidebarOpen] = useState<boolean>(true);
    
    const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState<'idle' | 'greeting' | 'listening' | 'speaking'>('idle');
    const [liveUserTranscript, setLiveUserTranscript] = useState('');
    const [liveAiTranscript, setLiveAiTranscript] = useState('');

    const sessionRef = useRef<LiveSession | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    
    // !!! ВОТ ЭТА СТРОЧКА БЫЛА ПОТЕРЯНА, Я ЕЁ ВЕРНУЛ !!!
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
                console.log("Lumi: Данные успешно загружены.");
            } catch (error) {
                console.error("Ошибка загрузки:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        loadData();
    }, []);

    useEffect(() => {
        document.documentElement.classList.remove('dark');
    }, [userData.companyProfile.darkModeEnabled]);

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

    const cleanupVoiceSession = useCallback(() => {
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current.disconnect();
        }
        mediaStreamSourceRef.current?.disconnect();
        inputAudioContextRef.current?.close().catch(() => {});
        outputAudioContextRef.current?.close().catch(() => {});

        mediaStreamRef.current = null;
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        sessionRef.current = null;
        
        // Очищаем очередь воспроизведения
        audioSourcesRef.current.forEach(source => { try { source.stop(); } catch(e){} });
        audioSourcesRef.current.clear();
        
        setIsVoiceControlActive(false);
        setVoiceStatus('idle');
    }, []);

    useEffect(() => { return () => { if(sessionRef.current) sessionRef.current.close(); cleanupVoiceSession(); }; }, [cleanupVoiceSession]);

    const generateContext = (data: UserData) => {
        const today = new Date().toLocaleDateString('ru-RU');
        const reports = data.reports.map(r => `OTCHET[${r.name}]:Sales=${r.metrics.sales},Leads=${r.metrics.leads}`).join(';');
        const props = data.proposals.map(p => `KP[${p.company}|${p.amount}|${p.status}]`).join(';');
        const camps = data.campaigns.map(c => `ADS[${c.name}|${c.status}|Spend=${c.spend}]`).join(';');
        const pay = data.payments.map(p => `PAY[${p.serviceName}|${p.amount}|${p.nextPaymentDate}]`).join(';');

        return `
        DATA:${today}
        ROLE:Lumi, Business Analyst, Engineer.
        LANG:RUSSIAN. Digits as words!
        TOOLS:[googleSearch],[navigateToPage],[createCommercialProposal].
        RULES:Short voice answers. Stop on command.
        DB:
        PROFILE:${JSON.stringify(data.companyProfile.details)}
        REPORTS:${reports}
        PROPOSALS:${props}
        ADS:${camps}
        PAYMENTS:${pay}
        INSTRUCTION:${data.companyProfile.aiSystemInstruction}
        `;
    };

    const handleToggleVoiceControl = async () => {
        if (isVoiceControlActive) {
            sessionRef.current?.close();
            return;
        }

        setIsVoiceControlActive(true);
        setVoiceStatus('greeting');
        setLiveUserTranscript('');
        setLiveAiTranscript('');
        userTranscriptRef.current = '';
        aiTranscriptRef.current = '';
        
        // Сброс времени начала воспроизведения
        nextStartTimeRef.current = 0;

        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) { alert("API Key not found"); cleanupVoiceSession(); return; }
        
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const fullContext = generateContext(userData);

            const sessionPromise = ai.live.connect({
                model: 'models/gemini-2.0-flash-exp',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: fullContext,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [
                        { googleSearch: {} }, 
                        { functionDeclarations: [navigationFunctionDeclaration, createCommercialProposalFunctionDeclaration] }
                    ],
                },
                callbacks: {
                    onopen: async () => {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaStreamRef.current = stream;

                        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                        const inputContext = new AudioContextClass({ sampleRate: 16000 });
                        if (inputContext.state === 'suspended') await inputContext.resume();
                        inputAudioContextRef.current = inputContext;

                        const outputContext = new AudioContextClass({ sampleRate: 24000 });
                        outputAudioContextRef.current = outputContext;
                        
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
                            const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            sessionPromise.then(session => {
                                try { session.sendRealtimeInput({ media: pcmBlob }); } catch (e) {}
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);

                        setVoiceStatus('listening');
                    },
                    onmessage: async (message: LiveServerMessage) => {
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
                            for (const fc of message.toolCall.functionCalls) {
                                let functionResult = "Действие выполнено.";
                                if (fc.name === 'navigateToPage' && fc.args.page) {
                                   handleNavigation(fc.args.page as string);
                                   functionResult = `Переход на страницу ${fc.args.page}`;
                                }
                                if (fc.name === 'createCommercialProposal') {
                                   const { company, item, amount, direction, date } = fc.args as any;
                                   let normalizedDirection: 'РТИ' | '3D' = 'РТИ';
                                   if (typeof direction === 'string' && direction.toUpperCase() === '3D') normalizedDirection = '3D';
                                   crudFunctions.addProposal({
                                       date: date || new Date().toISOString().split('T')[0],
                                       direction: normalizedDirection,
                                       proposalNumber: `КП-${Math.floor(10000 + Math.random() * 90000)}`,
                                       company: company, item: item, amount: amount, status: 'Ожидание', invoiceNumber: null, invoiceDate: null, paymentDate: null, paymentType: null,
                                   });
                                   functionResult = `КП создано.`;
                                }
                                sessionPromise.then((session) => {
                                   session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: functionResult } } });
                                });
                            }
                        }
                        if (message.serverContent?.turnComplete) {
                            userTranscriptRef.current = '';
                            aiTranscriptRef.current = '';
                            setTimeout(() => { setLiveUserTranscript(''); setLiveAiTranscript(''); setVoiceStatus('listening'); }, 2000);
                        }
                        
                        const modelTurn = message.serverContent?.modelTurn;
                        if (modelTurn?.parts) {
                            for (const part of modelTurn.parts) {
                                const base64Audio = part.inlineData?.data;
                                if (base64Audio && outputAudioContextRef.current) {
                                    const outCtx = outputAudioContextRef.current;
                                    
                                    // 1. Декодируем звук
                                    const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                                    
                                    // 2. Рассчитываем время начала (чтобы фразы шли друг за другом)
                                    const now = outCtx.currentTime;
                                    // Если пауза была большой, сбрасываем таймер на "сейчас"
                                    if (nextStartTimeRef.current < now) {
                                        nextStartTimeRef.current = now;
                                    }
                                    
                                    const source = outCtx.createBufferSource();
                                    source.buffer = audioBuffer;
                                    source.connect(outCtx.destination);
                                    
                                    // 3. Играем
                                    source.start(nextStartTimeRef.current);
                                    
                                    // 4. Сдвигаем время для следующего куска
                                    nextStartTimeRef.current += audioBuffer.duration;
                                    
                                    // Сохраняем для очистки
                                    audioSourcesRef.current.add(source);
                                    source.onended = () => audioSourcesRef.current.delete(source);
                                }
                            }
                        }
                    },
                    onclose: cleanupVoiceSession,
                    onerror: (e: any) => {
                        console.error(e);
                        if (isVoiceControlActive && !e.message?.includes("closing")) {
                            alert(`Сбой Люми: ${e.message || "Ошибка сети"}`);
                        }
                        cleanupVoiceSession();
                    },
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (err) {
            alert("Не удалось подключиться.");
            cleanupVoiceSession();
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
                            <Route path="/ai-assistant" element={<AIAssistantPage userData={userData} addReport={crudFunctions.addReport} addMultipleProposals={crudFunctions.addMultipleProposals} addMultipleCampaigns={crudFunctions.addMultipleCampaigns} addOtherReport={crudFunctions.addOtherReport} updateOtherReport={crudFunctions.updateOtherReport} addProposal={crudFunctions.addProposal} updateProposal={crudFunctions.updateProposal} isGlobalVoiceActive={isVoiceControlActive} onDisableGlobalVoice={() => sessionRef.current?.close()} />} />
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
                {isVoiceControlActive && <VoiceAssistantOverlay status={voiceStatus} userTranscript={liveUserTranscript} aiTranscript={liveAiTranscript} onClose={() => sessionRef.current?.close()} />}
            </div>
    );
};

const AppWithRouter: React.FC = () => ( <HashRouter> <App /> </HashRouter> );
export default AppWithRouter;
