import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
    getAIAssistantResponse, 
    analyzeReportImage, 
    analyzeProposalsImage, 
    analyzeCampaignsImage
} from '../services/geminiService';
import { UserData } from '../types';
import { fileToBase64 } from '../utils';

// --- ТИПЫ ---
interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
    suggestions?: string[]; // Кнопки-подсказки
    isSystemInfo?: boolean; // Скрытые технические сообщения (например, "файл прочитан")
}

interface AIAssistantPageProps {
    userData: UserData;
    // Остальные пропсы оставляем для совместимости с App.tsx, но не используем
    [key: string]: any; 
}

// --- ГЕНЕРАЦИЯ КОНТЕКСТА ---
const generateContext = (data: UserData) => {
    const today = new Date().toLocaleDateString('ru-RU');
    
    // Сжатый контекст данных компании
    const knowledgeBase = {
        reports: data.reports.slice(0, 3).map(r => ({ period: r.name, metrics: r.metrics })),
        activeProposals: data.proposals.filter(p => p.status === 'Ожидание').slice(0, 10),
        recentCampaigns: data.campaigns.slice(0, 5),
        company: data.companyProfile.details
    };

    return `
    SYSTEM_CONTEXT:
    DATE: ${today}
    ROLE: Ты — Lumi, стратегический консультант и бизнес-аналитик KZ TRANSIT.
    
    DATA SNAPSHOT: ${JSON.stringify(knowledgeBase)}

    INSTRUCTIONS:
    1. Твоя цель — помогать принимать решения, а не просто заполнять таблицы.
    2. Если пользователь присылает данные (текст или файл), проанализируй их, найди риски и возможности.
    3. Отвечай на РУССКОМ языке. Форматирование: Markdown.
    4. Будь лаконична, структурируй ответ (используй буллиты).
    
    USER CUSTOM INSTRUCTIONS:
    ${data.companyProfile.aiSystemInstruction}
    `;
};

const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ userData }) => {
    const [messages, setMessages] = useState<Message[]>([
        { 
            id: '1', 
            text: 'Привет! Я Lumi. Я готова проанализировать ваши документы или обсудить стратегию. С чего начнем?', 
            sender: 'ai',
            suggestions: ['Анализ продаж за месяц', 'Оценка эффективности рекламы', 'Прогноз выручки']
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    // Состояние для прикрепленного файла
    const [attachedFile, setAttachedFile] = useState<File | null>(null);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
    useEffect(scrollToBottom, [messages]);

    // Функция получения подсказок на основе ответа (Эмуляция, в идеале должен давать ИИ)
    const generateSuggestions = (aiText: string): string[] => {
        const text = aiText.toLowerCase();
        if (text.includes('отчет') || text.includes('продаж')) return ['Сравни с прошлым месяцем', 'Где мы теряем деньги?', 'Составь план роста'];
        if (text.includes('кп') || text.includes('предложение')) return ['Оцени маржинальность', 'Как повысить вероятность сделки?', 'Напиши follow-up письмо'];
        if (text.includes('кампани') || text.includes('реклам')) return ['Оптимизируй бюджет', 'Какой канал эффективнее?', 'Придумай новый оффер'];
        if (text.includes('риск') || text.includes('проблем')) return ['Предложи решение', 'Кто виноват?', 'Как избежать этого?'];
        return ['Подробнее', 'Сделай выводы', 'Другой вопрос'];
    };

    const handleSend = async (textOverride?: string) => {
        const textToSend = textOverride || input;
        if ((!textToSend.trim() && !attachedFile) || isLoading) return;

        // 1. Добавляем сообщение пользователя
        const newMessage: Message = { 
            id: uuidv4(), 
            text: textToSend || (attachedFile ? `📎 Документ: ${attachedFile.name}` : ''), 
            sender: 'user' 
        };
        setMessages(prev => [...prev, newMessage]);
        setInput('');
        setIsLoading(true);
        
        // Очищаем подсказки у предыдущих сообщений
        setMessages(prev => prev.map(m => ({ ...m, suggestions: undefined })));

        try {
            let contextData = "";

            // 2. Если есть файл, сначала "читаем" его через наши сервисы
            if (attachedFile) {
                const base64 = await fileToBase64(attachedFile);
                let fileContent = "";
                
                // Пытаемся понять, что это, и извлечь текст/данные
                // Используем существующие функции как "OCR движки"
                try {
                    // Попробуем прогнать как отчет (он возвращает самый чистый JSON с цифрами)
                    // В идеале тут нужна универсальная функция analyzeDocument, но мы используем то, что есть
                    const rawData = await analyzeReportImage(attachedFile.type, base64);
                    fileContent = `ДАННЫЕ ИЗ ФАЙЛА "${attachedFile.name}":\n${rawData}`;
                } catch (e) {
                    // Если не вышло как отчет, пробуем как КП (там другая структура)
                    try {
                        const rawData = await analyzeProposalsImage(attachedFile.type, base64);
                        fileContent = `ДАННЫЕ ИЗ ФАЙЛА "${attachedFile.name}":\n${JSON.stringify(rawData)}`;
                    } catch (e2) {
                        fileContent = `Не удалось автоматически извлечь структуру из файла, но пользователь его прикрепил.`;
                    }
                }
                
                contextData = fileContent;
                setAttachedFile(null); // Сбрасываем файл после отправки
            }

            // 3. Формируем промпт: (Системный контекст + Данные из файла + Вопрос пользователя)
            const systemContext = generateContext(userData);
            const finalPrompt = `
                ${contextData ? `ВОТ ДАННЫЕ ИЗ ЗАГРУЖЕННОГО ДОКУМЕНТА:\n${contextData}\n\n` : ''}
                ВОПРОС ПОЛЬЗОВАТЕЛЯ: ${textToSend}
            `;

            // 4. Отправляем в Gemini
            const response = await getAIAssistantResponse(finalPrompt, userData, systemContext);
            const responseText = response.text || "Не удалось получить ответ.";

            // 5. Добавляем ответ ИИ с новыми кнопками
            setMessages(prev => [...prev, { 
                id: uuidv4(), 
                text: responseText, 
                sender: 'ai',
                suggestions: generateSuggestions(responseText)
            }]);

        } catch (error) {
            setMessages(prev => [...prev, { id: uuidv4(), text: "Произошла ошибка. Попробуйте еще раз.", sender: 'ai' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setAttachedFile(e.target.files[0]);
        }
        e.target.value = ''; // Reset input
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] max-w-5xl mx-auto w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-slate-700">
            
            {/* Header */}
            <div className="p-4 border-b bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
                        L
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 dark:text-white text-lg">Lumi Аналитик</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Загрузите отчет или задайте вопрос</p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/30 dark:bg-slate-800">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                        <div className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            {msg.sender === 'ai' && (
                                <div className="w-8 h-8 mt-1 rounded-full bg-cyan-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-cyan-700 font-bold text-xs">AI</div>
                            )}
                            
                            <div className={`
                                px-5 py-3.5 rounded-2xl shadow-sm text-sm leading-relaxed whitespace-pre-line
                                ${msg.sender === 'user' 
                                    ? 'bg-blue-600 text-white rounded-br-none' 
                                    : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none border border-gray-100 dark:border-slate-600'}
                            `}>
                                {msg.text}
                            </div>
                        </div>

                        {/* Кнопки-подсказки (только для последнего сообщения AI) */}
                        {msg.suggestions && (
                            <div className="mt-3 ml-11 flex flex-wrap gap-2">
                                {msg.suggestions.map((sugg, idx) => (
                                    <button 
                                        key={idx}
                                        onClick={() => handleSend(sugg)}
                                        className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-slate-700 dark:hover:bg-slate-600 text-blue-700 dark:text-blue-200 text-xs font-medium rounded-lg transition-colors border border-blue-100 dark:border-slate-600"
                                    >
                                        {sugg}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
                
                {isLoading && (
                    <div className="flex justify-start gap-3">
                         <div className="w-8 h-8 mt-1 rounded-full bg-cyan-100 dark:bg-slate-700 flex-shrink-0 flex items-center justify-center text-cyan-700 font-bold text-xs">AI</div>
                        <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm border border-gray-100 dark:border-slate-600">
                            <div className="flex gap-1.5">
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                {/* Превью прикрепленного файла */}
                {attachedFile && (
                    <div className="mb-3 flex items-center gap-2 bg-blue-50 dark:bg-slate-700 p-2 rounded-lg w-fit border border-blue-100 dark:border-slate-600">
                        <span className="text-xl">📄</span>
                        <div className="text-xs">
                            <p className="font-semibold text-slate-700 dark:text-white truncate max-w-[200px]">{attachedFile.name}</p>
                            <p className="text-slate-500 dark:text-slate-400">{(attachedFile.size / 1024).toFixed(1)} KB</p>
                        </div>
                        <button onClick={() => setAttachedFile(null)} className="ml-2 text-slate-400 hover:text-red-500">✕</button>
                    </div>
                )}

                <div className="flex gap-3 items-end bg-gray-50 dark:bg-slate-900 p-2 rounded-2xl border border-gray-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-sm">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf" />
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-xl transition-all"
                        title="Прикрепить документ для анализа"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                    </button>
                    
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder={attachedFile ? "Опишите, что сделать с файлом..." : "Задайте вопрос или загрузите отчет..."}
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
                <p className="text-center text-xs text-slate-400 mt-2">Lumi помогает анализировать данные, но решения за вами.</p>
            </div>
        </div>
    );
};

export default AIAssistantPage;
