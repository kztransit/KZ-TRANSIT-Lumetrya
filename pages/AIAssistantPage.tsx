import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI, LiveSession, LiveServerMessage, Modality, Blob } from "@google/genai";
import { 
    getAIAssistantResponse, 
    analyzeReportImage, 
    analyzeProposalsImage, 
    analyzeCampaignsImage, 
    // Импортируем определения функций для локальной голосовой сессии
    createOtherReportFunctionDeclaration, 
    updateOtherReportKpiFunctionDeclaration, 
    createCommercialProposalFunctionDeclaration, 
    updateCommercialProposalFunctionDeclaration,
    navigationFunctionDeclaration 
} from '../services/geminiService';
import { UserData, Report, CommercialProposal, AdCampaign, OtherReport, OtherReportKpi } from '../types';
import { fileToBase64, decode, decodeAudioData, encode } from '../utils';

type UploadType = 'report' | 'proposals' | 'campaigns';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

// --- ГЕНЕРАТОР КОНТЕКСТА (СЖАТЫЙ И ОПТИМИЗИРОВАННЫЙ) ---
// Точно такой же, как в App.tsx, чтобы не было ошибок переполнения
const generateContext = (data: UserData) => {
    const today = new Date().toLocaleDateString('ru-RU');
    
    // Сжимаем данные в текст
    const reportStr = data.reports.map(r => `[ОТЧЕТ ${r.name}]: Продажи ${r.metrics.sales}, Лиды ${r.metrics.leads}, Бюджет ${r.metrics.budget}`).join('; ');
    const propStr = data.proposals.map(p => `[КП]: ${p.company || '?'}, ${p.item}, ${p.amount}тг, Статус: ${p.status}, Дата ${p.date}`).join('; ');
    const campStr = data.campaigns.map(c => `[РЕКЛАМА]: ${c.name}, Статус ${c.status}, Расход ${c.spend}, Конверсии ${c.conversions}`).join('; ');
    const payStr = data.payments.map(p => `[ПЛАТЕЖ]: ${p.serviceName}, ${p.amount} ${p.currency}, Дата ${p.nextPaymentDate}`).join('; ');
    const linksStr = data.links.map(l => `[ССЫЛКА]: ${l.url} (${l.comment})`).join('; ');
    const empStr = data.companyProfile.employees.map(e => `${e.name} (${e.position})`).join(', ');

    return `
    СЕГОДНЯ: ${today}
    ТВОЕ ИМЯ: Люми.
    РОЛЬ: Старший бизнес-аналитик, оператор системы, инженер и копирайтер компании ${data.companyProfile.companyName}.
    
    === ТВОИ ВОЗМОЖНОСТИ ===
    
    1. 🌐 ИНТЕРНЕТ-ПОИСК (Google):
       - Если вопрос требует внешних данных (новости, курсы, законы, ГОСТы) — ИСПОЛЬЗУЙ [googleSearch].
       - Ты инженер: консультируй по РТИ и 3D.

    2. 🧭 НАВИГАЦИЯ ПО САЙТУ:
       - Если просят открыть раздел — используй navigateToPage.
       - Карты: /dashboard, /reports, /proposals, /campaigns, /payments, /storage, /settings.

    3. 📝 СОЗДАНИЕ КП:
       - Умеешь создавать КП (createCommercialProposal).

    4. 📊 АНАЛИЗ ДАННЫХ:
       - Ты видишь ВСЮ сжатую базу (ниже). Анализируй, сравнивай, ищи ошибки.

    5. ✍️ ТЕКСТЫ:
       - Пиши письма, переводи, редактируй.

    ЯЗЫК: РУССКИЙ. Цифры словами.

    === ПОЛНАЯ БАЗА ДАННЫХ ===
    ПРОФИЛЬ: ${JSON.stringify(data.companyProfile.details)}
    СОТРУДНИКИ: ${empStr}
    ОТЧЕТЫ: ${reportStr || "Нет данных"}
    КП: ${propStr || "Нет данных"}
    РЕКЛАМА: ${campStr || "Нет данных"}
    ПЛАТЕЖИ: ${payStr || "Нет данных"}
    ССЫЛКИ: ${linksStr || "Нет данных"}
    ПРОЧЕЕ: ${JSON.stringify(data.otherReports)}
    
    ИНСТРУКЦИЯ ПОЛЬЗОВАТЕЛЯ: ${data.companyProfile.aiSystemInstruction}
    `;
};

const UploadTypeModal: React.FC<{onClose: () => void, onSelect: (type: UploadType) => void}> = ({onClose, onSelect}) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
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

const monthNames = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

const ConfirmReportImportModal: React.FC<{
    onClose: () => void,
    onSave: (name: string, date: string, directions: Report['directions']) => void,
    existingReports: Report[],
    initialData: Report['directions']
}> = ({ onClose, onSave, existingReports, initialData }) => {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [error, setError] = useState('');
    const [editableData, setEditableData] = useState<Report['directions']>(initialData);

    const handleMetricChange = (direction: 'РТИ' | '3D', metric: keyof Report['metrics'], value: string) => {
        const defaultMetrics = { budget: 0, clicks: 0, leads: 0, proposals: 0, invoices: 0, deals: 0, sales: 0 };
        setEditableData(prev => ({
            ...prev,
            [direction]: {
                ...(prev[direction] || defaultMetrics),
                [metric]: Number(value) || 0
            }
        }));
    };

    const handleSave = () => {
        setError('');
        const reportName = `Отчет ${monthNames[month - 1]} ${year}`;
        if (existingReports.some(r => r.name === reportName)) {
            setError(`Отчет для "${reportName}" уже существует.`);
            return;
        }
        const reportDate = new Date(year, month - 1, 1).toISOString().split('T')[0];
        onSave(reportName, reportDate, editableData);
    };
    
    const metricLabels: Record<keyof Report['metrics'], string> = {
      budget: 'Бюджет', clicks: 'Клики', leads: 'Лиды', proposals: 'КП', invoices: 'Счета', deals: 'Сделки', sales: 'Выручка'
    };

    return (
     <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b dark:border-slate-700"><h2 className="text-xl font-bold">Проверка и создание отчета</h2></div>
            <div className="p-6 space-y-4 overflow-y-auto">
                 <p className="text-slate-600 dark:text-slate-300">Проверьте извлеченные данные, внесите правки при необходимости и выберите период для нового отчета.</p>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm text-slate-500 block mb-1">Месяц</label>
                        <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full bg-gray-100 dark:bg-slate-700 p-2 rounded-lg">
                            {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm text-slate-500 block mb-1">Год</label>
                        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-full bg-gray-100 dark:bg-slate-700 p-2 rounded-lg"/>
                    </div>
                </div>
                 {error && <p className="text-red-500 text-sm">{error}</p>}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['РТИ', '3D'] as const).map(dir => (
                        <div key={dir} className="space-y-3 p-4 border dark:border-slate-600 rounded-lg">
                            <h3 className="font-semibold">{dir}</h3>
                            {Object.keys(metricLabels).map(key => (
                                <div key={key}>
                                    <label className="text-xs text-slate-500">{metricLabels[key as keyof typeof metricLabels]}</label>
                                    <input 
                                        type="number" 
                                        value={editableData[dir]?.[key as keyof Report['metrics']] ?? 0}
                                        onChange={e => handleMetricChange(dir, key as keyof Report['metrics'], e.target.value)}
                                        className="w-full bg-gray-50 dark:bg-slate-700 p-1.5 rounded-md text-sm"
                                    />
                                </div>
                            ))}
                        </div>
                    ))}
                 </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 mt-auto">
                <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 font-bold py-2 px-4 rounded-lg">Отмена</button>
                <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Создать</button>
            </div>
        </div>
    </div>
    )
};

const ConfirmProposalsImportModal: React.FC<{
    onClose: () => void;
    onSave: (proposals: Omit<CommercialProposal, 'id'>[]) => void;
    initialData: Omit<CommercialProposal, 'id'>[];
}> = ({ onClose, onSave, initialData }) => {
    const [proposals, setProposals] = useState(initialData);

    const handleFieldChange = (index: number, field: keyof CommercialProposal, value: any) => {
        const updated = [...proposals];
        (updated[index] as any)[field] = value;
        if (field === 'paymentDate') {
            updated[index].status = value ? 'Оплачено' : 'Ожидание';
        }
        setProposals(updated);
    };
    
    const handleDeleteRow = (index: number) => {
        setProposals(proposals.filter((_, i) => i !== index));
    };

    const handleGlobalDirectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newDirection = e.target.value;
        if (newDirection === 'keep') return;

        setProposals(prev => 
            prev.map(p => ({
                ...p,
                direction: newDirection as 'РТИ' | '3D'
            }))
        );
    };

    const handleSaveClick = () => {
        onSave(proposals);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b dark:border-slate-700"><h2 className="text-xl font-bold">Проверка и импорт КП</h2></div>
                <div className="p-6 overflow-auto">
                    <div className="flex justify-between items-center mb-4">
                        <p className="text-slate-600 dark:text-slate-300">Проверьте данные, извлеченные из файла. Вы можете их отредактировать или удалить строки перед импортом.</p>
                        <div className="flex items-center gap-2 shrink-0">
                             <label className="text-sm text-slate-500">Применить ко всем:</label>
                             <select onChange={handleGlobalDirectionChange} defaultValue="keep" className="bg-gray-100 dark:bg-slate-700 p-2 rounded-lg text-sm">
                                <option value="keep">--</option>
                                <option value="РТИ">РТИ</option>
                                <option value="3D">3D</option>
                             </select>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                           <thead>
                             <tr className="text-left text-xs text-slate-500">
                                {['Дата', 'Направление', 'Товар', 'Компания', 'Сумма', 'Статус', 'Действие'].map(h => <th key={h} className="p-2">{h}</th>)}
                             </tr>
                           </thead>
                           <tbody>
                            {proposals.map((p, i) => (
                                <tr key={i} className="border-b dark:border-slate-700 last:border-0">
                                    <td><input type="date" value={p.date} onChange={e => handleFieldChange(i, 'date', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md"/></td>
                                    <td>
                                        <select value={p.direction} onChange={e => handleFieldChange(i, 'direction', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md">
                                            <option value="РТИ">РТИ</option>
                                            <option value="3D">3D</option>
                                        </select>
                                    </td>
                                    <td><input type="text" value={p.item} onChange={e => handleFieldChange(i, 'item', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md"/></td>
                                    <td><input type="text" value={p.company || ''} onChange={e => handleFieldChange(i, 'company', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md"/></td>
                                    <td><input type="number" value={p.amount} onChange={e => handleFieldChange(i, 'amount', Number(e.target.value))} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md"/></td>
                                    <td>
                                        <select value={p.status} onChange={e => handleFieldChange(i, 'status', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md">
                                            <option>Ожидание</option><option>Оплачено</option><option>Отменено</option>
                                        </select>
                                    </td>
                                    <td><button onClick={() => handleDeleteRow(i)} className="text-red-500 p-1">🗑️</button></td>
                                </tr>
                            ))}
                           </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 mt-auto">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 font-bold py-2 px-4 rounded-lg">Отмена</button>
                    <button onClick={handleSaveClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Импортировать {proposals.length} КП</button>
                </div>
            </div>
        </div>
    );
};

const ConfirmCampaignsImportModal: React.FC<{
    onClose: () => void;
    onSave: (campaigns: Omit<AdCampaign, 'id'>[]) => void;
    initialData: Omit<AdCampaign, 'id'>[];
}> = ({ onClose, onSave, initialData }) => {
    const [campaigns, setCampaigns] = useState(initialData);

    const handleFieldChange = (index: number, field: keyof AdCampaign, value: any) => {
        const updated = [...campaigns];
        (updated[index] as any)[field] = value;
        setCampaigns(updated);
    };
    
    const handleDeleteRow = (index: number) => {
        setCampaigns(campaigns.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b dark:border-slate-700"><h2 className="text-xl font-bold">Проверка и импорт Кампаний</h2></div>
                <div className="p-6 overflow-auto">
                     <p className="text-slate-600 dark:text-slate-300 mb-4">Проверьте данные, извлеченные из файла. Вы можете их отредактировать или удалить строки перед импортом.</p>
                     <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                           <thead>
                             <tr className="text-left text-xs text-slate-500">
                                {['Название', 'Статус', 'Бюджет', 'Клики', 'Расходы', 'Действие'].map(h => <th key={h} className="p-2">{h}</th>)}
                             </tr>
                           </thead>
                           <tbody>
                            {campaigns.map((c, i) => (
                                <tr key={i} className="border-b dark:border-slate-700 last:border-0">
                                    <td><input type="text" value={c.name} onChange={e => handleFieldChange(i, 'name', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md"/></td>
                                    <td>
                                        <select value={c.status} onChange={e => handleFieldChange(i, 'status', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md">
                                            <option>Включено</option><option>Приостановлено</option><option>Завершено</option>
                                        </select>
                                    </td>
                                    <td><input type="number" value={c.budget} onChange={e => handleFieldChange(i, 'budget', Number(e.target.value))} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md"/></td>
                                    <td><input type="number" value={c.clicks} onChange={e => handleFieldChange(i, 'clicks', Number(e.target.value))} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md"/></td>
                                    <td><input type="number" value={c.spend} onChange={e => handleFieldChange(i, 'spend', Number(e.target.value))} className="w-full bg-gray-100 dark:bg-slate-700 p-1 rounded-md"/></td>
                                    <td><button onClick={() => handleDeleteRow(i)} className="text-red-500 p-1">🗑️</button></td>
                                </tr>
                            ))}
                           </tbody>
                        </table>
                    </div>
                </div>
                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3 mt-auto">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 font-bold py-2 px-4 rounded-lg">Отмена</button>
                    <button onClick={() => onSave(campaigns)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Импортировать {campaigns.length} Кампаний</button>
                </div>
            </div>
        </div>
    )
};

const WelcomeScreen: React.FC<{ onPromptClick: (prompt: string) => void }> = ({ onPromptClick }) => {
    const prompts = [
        "Найди в интернете курс тенге к доллару",
        "Какие ГОСТы есть на техпластину ТМКЩ?",
        "Проанализируй наши продажи за прошлый месяц",
        "Создай КП для компании Test на 100000 тенге",
    ];

    return (
        <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <div className="flex items-center justify-center gap-3 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" className="h-12 w-12" aria-hidden="true">
                    <circle cx="14" cy="20" r="11" fill="#2563eb" opacity="0.9" />
                    <circle cx="26" cy="20" r="11" fill="#16a34a" opacity="0.9" />
                </svg>
                <h1 className="text-5xl font-bold text-slate-800 dark:text-slate-100">Lumi</h1>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-lg">Я вижу ваши данные и имею доступ в интернет. Чем помочь?</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-8 w-full max-w-2xl">
                {prompts.map((prompt, index) => (
                    <button key={index} onClick={() => onPromptClick(prompt)} className="p-4 bg-white dark:bg-slate-800 hover:bg-blue-100/50 dark:hover:bg-blue-500/10 rounded-lg text-left text-slate-700 dark:text-slate-200 hover:text-blue-800 dark:hover:text-blue-400 transition-colors border border-gray-200/80 dark:border-slate-700/80 shadow-sm">
                        <p className="font-medium text-sm">{prompt}</p>
                    </button>
                ))}
            </div>
        </div>
    );
};

interface AIAssistantPageProps {
    userData: UserData;
    addReport: (report: Omit<Report, 'id'>) => void;
    addMultipleProposals: (proposals: Omit<CommercialProposal, 'id'>[]) => void;
    addMultipleCampaigns: (campaigns: Omit<AdCampaign, 'id'>[]) => void;
    addOtherReport: (report: Omit<OtherReport, 'id'>) => void;
    updateOtherReport: (report: OtherReport) => void;
    addProposal: (proposal: Omit<CommercialProposal, 'id'>) => void;
    updateProposal: (proposal: CommercialProposal) => void;
    isGlobalVoiceActive: boolean;
    onDisableGlobalVoice: () => void;
}

const AIAssistantPage: React.FC<AIAssistantPageProps> = ({ 
    userData, addReport, addMultipleProposals, addMultipleCampaigns, 
    addOtherReport, updateOtherReport, addProposal, updateProposal,
    isGlobalVoiceActive, onDisableGlobalVoice 
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [showWelcome, setShowWelcome] = useState(true);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const navigate = useNavigate();
    
    const [fileForUpload, setFileForUpload] = useState<File | null>(null);
    const [isUploadTypeModalOpen, setUploadTypeModalOpen] = useState(false);
    
    const [reportDataToCreate, setReportDataToCreate] = useState<Report['directions'] | null>(null);
    const [proposalsToConfirm, setProposalsToConfirm] = useState<Omit<CommercialProposal, 'id'>[] | null>(null);
    const [campaignsToConfirm, setCampaignsToConfirm] = useState<Omit<AdCampaign, 'id'>[] | null>(null);

    // Voice Conversation State
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionStatus, setSessionStatus] = useState<'idle' | 'connecting' | 'listening' | 'speaking'>('idle');
    const [liveUserTranscript, setLiveUserTranscript] = useState('');
    const [liveAiTranscript, setLiveAiTranscript] = useState('');
    const [error, setError] = useState('');
    
    const sessionRef = useRef<any>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const nextStartTimeRef = useRef(0);
    const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());
    const userTranscriptRef = useRef('');
    const aiTranscriptRef = useRef('');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(scrollToBottom, [messages, liveUserTranscript, liveAiTranscript]);
    
    const addMessage = (message: Omit<Message, 'id'>) => {
        setMessages(prev => [...prev, {...message, id: uuidv4()}]);
    }

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
      // Cleanup on component unmount
      return () => {
        if(sessionRef.current) {
            sessionRef.current.close();
        }
        cleanupSession();
      }
    }, [cleanupSession]);

    // Handle conflict with global voice control
    useEffect(() => {
        if (isGlobalVoiceActive && isSessionActive) {
            sessionRef.current?.close();
        }
    }, [isGlobalVoiceActive, isSessionActive]);


    const handleToggleVoiceSession = async () => {
        if (isSessionActive) {
            sessionRef.current?.close();
            // onclose callback handles the rest of the cleanup
            return;
        }

        if (isGlobalVoiceActive) {
            onDisableGlobalVoice();
        }

        if (showWelcome) setShowWelcome(false);
        setSessionStatus('connecting');
        setLiveUserTranscript('');
        setLiveAiTranscript('');
        userTranscriptRef.current = '';
        aiTranscriptRef.current = '';
        setError('');

        // --- ИСПРАВЛЕНИЕ КЛЮЧА ---
        const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;

        if (!apiKey) {
            setError("Ключ API для Gemini не найден. Голосовой помощник не может работать.");
            setSessionStatus('idle');
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey: apiKey });
            
            // --- ИСПРАВЛЕНИЕ КОНТЕКСТА (Сжатый) ---
            const fullContext = generateContext(userData);

            const sessionPromise = ai.live.connect({
                // --- ИСПРАВЛЕНИЕ МОДЕЛИ ---
                model: 'models/gemini-2.0-flash-exp',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: fullContext, // <-- Передаем сжатый контекст
                    inputAudioTranscription: {},
                    outputAudioTranscription: {},
                    tools: [
                        { googleSearch: {} },
                        {functionDeclarations: [
                        createOtherReportFunctionDeclaration,
                        updateOtherReportKpiFunctionDeclaration,
                        createCommercialProposalFunctionDeclaration,
                        updateCommercialProposalFunctionDeclaration,
                        navigationFunctionDeclaration // Добавил навигацию
                    ]}],
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
                                try { session.sendRealtimeInput({ media: pcmBlob }); } catch (e) {}
                            });
                        };
                        mediaStreamSourceRef.current.connect(scriptProcessorRef.current);
                        scriptProcessorRef.current.connect(inputAudioContextRef.current.destination);

                        setIsSessionActive(true);
                        setSessionStatus('listening');
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.serverContent?.outputTranscription) {
                            const text = message.serverContent.outputTranscription.text;
                            aiTranscriptRef.current += text;
                            setLiveAiTranscript(aiTranscriptRef.current);
                        }
                        if (message.serverContent?.inputTranscription) {
                            const text = message.serverContent.inputTranscription.text;
                            userTranscriptRef.current += text;
                            setLiveUserTranscript(userTranscriptRef.current);
                        }

                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                let functionResult = "Действие выполнено.";
                        
                                switch(fc.name) {
                                    case 'navigateToPage':
                                        navigate(fc.args.page as string);
                                        functionResult = `Переход на страницу ${fc.args.page} выполнен.`;
                                        break;
                                    case 'createOtherReport': {
                                        const args = fc.args as any;
                                        const kpis = (args.kpis || []).map((kpi: any) => ({ ...kpi, id: uuidv4() }));
                                        const newReport: Omit<OtherReport, 'id'> = { name: args.name, date: args.date || new Date().toISOString().split('T')[0], category: args.category, description: '', kpis: kpis };
                                        addOtherReport(newReport);
                                        functionResult = `Отчет "${newReport.name}" успешно создан.`;
                                        addMessage({ text: functionResult, sender: 'ai' });
                                        break;
                                    }
                                    case 'updateOtherReportKpi': {
                                        const args = fc.args as any;
                                        const reportToUpdate = userData.otherReports.find(r => r.name.toLowerCase() === args.reportName.toLowerCase());
                                        if (reportToUpdate) {
                                            const kpiToUpdate = reportToUpdate.kpis.find(k => k.name.toLowerCase() === args.kpiName.toLowerCase());
                                            if (kpiToUpdate) {
                                                const updatedKpis = reportToUpdate.kpis.map(k => k.id === kpiToUpdate.id ? { ...k, value: args.newValue } : k);
                                                updateOtherReport({ ...reportToUpdate, kpis: updatedKpis });
                                                functionResult = `KPI "${kpiToUpdate.name}" в отчете "${reportToUpdate.name}" обновлен.`;
                                            } else {
                                                functionResult = `Не нашел KPI с названием "${args.kpiName}" в отчете.`;
                                            }
                                        } else {
                                            functionResult = `Не нашел отчет с названием "${args.reportName}".`;
                                        }
                                        addMessage({ text: functionResult, sender: 'ai' });
                                        break;
                                    }
                                    case 'createCommercialProposal': {
                                        const args = fc.args as any;
                                        const newProposal: Omit<CommercialProposal, 'id'> = { date: args.date || new Date().toISOString().split('T')[0], direction: args.direction, proposalNumber: `КП-${Math.floor(Math.random() * 10000)}`, company: args.company, item: args.item, amount: args.amount, status: 'Ожидание', invoiceNumber: null, invoiceDate: null, paymentDate: null, paymentType: null };
                                        addProposal(newProposal);
                                        functionResult = `КП для "${newProposal.company}" на сумму ${newProposal.amount} успешно создано.`;
                                        addMessage({ text: functionResult, sender: 'ai' });
                                        break;
                                    }
                                    case 'updateCommercialProposal': {
                                        const args = fc.args as any;
                                        const proposalToUpdate = userData.proposals.find(p => p.company?.toLowerCase() === args.company.toLowerCase());
                                        if (proposalToUpdate) {
                                            const { fieldToUpdate, newValue } = args;
                                            const updatedProposal = { ...proposalToUpdate, [fieldToUpdate]: newValue };
                                            if (fieldToUpdate === 'status' && !['Оплачено', 'Ожидание', 'Отменено'].includes(newValue)) {
                                                functionResult = `Некорректный статус "${newValue}".`;
                                            } else {
                                                updateProposal(updatedProposal);
                                                functionResult = `КП для "${proposalToUpdate.company}" успешно обновлено.`;
                                            }
                                        } else {
                                            functionResult = `Не нашел КП для компании "${args.company}".`;
                                        }
                                        addMessage({ text: functionResult, sender: 'ai' });
                                        break;
                                    }
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
                            const finalUser = userTranscriptRef.current;
                            const finalAi = aiTranscriptRef.current;

                            if (finalUser.trim()) {
                                addMessage({ text: finalUser, sender: 'user' });
                            }
                            if (finalAi.trim()) {
                                addMessage({ text: finalAi, sender: 'ai' });
                            }

                            userTranscriptRef.current = '';
                            aiTranscriptRef.current = '';
                            setLiveUserTranscript('');
                            setLiveAiTranscript('');
                        }

                        const modelTurn = message.serverContent?.modelTurn;
                        if (modelTurn && modelTurn.parts) {
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
            // --- ИСПРАВЛЕНИЕ: Передаем СЖАТЫЙ контекст данных ---
            const fullContext = generateContext(userData);
            
            // ОТПРАВЛЯЕМ В СЕРВИС (С ПОДДЕРЖКОЙ GOOGLE SEARCH)
            const { text, functionCall } = await getAIAssistantResponse(textToSend, userData, fullContext);
            
            if (functionCall) {
                 let confirmationMessage = text;
                 switch(functionCall.name) {
                    case 'navigateToPage':
                        navigate(functionCall.args.page as string);
                        addMessage({ text: `Перехожу на страницу: ${functionCall.args.page}`, sender: 'ai' });
                        break;
                    case 'createOtherReport':
                        const kpis = (functionCall.args.kpis || []).map((kpi: any) => ({ ...kpi, id: uuidv4() }));
                        const newReport: Omit<OtherReport, 'id'> = {
                            name: functionCall.args.name,
                            date: functionCall.args.date || new Date().toISOString().split('T')[0],
                            category: functionCall.args.category,
                            description: '',
                            kpis: kpis,
                        };
                        addOtherReport(newReport);
                        confirmationMessage = confirmationMessage || `Отчет "${newReport.name}" успешно создан.`;
                        addMessage({ text: confirmationMessage, sender: 'ai' });
                        break;
                    case 'updateOtherReportKpi':
                        const reportToUpdate = userData.otherReports.find(r => r.name.toLowerCase() === functionCall.args.reportName.toLowerCase());
                        if (reportToUpdate) {
                            if (window.confirm(text || `Вы уверены, что хотите обновить KPI "${functionCall.args.kpiName}" в отчете "${reportToUpdate.name}"?`)) {
                                const kpiToUpdate = reportToUpdate.kpis.find(k => k.name.toLowerCase() === functionCall.args.kpiName.toLowerCase());
                                if (kpiToUpdate) {
                                    const updatedKpis = reportToUpdate.kpis.map(k => k.id === kpiToUpdate.id ? { ...k, value: functionCall.args.newValue } : k);
                                    updateOtherReport({ ...reportToUpdate, kpis: updatedKpis });
                                    addMessage({ text: `KPI "${kpiToUpdate.name}" в отчете "${reportToUpdate.name}" обновлен.`, sender: 'ai' });
                                } else {
                                    addMessage({ text: `Не нашел KPI с названием "${functionCall.args.kpiName}" в отчете.`, sender: 'ai' });
                                }
                            } else {
                                addMessage({ text: 'Действие отменено.', sender: 'ai' });
                            }
                        } else {
                            addMessage({ text: `Не нашел отчет с названием "${functionCall.args.reportName}".`, sender: 'ai' });
                        }
                        break;
                    case 'createCommercialProposal':
                        const newProposal: Omit<CommercialProposal, 'id'> = {
                            date: functionCall.args.date || new Date().toISOString().split('T')[0],
                            direction: functionCall.args.direction,
                            proposalNumber: `КП-${Math.floor(Math.random() * 10000)}`,
                            company: functionCall.args.company,
                            item: functionCall.args.item,
                            amount: functionCall.args.amount,
                            status: 'Ожидание',
                            invoiceNumber: null, invoiceDate: null, paymentDate: null, paymentType: null,
                        };
                        addProposal(newProposal);
                        confirmationMessage = confirmationMessage || `КП для "${newProposal.company}" на сумму ${newProposal.amount} успешно создано.`;
                        addMessage({ text: confirmationMessage, sender: 'ai' });
                        break;
                    case 'updateCommercialProposal':
                        const proposalToUpdate = userData.proposals.find(p => p.company?.toLowerCase() === functionCall.args.company.toLowerCase());
                        if (proposalToUpdate) {
                             if (window.confirm(text || `Вы уверены, что хотите обновить КП для "${proposalToUpdate.company}"?`)) {
                                const { fieldToUpdate, newValue } = functionCall.args;
                                const updatedProposal = { ...proposalToUpdate, [fieldToUpdate]: newValue };
                                 if (fieldToUpdate === 'status' && !['Оплачено', 'Ожидание', 'Отменено'].includes(newValue)) {
                                     addMessage({ text: `Некорректный статус "${newValue}". Доступные статусы: Оплачено, Ожидание, Отменено.`, sender: 'ai' });
                                     break;
                                 }
                                updateProposal(updatedProposal);
                                addMessage({ text: `КП для "${proposalToUpdate.company}" успешно обновлено.`, sender: 'ai' });
                             } else {
                                addMessage({ text: 'Действие отменено.', sender: 'ai' });
                             }
                        } else {
                            addMessage({ text: `Не нашел КП для компании "${functionCall.args.company}".`, sender: 'ai' });
                        }
                        break;
                    default:
                        if (text) addMessage({ text, sender: 'ai' });
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

    const handleAttachmentClick = () => fileInputRef.current?.click();

    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setFileForUpload(file);
            setUploadTypeModalOpen(true);
        }
        e.target.value = '';
    };

    const handleUploadTypeSelect = async (type: UploadType) => {
        setUploadTypeModalOpen(false);
        if (!fileForUpload) return;

        if (showWelcome) setShowWelcome(false);

        addMessage({ text: `Загружен файл: ${fileForUpload.name}`, sender: 'user' });
        setIsLoading(true);
        addMessage({ text: "Анализирую файл...", sender: 'ai' });

        try {
            const base64Data = await fileToBase64(fileForUpload);
            
            if (type === 'report') {
                const analysisResult = await analyzeReportImage(fileForUpload.type, base64Data);
                const parsedDirections = JSON.parse(analysisResult);
                const emptyMetrics = { budget: 0, clicks: 0, leads: 0, proposals: 0, invoices: 0, deals: 0, sales: 0 };
                const safeParsedDirections = parsedDirections || {};
                const rtiMetrics = { ...emptyMetrics, ...(safeParsedDirections['РТИ'] || {}) };
                const d3Metrics = { ...emptyMetrics, ...(safeParsedDirections['3D'] || {}) };
                setReportDataToCreate({ 'РТИ': rtiMetrics, '3D': d3Metrics });

            } else if (type === 'proposals') {
                const parsedProposalsData = await analyzeProposalsImage(fileForUpload.type, base64Data);
                const rtiProposals = (parsedProposalsData['РТИ'] || []).map(p => ({ ...p, direction: 'РТИ' as const }));
                const d3Proposals = (parsedProposalsData['3D'] || []).map(p => ({ ...p, direction: '3D' as const }));
                const allProposals = [...rtiProposals, ...d3Proposals];

                const newProposals = allProposals.map(p => ({
                    date: p.date || new Date().toISOString().split('T')[0],
                    direction: p.direction,
                    item: p.item || 'N/A',
                    amount: p.amount || 0,
                    company: p.company || null,
                    invoiceNumber: p.invoiceNumber || null,
                    invoiceDate: p.invoiceDate || null,
                    paymentDate: p.paymentDate || null,
                    status: (p.paymentDate ? 'Оплачено' : 'Ожидание') as CommercialProposal['status'],
                    paymentType: null,
                    proposalNumber: p.invoiceNumber || `КП-${Math.floor(Math.random() * 10000)}`
                }));
                setProposalsToConfirm(newProposals);
                addMessage({ text: `Обнаружено ${newProposals.length} КП. Пожалуйста, проверьте и подтвердите данные.`, sender: 'ai' });
            
            } else if (type === 'campaigns') {
                 const parsedCampaigns = await analyzeCampaignsImage(fileForUpload.type, base64Data);
                 const newCampaigns = parsedCampaigns.map(p => {
                    const statusStr = (p.status || '').toLowerCase();
                    let status: AdCampaign['status'] = 'Приостановлено';
                    if (statusStr.includes('включено') || statusStr.includes('eligible')) status = 'Включено';
                    if (statusStr.includes('завершено')) status = 'Завершено';

                    return {
                        name: p.name || 'N/A',
                        status: status,
                        type: ((p.name || '').toLowerCase().includes('поиск') ? 'Поиск' : 'Максимальная эффективность') as AdCampaign['type'],
                        budget: p.budget || 0,
                        budgetType: 'Дневной' as AdCampaign['budgetType'],
                        impressions: p.impressions || 0, clicks: p.clicks || 0, ctr: p.ctr || 0,
                        spend: p.spend || 0, conversions: p.conversions || 0, cpc: p.cpc || 0,
                        conversionRate: p.clicks && p.clicks > 0 ? ((p.conversions || 0) / p.clicks) * 100 : 0,
                        cpa: p.conversions && p.conversions > 0 ? (p.spend || 0) / p.conversions : 0,
                        strategy: 'Максимум конверсий', period: new Date().toLocaleDateString(),
                    };
                });
                setCampaignsToConfirm(newCampaigns);
                addMessage({ text: `Обнаружено ${newCampaigns.length} рекламных кампаний. Пожалуйста, проверьте и подтвердите данные.`, sender: 'ai' });
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Произошла ошибка при анализе файла.';
            addMessage({ text: `Ошибка: ${errorMessage}`, sender: 'ai' });
        } finally {
            setIsLoading(false);
            setFileForUpload(null);
        }
    };
    
    const handleSaveReportFromAI = (name: string, creationDate: string, directions: Report['directions']) => {
        const rtiMetrics = directions['РТИ'] || { budget: 0, clicks: 0, leads: 0, proposals: 0, invoices: 0, deals: 0, sales: 0 };
        const d3Metrics = directions['3D'] || { budget: 0, clicks: 0, leads: 0, proposals: 0, invoices: 0, deals: 0, sales: 0 };
        const totalMetrics = Object.keys(rtiMetrics).reduce((acc, key) => {
            (acc as any)[key] = (rtiMetrics as any)[key] + (d3Metrics as any)[key];
            return acc;
        }, {} as Report['metrics']);

        addReport({ name, creationDate, directions, metrics: totalMetrics });
        setReportDataToCreate(null);
        addMessage({ text: `Отчет "${name}" успешно создан!`, sender: 'ai' });
    };

    const handleConfirmProposals = (finalProposals: Omit<CommercialProposal, 'id'>[]) => {
        addMultipleProposals(finalProposals);
        setProposalsToConfirm(null);
        addMessage({ text: `Успешно импортировано ${finalProposals.length} коммерческих предложений.`, sender: 'ai' });
    };

    const handleConfirmCampaigns = (finalCampaigns: Omit<AdCampaign, 'id'>[]) => {
        addMultipleCampaigns(finalCampaigns);
        setCampaignsToConfirm(null);
        addMessage({ text: `Успешно импортировано ${finalCampaigns.length} рекламных кампаний.`, sender: 'ai' });
    };
    
    const getStatusText = () => {
        switch (sessionStatus) {
            case 'connecting': return 'Подключение...';
            case 'listening': return 'Слушаю...';
            case 'speaking': return 'Говорю...';
            default: return null;
        }
    }

    return (
        <div className="h-[calc(100vh-120px)] flex flex-col max-w-4xl mx-auto w-full">
            {isUploadTypeModalOpen && <UploadTypeModal onClose={() => setUploadTypeModalOpen(false)} onSelect={handleUploadTypeSelect} />}
            {reportDataToCreate && <ConfirmReportImportModal onClose={() => setReportDataToCreate(null)} onSave={handleSaveReportFromAI} existingReports={userData.reports} initialData={reportDataToCreate} />}
            {proposalsToConfirm && <ConfirmProposalsImportModal onClose={() => setProposalsToConfirm(null)} onSave={handleConfirmProposals} initialData={proposalsToConfirm} />}
            {campaignsToConfirm && <ConfirmCampaignsImportModal onClose={() => setCampaignsToConfirm(null)} onSave={handleConfirmCampaigns} initialData={campaignsToConfirm} />}
            
            <div className="flex-grow overflow-y-auto mb-4 p-1">
                 {showWelcome ? (
                    <WelcomeScreen onPromptClick={handleSend} />
                ) : (
                    <div className="space-y-4 p-4">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-slate-800 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.258 8.715L18 9.75l-.258-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.456-2.456L18 2.25l.258 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                                        </svg>
                                    </div>
                                )}
                                <div className={`px-4 py-2 rounded-2xl max-w-lg shadow ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start gap-3 justify-start">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-slate-800 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /><path strokeLinecap="round" strokeLinejoin="round" d="M18.258 8.715L18 9.75l-.258-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.456-2.456L18 2.25l.258 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" /></svg>
                                </div>
                                <div className="px-4 py-3 rounded-2xl max-w-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none">
                                    <div className="flex items-center space-x-1">
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {isSessionActive && (
                            <div className="text-sm p-2 bg-gray-100 dark:bg-slate-800 rounded-lg">
                                {liveUserTranscript && <p><span className="font-semibold">Вы:</span> {liveUserTranscript}</p>}
                                {liveAiTranscript && <p><span className="font-semibold">Lumi:</span> {liveAiTranscript}</p>}
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            
            <div className="relative">
                 {isSessionActive && (
                     <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-black/70 text-white text-sm rounded-full whitespace-nowrap">
                        {getStatusText()}
                     </div>
                )}
                {error && <p className="text-center text-red-500 text-sm mb-2">{error}</p>}

                <div className="bg-white dark:bg-slate-800 rounded-xl p-2 flex items-center shadow-lg">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept="image/*,application/pdf" />
                    <button onClick={handleAttachmentClick} title="Прикрепить файл" className="p-2 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors" disabled={isSessionActive}>
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
                        placeholder="Спросите Lumi о данных или попросите помочь..."
                        className="flex-grow bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none px-3"
                        disabled={isLoading || isSessionActive}
                    />
                    <button
                        onClick={() => handleSend()}
                        disabled={isLoading || input.trim() === '' || isSessionActive}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg p-2 transition-colors"
                    >
                       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                         <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                       </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIAssistantPage;
