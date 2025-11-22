import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from "@google/genai";
import { decode, decodeAudioData, encode } from './utils';
// import { navigationFunctionDeclaration, ... } мы убрали, определяем всё внутри

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

// --- ИСПРАВЛЕНИЕ: ОПРЕДЕЛЕНИЕ ИНСТРУМЕНТОВ ЧЕРЕЗ ОБЫЧНЫЕ ОБЪЕКТЫ ---
// Мы убрали зависимость от SchemaType, чтобы избежать ошибок сборки

const navigationTool = {
    name: "navigateToPage",
    description: "Переходит на указанную страницу приложения. Используй, когда пользователь просит открыть раздел.",
    parameters: {
        type: "OBJECT",
        properties: {
            page: {
                type: "STRING",
                description: "URL путь (например: '/dashboard', '/reports', '/proposals', '/campaigns', '/settings', '/ai-assistant')",
            },
        },
        required: ["page"],
    },
};

const createProposalTool = {
    name: "createCommercialProposal",
    description: "Создает новое Коммерческое Предложение (КП) в системе.",
    parameters: {
        type: "OBJECT",
        properties: {
            company: { type: "STRING", description: "Название компании клиента" },
            item: { type: "STRING", description: "Название товара или услуги (например: 'Техпластина ТМКЩ', '3D печать шестерни')" },
            amount: { type: "NUMBER", description: "Сумма КП (число)" },
            direction: { type: "STRING", description: "Направление: 'РТИ' или '3D'" },
        },
        required: ["company", "item", "amount"],
    },
};

const addMarketingIdeaTool = {
    name: "addMarketingIdea",
    description: "Сохраняет идею для рекламной кампании или маркетинговой активности.",
    parameters: {
        type: "OBJECT",
        properties: {
            name: { type: "STRING", description: "Название идеи или кампании" },
            budget: { type: "NUMBER", description: "Предполагаемый бюджет (если есть, иначе 0)" },
        },
        required: ["name"],
    },
};

const calculateMarginTool = {
    name: "calculateMargin",
    description: "Рассчитывает маржинальность сделки в процентах. Полезно для оценки прибыльности КП.",
    parameters: {
        type: "OBJECT",
        properties: {
            costPrice: { type: "NUMBER", description: "Себестоимость" },
            salePrice: { type: "NUMBER", description: "Цена продажи" },
        },
        required: ["costPrice", "salePrice"],
    },
};

// -------------------------------------------------------

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
        
        audioSourcesRef.current.forEach(source => { try { source.stop(); } catch(e){} });
        audioSourcesRef.current.clear();
        
        setIsVoiceControlActive(false);
        setVoiceStatus('idle');
    }, []);

    useEffect(() => { return () => { if(sessionRef.current) sessionRef.current.close(); cleanupVoiceSession(); }; }, [cleanupVoiceSession]);

    const generateContext = (data: UserData) => {
        const today = new Date().toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        const databaseSnapshot = {
            reports: data.reports,
            proposals: data.proposals,
            campaigns: data.campaigns,
            payments: data.payments,
            otherReports: data.otherReports,
            links: data.links
        };

        return `
        SYSTEM_INSTRUCTION:
        DATE: ${today}
        
        IDENTITY & COMPANY:
        - Твое имя: Lumi (Люми).
        - Компания: ТОО "KZ TRANSIT" (Казахстан).
        - Твои роли: Главный Инженер-технолог, Директор по маркетингу (CMO), Бизнес-аналитик.
        
        VOICE & LANGUAGE SETTINGS (CRITICAL):
        - Язык: ЧИСТЫЙ РУССКИЙ (Russian).
        - Акцент: ОТСУТСТВУЕТ. Говори как диктор центрального телевидения или профессиональный консультант.
        - Интонация: Уверенная, спокойная, компетентная.
        - Ответы: Лаконичные, без воды. Сначала суть, потом детали.

        DOMAIN KNOWLEDGE (ТЕХНИЧЕСКАЯ ЧАСТЬ):
        1. РТИ (Резинотехнические изделия): Ты знаешь всё про техпластины (ТМКЩ, МБС), рукава, манжеты, сырые резины, силиконы. Знаешь ГОСТы (ищи их в googleSearch).
        2. Аддитивные технологии (3D): FDM, SLA, SLS печать. Материалы: PLA, ABS, PETG, Nylon, PEEK.
        3. Если спрашивают технический совет — отвечай как опытный инженер.

        BUSINESS & MARKETING SKILLS:
        1. Ты анализируешь данные (см. JSON ниже). Сравнивай показатели, ищи убыточные места.
        2. Ты помогаешь продавать. Если просят составить текст письма клиенту — диктуй идеальный продающий текст.
        3. Ты стратег. Предлагай идеи для акций, если видишь спад продаж.

        AVAILABLE TOOLS:
        1. [googleSearch]: ДЛЯ ВНЕШНИХ ДАННЫХ. Курсы валют (KZT/USD), погода, новости, ГОСТы, конкуренты.
        2. [navigateToPage]: Для управления интерфейсом ("Открой отчеты").
        3. [createCommercialProposal]: Создать КП ("Создай КП для АО КазМунайГаз...").
        4. [addMarketingIdea]: Записать идею ("Запиши идею: запустить таргет на техпластины").
        5. [calculateMargin]: Посчитать выгоду ("Себестоимость 1000, продаем за 1500, какая маржа?").

        DATABASE_ACCESS:
        ${JSON.stringify(databaseSnapshot)}

        USER_PREFERENCES:
        ${data.companyProfile.aiSystemInstruction}
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
        nextStartTimeRef.current = 0;

        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) { alert("API Key not found"); cleanupVoiceSession(); return; }
        
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const fullContext = generateContext(userData);

            // Исправленная конфигурация инструментов (any для обхода строгой типизации SDK при билде)
            const toolsArray: any[] = [
                { googleSearch: {} },
                { 
                    functionDeclarations: [
                        navigationTool, 
                        createProposalTool,
                        addMarketingIdeaTool,
                        calculateMarginTool
                    ] 
                }
            ];

            const sessionPromise = ai.live.connect({
                model: 'models/gemini-2.0-flash-exp',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { 
                        voiceConfig: { 
                            prebuiltVoiceConfig: { 
                                voiceName: 'Puck' 
                            } 
                        } 
                    },
                    systemInstruction: fullContext,
                    tools: toolsArray,
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
                            const int16 = new Int16Array(inputData.length);
                            for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
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
                            const functionResponses: any[] = [];
                            
                            for (const fc of message.toolCall.functionCalls) {
                                let result: any = { result: "Команда принята." };
                                
                                try {
                                    if (fc.name === 'navigateToPage' && fc.args.page) {
                                       handleNavigation(fc.args.page as string);
                                       result = { result: `ОК. Открываю: ${fc.args.page}` };
                                    } 
                                    else if (fc.name === 'createCommercialProposal') {
                                       const { company, item, amount, direction } = fc.args as any;
                                       let normalizedDirection: 'РТИ' | '3D' = 'РТИ';
                                       if (typeof direction === 'string' && direction.toUpperCase().includes('3D')) normalizedDirection = '3D';
                                       
                                       crudFunctions.addProposal({
                                           date: new Date().toISOString().split('T')[0],
                                           direction: normalizedDirection,
                                           proposalNumber: `КП-${Math.floor(10000 + Math.random() * 90000)}`,
                                           company: company, item: item, amount: amount, 
                                           status: 'Ожидание', invoiceNumber: null, invoiceDate: null, paymentDate: null, paymentType: null,
                                       });
                                       result = { result: `КП для ${company} на сумму ${amount} создано успешно.` };
                                    }
                                    else if (fc.name === 'addMarketingIdea') {
                                        const { name, budget } = fc.args as any;
                                        crudFunctions.addCampaign({
                                            name: name, status: 'Черновик', spend: budget || 0, clicks: 0, leads: 0, sales: 0
                                        });
                                        result = { result: `Идея "${name}" записана в рекламные кампании как черновик.` };
                                    }
                                    else if (fc.name === 'calculateMargin') {
                                        const { costPrice, salePrice } = fc.args as any;
                                        if (salePrice > 0) {
                                            const margin = ((salePrice - costPrice) / salePrice) * 100;
                                            const profit = salePrice - costPrice;
                                            result = { result: `Прибыль: ${profit}. Маржинальность: ${margin.toFixed(2)}%.` };
                                        } else {
                                            result = { result: "Ошибка: Цена продажи должна быть больше нуля." };
                                        }
                                    }
                                } catch (e) {
                                    console.error("Tool Error:", e);
                                    result = { error: "Не удалось выполнить действие." };
                                }

                                functionResponses.push({
                                    id: fc.id,
                                    name: fc.name,
                                    response: result
                                });
                            }

                            if (functionResponses.length > 0) {
                                sessionPromise.then((session) => {
                                   session.sendToolResponse({ functionResponses });
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
                    onclose: cleanupVoiceSession,
                    onerror: (e: any) => {
                        console.error("Lumi Connection Error:", e);
                        if (isVoiceControlActive && !e.message?.includes("closing")) {
                           // console.log("Переподключение...");
                        }
                        cleanupVoiceSession();
                    },
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (err) {
            console.error(err);
            alert("Не удалось подключиться. Проверьте соединение.");
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
