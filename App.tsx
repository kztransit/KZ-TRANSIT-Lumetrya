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
 * ✅ Если у тебя navigationFunctionDeclaration импортируется из другого файла — удали этот блок.
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

      const ai = new GoogleGenAI({ apiKey });
      const fullContext = generateContext(userData);

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
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Aoede' } // ✅ стабильный голос
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

            // ✅ разрешаем "стоп" только через 1.5 секунды после старта
            allowStopRef.current = false;
            setTimeout(() => { allowStopRef.current = true; }, 1500);
          },

          // ✅ ВАЖНО: этот onmessage гарантированно закрыт по скобкам
          onmessage: async (message: LiveServerMessage) => {
            if (!isSessionActive) return;

            // --- (A) Стрим выходной транскрипции AI ---
            if (message.serverContent?.outputTranscription) {
              setVoiceStatus('speaking');
              aiTranscriptRef.current += message.serverContent.outputTranscription.text;
              setLiveAiTranscript(clamp400(aiTranscriptRef.current));
            }

            // --- (B) Стрим входной транскрипции пользователя ---
            if (message.serverContent?.inputTranscription) {
              const chunk = message.serverContent.inputTranscription.text || "";
              userTranscriptRef.current += chunk;
              setLiveUserTranscript(userTranscriptRef.current);

              const normalized = userTranscriptRef.current.toLowerCase().trim();

              if (
                allowStopRef.current &&
                normalized.length >= 4 &&
                /(^|\s)(стоп|stop|остановись|хватит)(\s|$)/i.test(normalized)
              ) {
                stopEverything();
                return;
              }
            } // ✅ закрыли if inputTranscription

            // --- (C) Обработка modelTurn (TEXT + AUDIO + tools) ---
            const modelTurn = message.serverContent?.modelTurn;
            if (modelTurn?.parts) {
              for (const part of modelTurn.parts) {
                // TEXT
                const text = (part as any).text;
                if (text) {
                  const t = clamp400(text);
                  aiTranscriptRef.current += t;
                  setLiveAiTranscript(clamp400(aiTranscriptRef.current));
                }

                // TOOLS
                const functionCall = (part as any).functionCall;
                if (functionCall?.name === "navigateToPage") {
                  const page = functionCall.args?.page;
                  if (page) {
                    try { navigate(page); } catch (e) {}
                  }
                  try {
                    sessionRef.current?.sendToolResponse({
                      functionResponses: [{
                        name: functionCall.name,
                        response: { success: true, page }
                      }]
                    } as any);
                  } catch (e) {}
                }

                // AUDIO
                const base64Audio = (part as any).inlineData?.data;
                if (base64Audio && outputAudioContextRef.current) {
                  const outCtx = outputAudioContextRef.current;
                  const audioBuffer = await decodeAudioData(
                    decode(base64Audio),
                    outCtx,
                    24000,
                    1
                  );

                  const now = outCtx.currentTime;
                  if (nextStartTimeRef.current < now) nextStartTimeRef.current = now + 0.05;

                  const src = outCtx.createBufferSource();
                  src.buffer = audioBuffer;
                  src.connect(outCtx.destination);
                  src.start(nextStartTimeRef.current);

                  nextStartTimeRef.current += audioBuffer.duration;
                  audioSourcesRef.current.add(src);
                  src.onended = () => audioSourcesRef.current.delete(src);
                }
              }
            }

            // --- (D) Завершение хода: сохраняем историю ---
            if (message.serverContent?.turnComplete) {
              const userText = userTranscriptRef.current.trim();
              const aiText = aiTranscriptRef.current.trim();

              if (userText) historyRef.current.push({ role: 'user', text: userText });
              if (aiText) historyRef.current.push({ role: 'ai', text: aiText });

              if (historyRef.current.length > 20) {
                historyRef.current = historyRef.current.slice(-20);
              }

              userTranscriptRef.current = '';
              aiTranscriptRef.current = '';

              setTimeout(() => {
                if (isSessionActive) {
                  setLiveUserTranscript('');
                  setLiveAiTranscript('');
                  setVoiceStatus('listening');
                }
              }, 1200);
            }
          },

          onclose: () => { if (isSessionActive) { isSessionActive = false; stopEverything(); } },
          onerror: () => { if (isSessionActive) { isSessionActive = false; stopEverything(); } }
        }
      });

      const session = await sessionPromise;
      if (!isSessionActive) { session.close(); stopEverything(); return; }

      sessionRef.current = session;

      // ✅ авто-приветствие после установки sessionRef
      try {
        sessionRef.current.sendMessage({
          text: "Привет! Я Lumi. Скажи, чем помочь."
        } as any);
      } catch (e) {}

      // --- (E) Стрим микрофона в Gemini ---
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
    if (isVoiceControlActive) stopEverything();
    else connectToGemini();
  };

  if (isLoadingData) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-center">
          <Logo className="mx-auto h-14 w-auto" />
          <div className="mt-4 text-slate-500">Загрузка...</div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-gray-100 text-slate-800">
      <Sidebar
        isOpen={isSidebarOpen}
        setOpen={setSidebarOpen}
        companyProfile={userData.companyProfile}
        setCompanyProfile={crudFunctions.setCompanyProfile}
        onLogout={handleLogout}
        isVoiceControlActive={isVoiceControlActive}
        onToggleVoiceControl={handleToggleVoiceControl}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-4 sm:p-6 lg:p-8 relative">
          <button
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="lg:hidden fixed top-4 left-4 z-20 p-2 bg-white/60 rounded-full shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none"
                 viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage reports={userData.reports} proposals={userData.proposals} />} />

            <Route path="/ai-assistant" element={
              <AIAssistantPage
                userData={userData}
                addReport={crudFunctions.addReport}
                addMultipleProposals={crudFunctions.addMultipleProposals}
                addMultipleCampaigns={crudFunctions.addMultipleCampaigns}
                addOtherReport={crudFunctions.addOtherReport}
                updateOtherReport={crudFunctions.updateOtherReport}
                addProposal={crudFunctions.addProposal}
                updateProposal={crudFunctions.updateProposal}
                isGlobalVoiceActive={isVoiceControlActive}
                onDisableGlobalVoice={() => stopEverything()}
              />
            } />

            <Route path="/reports" element={
              <ReportsPage
                reports={userData.reports}
                addReport={crudFunctions.addReport}
                deleteReport={crudFunctions.deleteReport}
                updateReport={crudFunctions.updateReport}
              />
            } />

            <Route path="/other-reports" element={
              <OtherReportsPage
                reports={userData.otherReports}
                addReport={crudFunctions.addOtherReport}
                updateReport={crudFunctions.updateOtherReport}
                deleteReport={crudFunctions.deleteOtherReport}
              />
            } />

            <Route path="/proposals" element={
              <CommercialProposalsPage
                proposals={userData.proposals}
                addProposal={crudFunctions.addProposal}
                deleteProposal={crudFunctions.deleteProposal}
                setProposals={crudFunctions.setProposals}
                updateProposal={crudFunctions.updateProposal}
              />
            } />

            <Route path="/compare" element={<ComparePeriodsPage reports={userData.reports} />} />
            <Route path="/conversions" element={<ConversionsPage reports={userData.reports} />} />
            <Route path="/net-conversions" element={<NetConversionsPage reports={userData.reports} updateReport={crudFunctions.updateReport} />} />

            <Route path="/campaigns" element={
              <AdCampaignsPage
                campaigns={userData.campaigns}
                addCampaign={crudFunctions.addCampaign}
                deleteCampaign={crudFunctions.deleteCampaign}
                setCampaigns={crudFunctions.setCampaigns}
              />
            } />

            <Route path="/unit-economics" element={<UnitEconomicsPage proposals={userData.proposals} reports={userData.reports} />} />

            <Route path="/storage" element={
              <CloudStoragePage
                links={userData.links}
                files={userData.files}
                addLink={crudFunctions.addLink}
                deleteLink={crudFunctions.deleteLink}
                addFile={crudFunctions.addFile}
                deleteFile={crudFunctions.deleteFile}
              />
            } />

            <Route path="/payments" element={
              <PaymentsPage
                payments={userData.payments}
                files={userData.files}
                addPayment={crudFunctions.addPayment}
                updatePayment={crudFunctions.updatePayment}
                deletePayment={crudFunctions.deletePayment}
                addFile={crudFunctions.addFile}
              />
            } />

            <Route path="/settings" element={
              <SettingsPage
                fullUserData={userData}
                setAllUserData={crudFunctions.setAllUserData}
                setCompanyProfile={crudFunctions.setCompanyProfile}
              />
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>

      {isVoiceControlActive && (
        <VoiceAssistantOverlay
          status={voiceStatus}
          userTranscript={liveUserTranscript}
          aiTranscript={liveAiTranscript}
          onClose={handleToggleVoiceControl}
        />
      )}
    </div>
  );
};

const AppWithRouter: React.FC = () => (
  <HashRouter>
    <App />
  </HashRouter>
);

export default AppWithRouter;
