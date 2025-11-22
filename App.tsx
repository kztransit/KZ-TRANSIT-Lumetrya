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

// --- ИНСТРУМЕНТЫ (Определяем локально для стабильности Live API) ---
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
    
    // Состояния голосового ассистента
    const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [voiceStatus, setVoiceStatus] = useState<'idle' | 'greeting' | 'listening' | 'speaking'>('idle');
    const [liveUserTranscript, setLiveUserTranscript] = useState('');
    const [liveAiTranscript, setLiveAiTranscript] = useState('');

    // Refs
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
    
    // Загрузка данных
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

    // --- ГЛАВНАЯ ФУНКЦИЯ ОСТАНОВКИ (Anti-Crash) ---
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

    // Чистим при размонтировании
    useEffect(() => { return () => stopEverything(); }, [stopEverything]);

    // --- ГЕНЕРАЦИЯ КОНТЕКСТА (С ФИЛЬТРАЦИЕЙ ТОКЕНОВ) ---
    const generateContext = (data: UserData) => {
        const today = new Date().toLocaleDateString('ru-RU');
        
        // ОПТИМИЗАЦИЯ: Берем только свежие данные
        const optimizedDb = {
            reports: data.reports.slice(0, 5).map(r => ({ name: r.name, metrics: r.metrics })),
            proposals: data.proposals.slice(0, 20).map(p => ({ company: p.company, item: p.item, amount: p.amount, status: p.status, direction: p.direction })),
            campaigns: data.campaigns.slice(0, 10).map(c => ({ name: c.name, status: c.status, spend: c.spend })),
            storage: data.files.map(f => f.name), 
            links: data.links,
            payments: data.payments.slice(0, 10)
        };

        return `
        SYSTEM_INSTRUCTION:
        DATE: ${today}
        IDENTITY: Lumi, Эксперт KZ TRANSIT.
        
        VOICE RULES:
        1. Язык: ТОЛЬКО РУССКИЙ.
        2. Цифры: Читай словами! "5000" -> "пять тысяч". "KZT" -> "тенге".
        3. Краткость: Не лей воду. Говори по делу.
        
        CONTEXT: ${JSON.stringify(optimizedDb)}
        USER_INSTRUCTION: ${data.companyProfile.aiSystemInstruction}
        `;
    };

    const connectToGemini = async () => {
        if (isConnecting) return;
        setIsConnecting(true);
        stopEverything(); // Сброс перед стартом

        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
        if (!apiKey) { alert("API Key not found"); setIsConnecting(false); return; }

        // Локальный флаг активности для этого конкретного подключения
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
            const fullContext = generateContext(userData);

            const toolsArray: any[] = [
                { googleSearch: {} }, 
                { functionDeclarations: [navigationTool, createProposalTool, addMarketingIdeaTool, calculateMarginTool] }
            ];

            // 1. Аудио
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

            // 2. Сокет
            const sessionPromise = ai.live.connect({
                model: 'models/gemini-2.0-flash-exp',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { 
                        voiceConfig: { 
                            prebuiltVoiceConfig: { voiceName: 'Aoede' } // Женский голос
                        } 
                    },
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
                            userTranscriptRef.current +=
