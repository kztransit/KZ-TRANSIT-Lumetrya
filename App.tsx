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
import { loadUserDataFromDB, saveUserDataToDB } from './services/indexedDB';
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
    
    // Effect to load data from IndexedDB on initial mount
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingData(true);
            try {
                const data = await loadUserDataFromDB();
                setUserData(data);
            } catch (error) {
                console.error("Failed to load data from IndexedDB, using initial data:", error);
            } finally {
                setIsLoadingData(false);
            }
        };
        loadData();
    }, []);
    

    // Effect to save user data to IndexedDB whenever it changes
    useEffect(() => {
        if (isLoadingData) return;
        saveUserDataToDB(userData).catch(error => {
            console.error("Could not save user data to IndexedDB.", error);
            alert("Ошибка! Не удалось сохранить данные. Ваши последние изменения могут быть потеряны после перезагрузки страницы.");
        });
    }, [userData, isLoadingData]);

    // Effect for Dark Mode
    useEffect(() => {
        document.documentElement.classList.toggle('dark', !!userData.companyProfile.darkModeEnabled);
    }, [userData.companyProfile.darkModeEnabled]);

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
                console.error("Failed to parse remembered user from localStorage", e);
                localStorage.removeItem('rememberedUser');
            }
        }
    }, []);

    const handleLogin = useCallback((email: string, pass: string, rememberMe: boolean) => {
        if (email === mockUser.email && pass === mockUser.password) {
            const userToLogin = { ...mockUser };
            delete userToLogin.password;
            setCurrentUser(userToLogin);
            if (rememberMe) {
                localStorage.setItem('rememberedUser', JSON.stringify(userToLogin));
            } else {
                localStorage.removeItem('rememberedUser');
            }
            return true;
        }
        return false;
    }, []);

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        localStorage.removeItem('rememberedUser');
    }, []);
    
    const crudFunctions = useMemo(() => ({
        // REPORTS
        setReports: (updater: Report[] | ((prevReports: Report[]) => Report[])) => {
            setUserData(prev => ({
                ...prev,
                reports: typeof updater === 'function' ? updater(prev.reports) : updater,
            }));
        },
        addReport: (report: Omit<Report, 'id'>) => {
            const newReport = { ...report, id: uuidv4() };
            setUserData(prev => ({
                ...prev,
                reports: [newReport, ...prev.reports],
            }));
        },
        updateReport: (updatedReport: Report) => {
            setUserData(prev => ({
                ...prev,
                reports: prev.reports.map(r => r.id === updatedReport.id ? updatedReport : r),
            }));
        },
        deleteReport: (id: string) => {
            setUserData(prev => ({
                ...prev,
                reports: prev.reports.filter(r => r.id !== id),
            }));
        },

        // OTHER REPORTS
        addOtherReport: (report: Omit<OtherReport, 'id'>) => {
            const newReport = { ...report, id: uuidv4() };
            setUserData(prev => ({
                ...prev,
                otherReports: [newReport, ...prev.otherReports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            }));
        },
        updateOtherReport: (updatedReport: OtherReport) => {
            setUserData(prev => ({
                ...prev,
                otherReports: prev.otherReports.map(r => r.id === updatedReport.id ? updatedReport : r).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            }));
        },
        deleteOtherReport: (id: string) => {
            setUserData(prev => ({
                ...prev,
                otherReports: prev.otherReports.filter(r => r.id !== id),
            }));
        },

        // PROPOSALS
        setProposals: (updater: CommercialProposal[] | ((prevProposals: CommercialProposal[]) => CommercialProposal[])) => {
            setUserData(prev => ({
                ...prev,
                proposals: typeof updater === 'function' ? updater(prev.proposals) : updater,
            }));
        },
        addProposal: (proposal: Omit<CommercialProposal, 'id'>) => {
            const newProposal = { ...proposal, id: uuidv4() };
            setUserData(prev => ({
                ...prev,
                proposals: [newProposal, ...prev.proposals],
            }));
        },
        updateProposal: (updatedProposal: CommercialProposal) => {
            setUserData(prev => ({
                ...prev,
                proposals: prev.proposals.map(p => p.id === updatedProposal.id ? updatedProposal : p),
            }));
        },
        addMultipleProposals: (proposals: Omit<CommercialProposal, 'id'>[]) => {
            const newProposals = proposals.map(p => ({ ...p, id: uuidv4() }));
            setUserData(prev => ({
                ...prev,
                proposals: [...newProposals, ...prev.proposals],
            }));
        },
        deleteProposal: (id: string) => {
            setUserData(prev => ({
                ...prev,
                proposals: prev.proposals.filter(p => p.id !== id),
            }));
        },

        // CAMPAIGNS
        setCampaigns: (updater: AdCampaign[] | ((prevCampaigns: AdCampaign[]) => AdCampaign[])) => {
            setUserData(prev => ({
                ...prev,
                campaigns: typeof updater === 'function' ? updater(prev.campaigns) : updater,
            }));
        },
        addCampaign: (campaign: Omit<AdCampaign, 'id'>) => {
             const newCampaign = { ...campaign, id: uuidv4() };
             setUserData(prev => ({
                ...prev,
                campaigns: [newCampaign, ...prev.campaigns],
             }));
        },
        addMultipleCampaigns: (campaigns: Omit<AdCampaign, 'id'>[]) => {
            const newCampaigns = campaigns.map(c => ({ ...c, id: uuidv4() }));
            setUserData(prev => ({
                ...prev,
                campaigns: [...newCampaigns, ...prev.campaigns],
            }));
        },
        deleteCampaign: (id: string) => {
            setUserData(prev => ({
                ...prev,
                campaigns: prev.campaigns.filter(c => c.id !== id),
            }));
        },

        // LINKS
        addLink: (link: Omit<Link, 'id'>) => {
            const newLink = { ...link, id: uuidv4() };
            setUserData(prev => ({
                ...prev,
                links: [newLink, ...prev.links],
            }));
        },
        deleteLink: (id: string) => {
            setUserData(prev => ({
                ...prev,
                links: prev.links.filter(l => l.id !== id),
            }));
        },
        
        // FILES
        addFile: (fileData: Omit<StoredFile, 'id'>) => {
            const newFile = { ...fileData, id: uuidv4() };
            setUserData(prev => ({
                ...prev,
                files: [newFile, ...prev.files],
            }));
            return newFile;
        },
        deleteFile: (id: string) => {
            setUserData(prev => ({
                ...prev,
                files: prev.files.filter(f => f.id !== id),
            }));
        },

        // PAYMENTS
        addPayment: (payment: Omit<Payment, 'id'>) => {
            const newPayment = { ...payment, id: uuidv4() };
            setUserData(prev => ({
                ...prev,
                payments: [newPayment, ...prev.payments].sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime()),
            }));
        },
        updatePayment: (updatedPayment: Payment) => {
            setUserData(prev => ({
                ...prev,
                payments: prev.payments.map(p => p.id === updatedPayment.id ? updatedPayment : p).sort((a, b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime()),
            }));
        },
        deletePayment: (id: string) => {
            setUserData(prev => ({
                ...prev,
                payments: prev.payments.filter(p => p.id !== id),
            }));
        },
        
        // COMPANY PROFILE
        setCompanyProfile: (profile: CompanyProfile) => {
            setUserData(prev => ({
                ...prev,
                companyProfile: profile,
            }));
        },

        // ALL USER DATA
        setAllUserData: (data: UserData) => {
            setUserData(data);
        },
    }), []);
    
    // Voice Control Logic
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
        return () => {
            sessionRef.current?.close();
            cleanupVoiceSession();
        };
    }, [cleanupVoiceSession]);

    const handleNavigation = (page: string) => {
        navigate(page);
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

        // --- ИСПРАВЛЕНИЕ: Получаем ключ через import.meta.env ---
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

        if (!apiKey) {
            console.error("Gemini API key not found.");
            alert("Ошибка: API ключ не найден. Убедитесь, что он добавлен в Vercel (VITE_GOOGLE_API_KEY).");
            cleanupVoiceSession();
            return;
        }
        
        try {
            // --- ИСПРАВЛЕНИЕ: Используем переменную apiKey ---
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            const sessionPromise = ai.live.connect({
                // Если будет ошибка 404/Модель не найдена, попробуйте заменить название ниже на: 'gemini-2.0-flash-exp'
                model: 'gemini-2.5-flash-native-audio-preview-09-2025', 
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: userData.companyProfile.aiSystemInstruction,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [{functionDeclarations: [navigationFunctionDeclaration, createCommercialProposalFunctionDeclaration]}],
                },
                callbacks: {
                    onopen: async () => {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaStreamRef.current = stream;

                        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                        
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (event) => {
                            const inputData = event.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
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
                                let functionResult = "Действие выполнено."; // Default result
                        
                                if (fc.name === 'navigateToPage' && fc.args.page) {
                                   handleNavigation(fc.args.page as string);
                                   functionResult = `Переход на страницу ${fc.args.page} выполнен.`;
                                }
                        
                                if (fc.name === 'createCommercialProposal') {
                                   const { company, item, amount, direction, date } = fc.args as any;
                                   
                                   let normalizedDirection: 'РТИ' | '3D' = 'РТИ';
                                   if (typeof direction === 'string' && direction.toUpperCase() === '3D') {
                                       normalizedDirection = '3D';
                                   }
                        
                                   crudFunctions.addProposal({
                                       date: date || new Date().toISOString().split('T')[0],
                                       direction: normalizedDirection,
                                       proposalNumber: `КП-${Math.floor(10000 + Math.random() * 90000)}`,
                                       company: company,
                                       item: item,
                                       amount: amount,
                                       status: 'Ожидание',
                                       invoiceNumber: null,
                                       invoiceDate: null,
                                       paymentDate: null,
                                       paymentType: null,
                                   });
                                   functionResult = `Коммерческое предложение для компании ${company} успешно создано.`;
                                }
                        
                                sessionPromise.then((session) => {
                                   session.sendToolResponse({
                                       functionResponses: {
                                           id: fc.id,
                                           name: fc.name,
                                           response: { result: functionResult },
                                       }
                                   });
                                });
                            }
                        }

                        if (message.serverContent?.turnComplete) {
                            userTranscriptRef.current = '';
                            aiTranscriptRef.current = '';
                            setTimeout(() => {
                                setLiveUserTranscript('');
                                setLiveAiTranscript('');
                                setVoiceStatus('listening');
                            }, 2000);
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
                    onerror: (e: ErrorEvent) => {
                        console.error("Live session error:", e);
                        cleanupVoiceSession();
                    },
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (err) {
            console.error("Failed to start voice session:", err);
            cleanupVoiceSession();
        }
    };
    
    if (isLoadingData) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-100 dark:bg-slate-900">
                <div className="text-center">
                     <Logo className="mx-auto h-14 w-auto" />
                     <div className="mt-4 flex items-center justify-center space-x-2 text-slate-500 dark:text-slate-400">
                        <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Загрузка данных...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!currentUser) {
        return <LoginPage onLogin={handleLogin} />;
    }

    return (
            <div className="flex h-screen bg-gray-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200">
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
                    <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 dark:bg-slate-900 p-4 sm:p-6 lg:p-8 relative">
                        <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="lg:hidden fixed top-4 left-4 z-20 p-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm rounded-full text-gray-600 dark:text-gray-300 shadow-md">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                        <Routes>
                            <Route path="/" element={<Navigate to="/dashboard" replace />} />
                            <Route path="/dashboard" element={<DashboardPage reports={userData.reports} proposals={userData.proposals}/>} />
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
                                    onDisableGlobalVoice={() => sessionRef.current?.close()}
                                />
                            } />
                            <Route path="/reports" element={<ReportsPage reports={userData.reports} addReport={crudFunctions.addReport} deleteReport={crudFunctions.deleteReport} updateReport={crudFunctions.updateReport} />} />
                             <Route path="/other-reports" element={
                                <OtherReportsPage
                                    reports={userData.otherReports}
                                    addReport={crudFunctions.addOtherReport}
                                    updateReport={crudFunctions.updateOtherReport}
                                    deleteReport={crudFunctions.deleteOtherReport}
                                />
                            } />
                            <Route path="/proposals" element={<CommercialProposalsPage proposals={userData.proposals} addProposal={crudFunctions.addProposal} deleteProposal={crudFunctions.deleteProposal} setProposals={crudFunctions.setProposals} updateProposal={crudFunctions.updateProposal} />} />
                            <Route path="/compare" element={<ComparePeriodsPage reports={userData.reports} />} />
                            <Route path="/conversions" element={<ConversionsPage reports={userData.reports} />} />
                            <Route path="/net-conversions" element={<NetConversionsPage reports={userData.reports} updateReport={crudFunctions.updateReport} />} />
                            <Route path="/campaigns" element={<AdCampaignsPage campaigns={userData.campaigns} addCampaign={crudFunctions.addCampaign} deleteCampaign={crudFunctions.deleteCampaign} setCampaigns={crudFunctions.setCampaigns} />} />
                            <Route path="/unit-economics" element={<UnitEconomicsPage proposals={userData.proposals} reports={userData.reports} />} />
                            <Route path="/storage" element={<CloudStoragePage links={userData.links} files={userData.files} addLink={crudFunctions.addLink} deleteLink={crudFunctions.deleteLink} addFile={crudFunctions.addFile} deleteFile={crudFunctions.deleteFile} />} />
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
                        <footer className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8 py-4 border-t border-gray-200 dark:border-slate-800">
                           © {new Date().getFullYear()} Lumetrya. AI ассистент для управления и анализа данных компании.
                        </footer>
                    </main>
                </div>
                {isVoiceControlActive && (
                    <VoiceAssistantOverlay 
                        status={voiceStatus}
                        userTranscript={liveUserTranscript}
                        aiTranscript={liveAiTranscript}
                        onClose={() => sessionRef.current?.close()}
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
