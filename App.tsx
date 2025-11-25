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

/**
 * ✅ Если у тебя navigationFunctionDeclaration уже импортируется из другого файла — удали этот блок.
 * Он нужен, чтобы ассистент мог вызывать навигацию по приложению.
 */
const navigationFunctionDeclaration = {
  name: 'navigateToPage',
  description: 'Переходит на указанную страницу приложения.',
  parameters: {
    type: "OBJECT",
    properties: {
      page: {
        type: "STRING",
        description: 'Путь (например: /reports, /proposals, /settings)',
        enum: [
          '/dashboard', '/reports', '/other-reports', '/proposals', '/compare',
          '/conversions', '/net-conversions', '/campaigns', '/unit-economics',
          '/payments', '/storage', '/settings', '/ai-assistant'
        ]
      }
    },
    required: ['page']
  }
};

const App: React.FC = () => {
  const [userData, setUserData] = useState<UserData>(initialUserData);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // --- Состояния голосового ассистента ---
  const [isVoiceControlActive, setIsVoiceControlActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'greeting' | 'listening' | 'speaking'>('idle');
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [liveAiTranscript, setLiveAiTranscript] = useState('');

  // --- Refs ---
  const sessionRef = useRef<LiveSession | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

  // Буферы для текущей фразы
  const userTranscriptRef = useRef('');
  const aiTranscriptRef = useRef('');

  // --- ПАМЯТЬ АССИСТЕНТА (история сессии) ---
  const historyRef = useRef<Array<{ role: 'user' | 'ai', text: string }>>([]);

  // --- Утилита строгого лимита 400 символов ---
  const clamp400 = (s: string) => s.length > 400 ? s.slice(0, 397) + "…" : s;

  // --- Стоп-детектор включаем с задержкой после старта сессии ---
  const allowStopRef = useRef(false);

  // --- Загрузка данных ---
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
        if (u.email === mockUser.email) setCurrentUser({ ...mockUser });
      } catch (e) { localStorage.removeItem('rememberedUser'); }
    }
  }, []);

  const handleLogin = useCallback((e: string, p: string, r: boolean) => {
    if (e === mockUser.email && p === mockUser.password) {
      setCurrentUser({ ...mockUser });
      if (r) localStorage.setItem('rememberedUser', JSON.stringify({ ...mockUser }));
      else localStorage.removeItem('rememberedUser');
      return true;
    }
    return false;
  }, []);
  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem('rememberedUser');
  }, []);

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
    addMultipleProposals: async (l: any[]) => { const n = l.map(i => ({ ...i, id: uuidv4() })); for (const x of n) await apiAddProposal(x); setUserData(p => ({ ...p, proposals: [...n, ...p.proposals] })); },
    deleteProposal: async (id: string) => { await apiDeleteProposal(id); setUserData(p => ({ ...p, proposals: p.proposals.filter(r => r.id !== id) })); },

    setCampaigns: (u: any) => setUserData(p => ({ ...p, campaigns: typeof u === 'function' ? u(p.campaigns) : u })),
    addCampaign: async (i: any) => { const n = { ...i, id: uuidv4() }; await apiAddCampaign(n); setUserData(p => ({ ...p, campaigns: [n, ...p.campaigns] })); },
    addMultipleCampaigns: async (l: any[]) => { const n = l.map(i => ({ ...i, id: uuidv4() })); for (const x of n) await apiAddCampaign(x); setUserData(p => ({ ...p, campaigns: [...n, ...p.campaigns] })); },
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

  // --- ФУНКЦИЯ ОСТАНОВКИ ВСЕГО ---
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
    inputAudioContextRef.current?.close().catch(() => { });
    outputAudioContextRef.current?.close().catch(() => { });
    if (sessionRef.current) {
      try { sessionRef.current.close(); } catch (e) { }
      sessionRef.current = null;
    }

    audioSourcesRef.current.forEach(source => { try { source.stop(); } catch (e) { } });
    audioSourcesRef.current.clear();

    setIsVoiceControlActive(false);
    setIsConnecting(false);
    setVoiceStatus('idle');
    setLiveUserTranscript('');
    setLiveAiTranscript('');
    userTranscriptRef.current = '';
    aiTranscriptRef.current = '';
    allowStopRef.current = false;
  }, []);

  useEffect(() => { return () => stopEverything(); }, [stopEverything]);

  // --- УМНЫЙ КОНТЕКСТ С ИСТОРИЕЙ ---
  const generateContext = (data: UserData) => {
    const today = new Date().toLocaleDateString('ru-RU');

    const optimizedDb = {
      recent_reports: data.reports.slice(0, 6).map(r => ({ period: r.name, total_sales: r.metrics.sales, total_leads: r.metrics.leads })),
      active_proposals: data.proposals.slice(0, 15).map(p => ({ client: p.company, item: p.item, sum: p.amount, status: p.status })),
      recent_campaigns: data.campaigns.slice(0, 10),
      payments: data.payments.slice(0, 10),
      company_info: data.companyProfile.details
    };

    const conversationHistory = historyRef.current.slice(-8)
      .map(h => `${h.role === 'user' ? 'ПОЛЬЗОВАТЕЛЬ' : 'LUMI'}: ${h.text}`)
      .join('\n');

    return `
SYSTEM:
DATE: ${today}
IDENTITY: Ты Lumi — глобальный голосовой AI-помощник KZ TRANSIT и Teleport3D.
Твой стиль: умный, дружелюбный, деловой юмор уместен, но без болтовни.

CAPABILITIES:
- Отвечай на любые вопросы пользователя.
- Используй DATABASE и USER_NOTES как первоисточник о сервисе.
- Умеешь считать, сравнивать, анализировать, писать тексты, переводить.
- Если нужно — ищи в интернете через [googleSearch].

STRICT STYLE RULES:
1) ЯЗЫК: только русский, естественно и без акцента.
2) КРАТКОСТЬ: любой ответ (и голосом, и текстом) <= 400 символов.
3) СТРУКТУРА: 1–3 коротких предложения или список из 2–4 пунктов.
4) ЧИСЛА: говори понятно; в аудио произноси словами.
5) БЕЗ ВОДЫ: не объясняй очевидное, не повторяй вопрос.
6) КОНТЕКСТ: используй историю ниже.

TOOLS:
- googleSearch: используй только если в DATABASE/знаниях нет ответа.
- navigateToPage: если пользователь просит открыть раздел приложения.
Если инструмент не сработал — скажи кратко и предложи ручной вариант.

PREVIOUS_CONVERSATION_HISTORY:
${conversationHistory || "Диалог только начался."}

DATABASE (read-only, актуально):
${JSON.stringify(optimizedDb)}

USER_NOTES:
${data.companyProfile.aiSystemInstruction}
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
      const fullContext = generateContext(userData);

      // ✅ Расширенный список инструментов
      const toolsArray: any[] = [
        { googleSearch: {} },
        navigationFunctionDeclaration
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
          // ✅ Две модальности: текст + аудио
          responseModalities: [Modality.AUDIO, Modality.TEXT],
          speechConfig: {
            voiceConfig: {
              // ✅ Вернули гарантированно поддерживаемый голос
              prebuiltVoiceConfig: { voiceName: 'Aoede' }
            }
          },
          systemInstruction: fullContext,
          tools: toolsArray,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 600
          }
        },
        callbacks: {
          onopen: () => {
            if (!isSessionActive) return;
            setVoiceStatus('listening');
            setIsConnecting(false);
            console.log("Lumi Connected");

            // ✅ разрешаем стоп только через 1.5 секунды после старта
            allowStopRef.current = false;
            setTimeout(() => { allowStopRef.current = true; }, 1500);
          },

          onmessage: async (message: LiveServerMessage) => {
            if (!isSessionActive) return;

            // --- (A) Стрим входной/выходной транскрипции ---
            if (message.serverContent?.outputTranscription) {
              setVoiceStatus('speaking');
              aiTranscriptRef.current += message.serverContent.outputTranscription.text;
              setLiveAiTranscript(clamp400(aiTranscriptRef.current));
            }

            if (message.serverContent?.inputTranscription) {
              const chunk = message.serverContent.inputTranscription.text || "";
              userTranscriptRef.current += chunk;
              setLiveUserTranscript(userTranscriptRef.current);

              const normalized = userTranscriptRef.current.toLowerCase().trim();
