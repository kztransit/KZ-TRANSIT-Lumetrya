import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getAIAssistantResponse } from '../services/geminiService';
import { UserData } from '../types';
import { fileToBase64 } from '../utils';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

interface AIAssistantPageProps {
    userData: UserData;
    [key: string]: any; 
}

// --- КОНТЕКСТ И ИНСТРУКЦИЯ ---
const generateContext = (data: UserData) => {
    const today = new Date().toLocaleDateString('ru-RU');
    
    const contextData = {
        last_reports: data.reports.slice(0, 3).map(r => ({ month: r.name, revenue: r.metrics.sales })),
        active_proposals: data.proposals.slice(0, 10).filter(p => p.status === 'Ожидание').length,
        company: data.companyProfile.details
    };

    return `
    CURRENT DATE: ${today}
    IDENTITY: Ты — Lumi, бизнес-ассистент и эксперт компании KZ TRANSIT.
    
    CAPABILITIES:
    1. Анализ документов (отчеты, КП, договора, технические схемы, резюме).
    2. Технические консультации (РТИ, 3D-печать, инженерия).
    3. Маркетинг и продажи (советы, тексты, стратегии).
    4. Поиск информации в интернете (курсы валют, ГОСТы, новости).

    COMMUNICATION RULES (STRICT):
    1. СТИЛЬ: Профессиональный, дружелюбный, без "воды".
    2. ФОРМАТ: 
       - ИСПОЛЬЗУЙ ЧИСТЫЙ ТЕКСТ.
       - НЕ ИСПОЛЬЗУЙ Markdown-символы (**жирный**, ## заголовки).
       - Для списков используй обычные дефисы (-).
       - Разделяй абзацы пустой строкой.
    3. ЯЗЫК: Русский.
    
    CONTEXT DATA: ${JSON.stringify(contextData)}
    USER INSTRUCTION: ${data.companyProfile.aiSystemInstruction}
    `;
};

const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ userData }) => {
    const [messages, setMessages] = useState<Message[]>([
        { 
            id: '1', 
            text: 'Привет! Я Lumi. Готова помочь с анализом, текстами или поиском информации.', 
            sender: 'ai'
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    const [showBetaNotice, setShowBetaNotice] = useState(true); // Состояние для уведомления
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if ((!input.trim() && !attachedFile) || isLoading) return;

        const userMsg: Message = { 
            id: uuidv4(), 
            text: input || (attachedFile ? `📎 Документ: ${attachedFile.name}` : ''), 
            sender: 'user' 
        };
        setMessages(prev => [...prev, userMsg]);
        const currentInput = input; 
        setInput('');
        setIsLoading(true);

        try {
            let fileData = undefined;
            if (attachedFile) {
                const base64 = await fileToBase64(attachedFile);
                fileData = { mimeType: attachedFile.type, base64 };
            }

            const prompt = currentInput || (attachedFile ? "Проанализируй этот документ. Опиши суть, ключевые моменты и дай рекомендации." : "");
            const context = generateContext(userData);
            
            const response = await getAIAssistantResponse(prompt, userData, context, fileData);
            
            setMessages(prev => [...prev, { 
                id: uuidv4(), 
                text: response.text || "Извините, не удалось получить ответ.", 
                sender: 'ai'
            }]);

        } catch (error) {
            setMessages(prev => [...prev, { id: uuidv4(), text: "Ошибка соединения. Попробуйте позже.", sender: 'ai' }]);
        } finally {
            setIsLoading(false);
            setAttachedFile(null);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setAttachedFile(e.target.files[0]);
        }
        e.target.value = '';
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] max-w-5xl mx-auto w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-slate-700 relative">
            
            {/* Header */}
            <div className="px-6 py-4 border-b bg-white dark:bg-slate-800 flex items-center gap-3 z-10 relative">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
                    L
                </div>
                <div>
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg leading-tight">Lumi</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Бизнес-ассистент</p>
                </div>
            </div>

            {/* BETA NOTICE (Уведомление) */}
            {showBetaNotice && (
                <div className="bg-blue-50 dark:bg-slate-700/50 border-b border-blue-100 dark:border-slate-600 px-6 py-3 flex items-start justify-between gap-4 animate-fade-in">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 text-blue-500 dark:text-blue-300">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <div>
                            <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">Lumi находится в стадии активной разработки 🚀</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                Сейчас я изучаю данные вашей компании, поэтому могу знать не всё. Полная интеграция скоро будет завершена. 
                                <br className="hidden sm:block"/>
                                Кстати, вы уже можете попробовать <b>Голосовой режим</b> — просто включите переключатель в боковом меню слева!
                            </p>
                        </div>
                    </div>
                    <button onClick={() => setShowBetaNotice(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50 dark:bg-slate-900/50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.sender === 'ai' && (
                                <div className="w-8 h-8 mt-1 rounded-full bg-blue-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-blue-600 font-bold text-xs">AI</div>
                            )}
                            <div className={`
                                px-5 py-3.5 rounded-2xl text-sm leading-relaxed whitespace-pre-line shadow-sm
                                ${msg.sender === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-gray-100 dark:border-slate-700'}
                            `}>
                                {msg.text}
                            </div>
                        </div>
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex justify-start gap-3">
                         <div className="w-8 h-8 mt-1 rounded-full bg-blue-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-blue-600 font-bold text-xs">AI</div>
                        <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm border border-gray-100 dark:border-slate-700">
                            <div className="flex gap-1.5">
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                {attachedFile && (
                    <div className="mb-3 flex items-center gap-3 bg-blue-50 dark:bg-slate-700 p-2.5 rounded-xl border border-blue-100 dark:border-slate-600 w-fit animate-fade-in">
                        <div className="w-8 h-8 bg-white dark:bg-slate-600 rounded-lg flex items-center justify-center text-lg shadow-sm">📄</div>
                        <div className="text-xs">
                            <p className="font-medium text-slate-700 dark:text-white max-w-[200px] truncate">{attachedFile.name}</p>
                            <p className="text-slate-500 dark:text-slate-400">{(attachedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={() => setAttachedFile(null)} className="ml-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">✕</button>
                    </div>
                )}

                <div className="flex gap-3 items-end bg-gray-50 dark:bg-slate-900 p-2 rounded-2xl border border-gray-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleFileSelect} 
                        className="hidden" 
                        accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xls,.xlsx" 
                    />
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
                        title="Прикрепить файл"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                    </button>
                    
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={attachedFile ? "Что сделать с файлом?" : "Задайте вопрос..."}
                        className="flex-1 bg-transparent border-0 focus:ring-0 p-3 max-h-32 resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none text-sm"
                        rows={1}
                        disabled={isLoading}
                        style={{minHeight: '44px'}}
                    />
                    
                    <button 
                        onClick={() => handleSend()} 
                        disabled={isLoading || (!input.trim() && !attachedFile)}
                        className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-md flex-shrink-0"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                    </button>
                </div>
                <p className="text-center text-[10px] text-slate-400 mt-2">Lumi помогает анализировать данные, но решения за вами.</p>
            </div>
        </div>
    );
};

export default AIAssistantPage;
