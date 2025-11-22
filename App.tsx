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

// ИМПОРТ API SUPABASE
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
    
    // Global Voice Control State
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
    
    // --- ЗАГРУЗКА ИЗ SUPABASE ---
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                const data = await fetchFullUserData();
                setUserData(data);
                console.log("Данные успешно загружены из Supabase!");
            } catch (error) {
                console.error("Ошибка загрузки данных:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        loadData();
    }, []);

    // --- ПРИНУДИТЕЛЬНАЯ СВЕТЛАЯ ТЕМА ---
    useEffect(() => {
        document.documentElement.classList.remove('dark');
    }, [userData.companyProfile.darkModeEnabled]);

    // Логика авторизации
    useEffect(() => {
        const rememberedUserJSON = localStorage.getItem('rememberedUser');
        if (rememberedUserJSON) {
            try {
                const rememberedUser = JSON.parse(rememberedUserJSON);
                if (rememberedUser.email === mockUser.email) {
                    const userToLogin = { ...mockUser };
                    delete userToLogin.password;
                    setCurrentUser(userToLogin);
                }
            } catch (e) {
                localStorage.removeItem('rememberedUser');
            }
        }
    }, []);

    const handleLogin = useCallback((email: string, pass: string, rememberMe: boolean) => {
        if (email === mockUser.email && pass === mockUser.password) {
            const userToLogin = { ...mockUser };
            delete userToLogin.password;
            setCurrentUser(userToLogin);
            if (rememberMe) localStorage.setItem('rememberedUser', JSON.stringify(userToLogin));
            else localStorage.removeItem('rememberedUser');
            return true;
        }
        return false;
    }, []);

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        localStorage.removeItem('rememberedUser');
    }, []);
    
    // --- CRUD ФУНКЦИИ ---
    const crudFunctions = useMemo(() => ({
        setReports: (updater: Report[] | ((prevReports: Report[]) => Report[])) => { setUserData(prev => ({ ...prev, reports: typeof updater === 'function' ? updater(prev.reports) : updater })); },
        addReport: async (report: Omit<Report, 'id'>) => { const newReport = { ...report, id: uuidv4() }; await apiAddReport(newReport); setUserData(prev => ({ ...prev, reports: [newReport, ...prev.reports] })); },
        updateReport: async (updatedReport: Report) => { await apiUpdateReport(updatedReport); setUserData(prev => ({ ...prev, reports: prev.reports.map(r => r.id === updatedReport.id ? updatedReport : r) })); },
        deleteReport: async (id: string) => { await apiDeleteReport(id); setUserData(prev => ({ ...prev, reports: prev.reports.filter(r => r.id !== id) })); },
        addOtherReport: async (report: Omit<OtherReport, 'id'>) => { const newReport = { ...report, id: uuidv4() }; await apiAddOtherReport(newReport); setUserData(prev => ({ ...prev, otherReports: [newReport, ...prev.otherReports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) })); },
        updateOtherReport: async (updatedReport: OtherReport) => { await apiUpdateOtherReport(updatedReport); setUserData(prev => ({ ...prev, otherReports: prev.otherReports.map(r => r.id === updatedReport.id ? updatedReport : r).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) })); },
        deleteOtherReport: async (id: string) => { await apiDeleteOtherReport(id); setUserData(prev => ({ ...prev, otherReports: prev.otherReports.filter(r => r.id !== id) })); },
        setProposals: (updater: CommercialProposal[] | ((prevProposals: CommercialProposal[]) => CommercialProposal[])) => { setUserData(prev => ({ ...prev, proposals: typeof updater === 'function' ? updater(prev.proposals) : updater })); },
        addProposal: async (proposal: Omit<CommercialProposal, 'id'>) => { const newProposal = { ...proposal, id: uuidv4() }; await apiAddProposal(newProposal); setUserData(prev => ({ ...prev, proposals: [newProposal, ...prev.proposals] })); },
        updateProposal: async (updatedProposal: CommercialProposal) => { await apiUpdateProposal(updatedProposal); setUserData(prev => ({ ...prev, proposals: prev.proposals.map(p => p.id === updatedProposal.id ? updatedProposal : p) })); },
        addMultipleProposals: async (proposals: Omit<CommercialProposal, 'id'>[]) => { const newProposals = proposals.map(p => ({ ...p, id: uuidv4() })); for (const p of newProposals) await apiAddProposal(p); setUserData(prev => ({ ...prev, proposals: [...newProposals, ...prev.proposals] })); },
        deleteProposal: async (id: string) => { await apiDeleteProposal(id); setUserData(prev => ({ ...prev, proposals: prev.proposals.filter(p => p.id !== id) })); },
        setCampaigns: (updater: AdCampaign[] | ((prevCampaigns: AdCampaign[]) => AdCampaign[])) => { setUserData(prev => ({ ...prev, campaigns: typeof updater === 'function' ? updater(prev.campaigns) : updater })); },
        addCampaign: async (campaign: Omit<AdCampaign, 'id'>) => { const newCampaign = { ...campaign, id: uuidv4() }; await apiAddCampaign(newCampaign); setUserData(prev => ({ ...prev, campaigns: [newCampaign, ...prev.campaigns] })); },
        addMultipleCampaigns: async (campaigns: Omit<AdCampaign, 'id'>[]) => { const newCampaigns = campaigns.map(c => ({ ...c, id: uuidv4() })); for (const c of newCampaigns) await apiAddCampaign(c); setUserData(prev => ({ ...prev, campaigns: [...newCampaigns, ...prev.campaigns] })); },
        deleteCampaign: async (id: string) => { await apiDeleteCampaign(id); setUserData(prev => ({ ...prev, campaigns: prev.campaigns.filter(c => c.id !== id) })); },
        addLink: async (link: Omit<Link, 'id'>) => { const newLink = { ...link, id: uuidv4() }; await apiAddLink(newLink); setUserData(prev => ({ ...prev, links: [newLink, ...prev.links] })); },
        deleteLink: async (id: string) => { await apiDeleteLink(id); setUserData(prev => ({ ...prev, links: prev.links.filter(l => l.id !== id) })); },
        addFile: async (fileData: Omit<StoredFile, 'id'>) => { const newFile = { ...fileData, id: uuidv4() }; await apiAddFile(newFile); setUserData(prev => ({ ...prev, files: [newFile, ...prev.files] })); return newFile; },
        deleteFile: async (id: string) => { await apiDeleteFile(id); setUserData(prev => ({ ...prev, files: prev.files.filter(f => f.id !== id) })); },
        addPayment: async (payment: Omit<Payment, 'id'>) => { const newPayment = { ...payment, id: uuidv4() }; await apiAddPayment(newPayment); setUserData(prev => ({ ...prev, payments: [newPayment, ...prev.payments].sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime()) })); },
        updatePayment: async (updatedPayment: Payment) => { await apiUpdatePayment(updatedPayment); setUserData(prev => ({ ...prev, payments: prev.payments.map(p => p.id === updatedPayment.id ? updatedPayment : p).sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime()) })); },
        deletePayment: async (id: string) => { await apiDeletePayment(id); setUserData(prev => ({ ...prev, payments: prev.payments.filter(p => p.id !== id) })); },
        setCompanyProfile: async (profile: CompanyProfile) => { await apiUpdateCompanyProfile(profile); setUserData(prev => ({ ...prev, companyProfile: profile })); },
        setAllUserData: (data: UserData) => { setUserData(data); },
    }), []);
    
    const navigate = useNavigate();

    const cleanupVoiceSession = useCallback(() => {
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current.disconnect();
        }
        mediaStreamSourceRef.current?.disconnect();
        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);

        mediaStreamRef.current = null;
        scriptProcessorRef.current = null;
        mediaStreamSourceRef.current = null;
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        sessionRef.current = null;
        nextStartTimeRef.current = 0;
        audioSourcesRef.current.forEach(source => source.stop());
        audioSourcesRef.current.clear();

        setIsVoiceControlActive(false);
        setVoiceStatus('idle');
    }, []);

    useEffect(() => {
        return () => { sessionRef.current?.close(); cleanupVoiceSession(); };
    }, [cleanupVoiceSession]);

    const handleNavigation = (page: string) => {
        navigate(page);
    };

    // --- МОЩНЫЙ ГЕНЕРАТОР КОНТЕКСТА "ЛЮМИ" ---
    const generateContext = (data: UserData) => {
        const today = new Date().toLocaleDateString('ru-RU');
        
        // Сжимаем данные в читаемый текст (Data Minification)
        // Это позволяет скормить AI ВСЮ базу данных, не превышая лимиты
        const reportStr = data.reports.map(r => `[ОТЧЕТ ${r.name} (${r.creationDate})]: Продажи ${r.metrics.sales}, Лиды ${r.metrics.leads}, Бюджет ${r.metrics.budget}`).join('; ');
        const propStr = data.proposals.map(p => `[КП]: ${p.company || 'Клиент'}, ${p.item}, ${p.amount}тг, Статус: ${p.status}, Направление: ${p.direction}, Дата: ${p.date}`).join('; ');
        const campStr = data.campaigns.map(c => `[РЕКЛАМА]: ${c.name}, Статус: ${c.status}, Бюджет: ${c.budget}, Расход: ${c.spend}, Конв: ${c.conversions}`).join('; ');
        const payStr = data.payments.map(p => `[ПЛАТЕЖ]: ${p.serviceName}, ${p.amount} ${p.currency}, След. дата: ${p.nextPaymentDate}`).join('; ');
        const linksStr = data.links.map(l => `[ССЫЛКА]: ${l.url} (${l.comment})`).join('; ');

        return `
        СЕГОДНЯ: ${today}
        ТВОЕ ИМЯ: Люми.
        ТВОЯ РОЛЬ: Старший бизнес-аналитик, технический директор и оператор системы для компании ${data.companyProfile.companyName}.
        
        ТВОИ НАВЫКИ И ИНСТРУКЦИИ:
        
        1. 🌐 ИНТЕРНЕТ-ПОИСК (Google):
           - Если спрашивают про курсы валют, новости, ГОСТы, материалы (РТИ, 3D), законы — ИСПОЛЬЗУЙ инструмент [googleSearch].
           - Не выдумывай факты, проверяй их в сети.

        2. 📊 АНАЛИЗ ДАННЫХ (Всевидящее око):
           - Ниже я дам тебе СЖАТУЮ сводку всех данных компании. Ты видишь каждый отчет, каждое КП, каждую копейку.
           - Анализируй тренды. Если видишь падение продаж или рост расходов — сообщай об этом.
           - Сравнивай периоды и давай рекомендации по развитию.

        3. 🧭 УПРАВЛЕНИЕ САЙТОМ (Карта системы):
           - Ты знаешь структуру сайта. Если просят "покажи отчеты" или "иди в настройки" — вызывай функцию 'navigateToPage'.
           - Разделы: /dashboard, /reports, /proposals, /campaigns, /payments, /storage, /settings, /unit-economics.

        4. ✍️ РАБОТА С ТЕКСТОМ:
           - Ты умеешь писать и редактировать деловые письма, коммерческие предложения, тексты для рекламы.
           - Если просят перевести — переводи на любой язык качественно.

        5. 🛠️ ТЕХНИЧЕСКИЙ КОНСУЛЬТАНТ:
           - Ты эксперт в РТИ (резина, силикон, ГОСТы) и 3D-печати (пластики, принтеры).
           - Помогай с расчетами материалов.

        6. 🗣️ ГОЛОСОВОЙ ЭТИКЕТ:
           - Говори кратко, емко и по делу. Не лей воду.
           - Если тебе говорят "СТОП" или перебивают — замолкай немедленно.
           - Язык: Русский (если не попросили другой).
           - Цифры читай словами ("пять тысяч", "тенге").

        === ПОЛНЫЙ СЛЕПОК БАЗЫ ДАННЫХ ===
        ПРОФИЛЬ: ${JSON.stringify(data.companyProfile.details)}
        ОТЧЕТЫ: ${reportStr || "Нет данных"}
        КП: ${propStr || "Нет данных"}
        РЕКЛАМА: ${campStr || "Нет данных"}
        ПЛАТЕЖИ: ${payStr || "Нет данных"}
        ССЫЛКИ: ${linksStr || "Нет данных"}
        ИНСТРУКЦИЯ ПОЛЬЗОВАТЕЛЯ: ${data.companyProfile.aiSystemInstruction}
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

        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

        if (!apiKey) {
            alert("Ошибка: API ключ не найден.");
            cleanupVoiceSession();
            return;
        }
        
        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            const fullSystemInstruction = generateContext(userData);

            const sessionPromise = ai.live.connect({
                model: 'models/gemini-2.0-flash-exp',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: fullSystemInstruction,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [
                        { googleSearch: {} }, // ПОДКЛЮЧЕН ИНТЕРНЕТ
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

                        outputAudioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
                        
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
                                   functionResult = `Переход на страницу ${fc.args.page} выполнен.`;
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
                                   functionResult = `Коммерческое предложение для компании ${company} успешно создано.`;
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
                                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                                    const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                                    const source = outCtx.createBufferSource();
                                    source.buffer = audioBuffer;
                                    source.connect(outCtx.destination);
                                    source.addEventListener('ended', () => { audioSourcesRef.current.delete(source); });
                                    source.start(nextStartTimeRef.current);
                                    nextStartTimeRef.current += audioBuffer.duration;
                                    audioSourcesRef.current.add(source);
                                }
                            }
                        }
                    },
                    onclose: cleanupVoiceSession,
                    onerror: (e: any) => {
                        console.error("Live session error:", e);
                        if (!isVoiceControlActive) return;
                        const msg = e.message || e.type || "Ошибка";
                        if (!msg.includes("closing")) alert(`Ошибка соединения: ${msg}`);
                        cleanupVoiceSession();
                    },
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (err) {
            console.error("Failed to start voice session:", err);
            alert("Не удалось подключиться к AI.");
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
