

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from "@google/genai";
import { getAIAssistantResponse, analyzeReportImage, analyzeProposalsImage, analyzeCampaignsImage } from '../services/geminiService';
import { UserData, Report, CommercialProposal, AdCampaign } from '../types';
import { fileToBase64, decode, decodeAudioData, encode } from '../utils';


type UploadType = 'report' | 'proposals' | 'campaigns';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

const UploadTypeModal: React.FC<{onClose: () => void, onSelect: (type: UploadType) => void}> = ({onClose, onSelect}) => (
    <div className="fixed inset-0 bg-black/60 z-[101] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <h2 className="text-xl font-bold">Анализ файла</h2>
                <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-2xl">&times;</button>
            </div>
            <div className="p-6">
                <p className="text-slate-600 dark:text-slate-300 mb-4">Какой тип данных содержится в файле?</p>
                <div className="space-y-3">
                    <button onClick={() => onSelect('report')} className="w-full text-left p-3 bg-gray-100 hover:bg-blue-100 dark:bg-slate-700 dark:hover:bg-blue-500/20 rounded-lg">Маркетинговый отчет</button>
                    <button onClick={() => onSelect('proposals')} className="w-full text-left p-3 bg-gray-100 hover:bg-blue-100 dark:bg-slate-700 dark:hover:bg-blue-500/20 rounded-lg">Коммерческие предложения</button>
                    <button onClick={() => onSelect('campaigns')} className="w-full text-left p-3 bg-gray-100 hover:bg-blue-100 dark:bg-slate-700 dark:hover:bg-blue-500/20 rounded-lg">Рекламные кампании</button>
                </div>
            </div>
        </div>
    </div>
);

const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

const WelcomeScreen: React.FC<{ onPromptClick: (prompt: string) => void }> = ({ onPromptClick }) => {
    const prompts = [
        "Проанализируй последние отчеты",
        "Сравни продажи за последние два месяца",
        "Какие уплотнения из EPDM у нас есть?",
        "Напиши письмо клиенту о новом предложении",
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <h1 className="text-5xl font-bold text-slate-800 dark:text-slate-100 mb-4">Lumi</h1>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Здравствуйте! Чем я могу помочь вам сегодня?</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-2xl">
                {prompts.map((prompt, index) => (
                    <button 
                        key={index} 
                        onClick={() => onPromptClick(prompt)}
                        className="p-4 bg-white dark:bg-slate-800 hover:bg-blue-100/50 dark:hover:bg-blue-500/10 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:text-blue-800 dark:hover:text-blue-400 transition-colors border border-gray-200/80 dark:border-slate-700/80 shadow-sm"
                    >
                        <p className="font-medium text-sm">{prompt}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

interface AIAssistantModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData: UserData;
    addReport: (report: Omit<Report, 'id'>) => void;
    addMultipleProposals: (proposals: Omit<CommercialProposal, 'id'>[]) => void;
    addMultipleCampaigns: (campaigns: Omit<AdCampaign, 'id'>[]) => void;
    handleNavigation: (page: string) => void;
}


const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ isOpen, onClose, userData, addReport, addMultipleProposals, addMultipleCampaigns, handleNavigation }) => {
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [showWelcome, setShowWelcome] = useState(true);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [fileForUpload, setFileForUpload] = useState<File | null>(null);
    const [isUploadTypeModalOpen, setUploadTypeModalOpen] = useState(false);
    
    // Voice Conversation State
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
    const [currentTurn, setCurrentTurn] = useState({ user: '', ai: '' });
    const [error, setError] = useState('');
    
    const sessionRef = useRef<any>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    useEffect(scrollToBottom, [messages, currentTurn]);
    
    const addMessage = (message: Omit<Message, 'id'>) => setMessages(prev => [...prev, {...message, id: uuidv4()}]);

    const cleanupSession = useCallback(() => {
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
        
        setIsSessionActive(false);
        setSessionStatus('idle');
    }, []);
    
    useEffect(() => {
        if (!isOpen && sessionRef.current) {
            sessionRef.current.close();
            cleanupSession();
        }
        if (isOpen) {
            setMessages([]);
            setShowWelcome(true);
            setInput('');
            setIsLoading(false);
            setError('');
        }
    }, [isOpen, cleanupSession]);

    const handleToggleVoiceSession = async () => {
        if (isSessionActive) {
            sessionRef.current?.close();
            return;
        }

        if (showWelcome) setShowWelcome(false);
        setSessionStatus('connecting');
        setCurrentTurn({ user: '', ai: '' });
        setError('');

        if (!process.env.API_KEY) {
            setError("Ключ API для Gemini не найден. Голосовой помощник не может работать.");
            setSessionStatus('idle');
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: userData.companyProfile.aiSystemInstruction,
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                },
                callbacks: {
                    onopen: async () => {
                        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                        mediaStreamRef.current = stream;
                        
                        inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                        outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
                        
                        mediaStreamSourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
                        scriptProcessorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        
                        scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) {
                                int16[i] = inputData[i] * 32768;
                            }
                            const pcmBlob: Blob = {
                                data: encode(new Uint8Array(int16.buffer)),
                                mimeType: 'audio/pcm;rate=16000',
                            };
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);

                        setIsSessionActive(true);
                        setSessionStatus('listening');
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            setCurrentTurn(prev => ({ ...prev, ai: prev.ai + message.serverContent.outputTranscription.text }));
                        }
                        if (message.serverContent?.inputTranscription) {
                            setCurrentTurn(prev => ({ ...prev, user: prev.user + message.serverContent.inputTranscription.text }));
                        }

                        if (message.serverContent?.turnComplete) {
                            const finalUser = currentTurn.user;
                            const finalAi = currentTurn.ai;
                            if (finalUser.trim()) addMessage({ text: finalUser, sender: 'user' });
                            if (finalAi.trim()) addMessage({ text: finalAi, sender: 'ai' });
                            setCurrentTurn({ user: '', ai: '' });
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
                    onclose: () => cleanupSession(),
                    onerror: (e: ErrorEvent) => {
                        console.error("Live session error:", e);
                        setError('Произошла ошибка сессии. Попробуйте снова.');
                        cleanupSession();
                    },
                }
            });
            sessionRef.current = await sessionPromise;
        } catch(err) {
            console.error("Failed to start voice session:", err);
            setError(err instanceof Error ? `Ошибка: ${err.message}` : 'Не удалось начать голосовую сессию.');
            cleanupSession();
        }
    };


    const handleSend = async (promptText?: string) => {
        const textToSend = promptText || input;
        if (textToSend.trim() === '' || isLoading) return;
        
        if (showWelcome) setShowWelcome(false);

        addMessage({ text: textToSend, sender: 'user' });
        setInput('');
        setIsLoading(true);
        
        try {
            const instruction = userData.companyProfile.aiSystemInstruction;
// FIX: Refactored logic to correctly handle function calls and prevent duplicate messages.
            const { text, functionCall } = await getAIAssistantResponse(textToSend, userData, instruction);

            if (functionCall) {
                if (functionCall.name === 'navigateToPage') {
                    addMessage({ text: text || `Перехожу в раздел...`, sender: 'ai' });
                    handleNavigation(functionCall.args.page);
                }
            } else if (text) {
                addMessage({ text, sender: 'ai' });
            }
        } catch (error) {
            addMessage({ text: 'Извините, произошла ошибка. Попробуйте позже.', sender: 'ai' });
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!isOpen) return null;
    
    const getStatusText = () => {
        switch (sessionStatus) {
            case 'connecting': return 'Подключение...';
            case 'listening': return 'Слушаю...';
            case 'speaking': return 'Говорю...';
            default: return null;
        }
    }


    return (
        <>
            {isUploadTypeModalOpen && <UploadTypeModal onClose={() => setUploadTypeModalOpen(false)} onSelect={() => {}} />}

            <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose}></div>
            
            <style>{`
                @keyframes slide-in-right { from { transform: translateX(100%); } to { transform: translateX(0); } }
                .animate-slide-in-right { animation: slide-in-right 0.3s ease-out forwards; }
            `}</style>

            <div 
                className="fixed top-0 right-0 bottom-0 bg-gray-100 dark:bg-slate-900 shadow-2xl w-full max-w-lg flex flex-col p-4 animate-slide-in-right z-50"
            >
                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">AI Помощник</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-2xl z-10">&times;</button>
                </div>
                
                <div className="flex-grow overflow-y-auto mb-4 p-1">
                    {showWelcome ? (
                        <WelcomeScreen onPromptClick={handleSend} />
                    ) : (
                        <div className="space-y-4 p-4">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                     {msg.sender === 'ai' && ( <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-slate-800 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.258 8.715L18 9.75l-.258-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.456-2.456L18 2.25l.258 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg></div> )}
                                    <div className={`px-4 py-2 rounded-2xl max-w-lg shadow ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}><p className="text-sm whitespace-pre-wrap">{msg.text}</p></div>
                                </div>
                            ))}
                            {isLoading && ( <div className="flex items-start gap-3 justify-start"> <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-slate-800 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.258 8.715L18 9.75l-.258-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.456-2.456L18 2.25l.258 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg></div> <div className="px-4 py-3 rounded-2xl max-w-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none"><div className="flex items-center space-x-1"><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div><div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div></div></div></div> )}
                            {isSessionActive && ( <div className="text-sm p-2 bg-gray-100 dark:bg-slate-800 rounded-lg"> {currentTurn.user && <p><span className="font-semibold">Вы:</span> {currentTurn.user}</p>} {currentTurn.ai && <p><span className="font-semibold">Lumi:</span> {currentTurn.ai}</p>}</div> )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
                
                <div className="relative mt-auto flex-shrink-0">
                    {isSessionActive && ( <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-black/70 text-white text-sm rounded-full whitespace-nowrap">{getStatusText()}</div> )}
                    {error && <p className="text-center text-red-500 text-sm mb-2">{error}</p>}
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-2 flex items-center shadow-lg">
                        <input type="file" ref={fileInputRef} onChange={() => {}} className="hidden" accept="image/*,application/pdf" />
                        <button title="Прикрепить файл" className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" disabled={isSessionActive}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" /></svg>
                        </button>
                        <button onClick={handleToggleVoiceSession} title="Голосовой ввод" className={`p-2 rounded-full transition-colors ${isSessionActive ? 'text-red-500 bg-red-100 dark:bg-red-900/50 animate-pulse' : 'text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                           {isSessionActive ? (
                               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" /></svg>
                           ) : (
                               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m12 0v-1.5a6 6 0 0 0-6-6v0a6 6 0 0 0-6 6v1.5m6 7.5v3.75m-3.75-3.75h7.5" /></svg>
                           )}
                        </button>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Спросите Lumi..."
                            className="flex-grow bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none px-3"
                            disabled={isLoading || isSessionActive}
                        />
                        <button onClick={() => handleSend()} disabled={isLoading || input.trim() === '' || isSessionActive} className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg p-2 transition-colors">
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" /></svg>
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AIAssistantModal;