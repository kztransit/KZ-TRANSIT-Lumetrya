import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { 
    getAIAssistantResponse, 
    analyzeReportImage, 
    analyzeProposalsImage, 
    analyzeCampaignsImage 
} from '../services/geminiService';
import { UserData, Report, CommercialProposal, AdCampaign, OtherReport } from '../types';
import { fileToBase64 } from '../utils';

// --- ТИПЫ ---
type UploadType = 'report' | 'proposals' | 'campaigns';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

// --- МОДАЛЬНЫЕ ОКНА (Оставляем без изменений) ---

const UploadTypeModal: React.FC<{onClose: () => void, onSelect: (type: UploadType) => void}> = ({onClose, onSelect}) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center">
                <h2 className="text-xl font-bold dark:text-white">Анализ файла</h2>
                <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-2xl">&times;</button>
            </div>
            <div className="p-6">
                <p className="text-slate-600 dark:text-slate-300 mb-4">Какой тип данных содержится в файле?</p>
                <div className="space-y-3">
                    <button onClick={() => onSelect('report')} className="w-full text-left p-3 bg-gray-100 hover:bg-blue-100 dark:bg-slate-700 dark:hover:bg-blue-500/20 rounded-lg dark:text-white">Маркетинговый отчет</button>
                    <button onClick={() => onSelect('proposals')} className="w-full text-left p-3 bg-gray-100 hover:bg-blue-100 dark:bg-slate-700 dark:hover:bg-blue-500/20 rounded-lg dark:text-white">Коммерческие предложения</button>
                    <button onClick={() => onSelect('campaigns')} className="w-full text-left p-3 bg-gray-100 hover:bg-blue-100 dark:bg-slate-700 dark:hover:bg-blue-500/20 rounded-lg dark:text-white">Рекламные кампании</button>
                </div>
            </div>
        </div>
    </div>
);

const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

const ConfirmReportImportModal: React.FC<any> = ({ onClose, onSave, existingReports, initialData }) => {
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
        if (existingReports.some((r: any) => r.name === reportName)) {
            setError(`Отчет для "${reportName}" уже существует.`);
            return;
        }
        // Исправленная дата
        const reportDate = `${year}-${String(month).padStart(2, '0')}-01`;
        onSave(reportName, reportDate, editableData);
    };
    
    const metricLabels: Record<keyof Report['metrics'], string> = {
      budget: 'Бюджет', clicks: 'Клики', leads: 'Лиды', proposals: 'КП', invoices: 'Счета', deals: 'Сделки', sales: 'Выручка'
    };

    return (
     <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b dark:border-slate-700"><h2 className="text-xl font-bold dark:text-white">Проверка и создание отчета</h2></div>
            <div className="p-6 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm block dark:text-slate-300">Месяц</label><select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full bg-gray-100 dark:bg-slate-700 p-2 rounded dark:text-white">{monthNames.map((n, i) => <option key={n} value={i+1}>{n}</option>)}</select></div>
                    <div><label className="text-sm block dark:text-slate-300">Год</label><input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-full bg-gray-100 dark:bg-slate-700 p-2 rounded dark:text-white"/></div>
                </div>
                 {error && <p className="text-red-500 text-sm">{error}</p>}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['РТИ', '3D'] as const).map(dir => (
                        <div key={dir} className="space-y-3 p-4 border rounded dark:border-slate-600">
                            <h3 className="font-semibold dark:text-white">{dir}</h3>
                            {Object.keys(metricLabels).map(key => (
                                <div key={key}><label className="text-xs dark:text-slate-400">{metricLabels[key as keyof typeof metricLabels]}</label><input type="number" value={editableData[dir]?.[key as keyof Report['metrics']] ?? 0} onChange={e => handleMetricChange(dir, key as keyof Report['metrics'], e.target.value)} className="w-full bg-gray-50 dark:bg-slate-600 p-1 rounded text-sm dark:text-white"/></div>
                            ))}
                        </div>
                    ))}
                 </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3"><button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 dark:text-white px-4 py-2 rounded">Отмена</button><button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded">Создать</button></div>
        </div>
    </div>
    )
};

const ConfirmProposalsImportModal: React.FC<any> = ({ onClose, onSave, initialData }) => {
     const [proposals, setProposals] = useState(initialData);
    const handleFieldChange = (index: number, field: keyof CommercialProposal, value: any) => {
        const updated = [...proposals];
        (updated[index] as any)[field] = value;
        setProposals(updated);
    };
    const handleDeleteRow = (index: number) => setProposals(proposals.filter((_: any, i: number) => i !== index));
    const handleGlobalDirectionChange = (e: any) => {
        if(e.target.value === 'keep') return;
        setProposals((prev: any[]) => prev.map(p => ({...p, direction: e.target.value})));
    };
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b dark:border-slate-700"><h2 className="text-xl font-bold dark:text-white">Импорт КП</h2></div>
                <div className="p-6 overflow-auto">
                    <div className="flex justify-between mb-4"><p className="dark:text-slate-300">Проверьте данные</p><select onChange={handleGlobalDirectionChange} className="bg-gray-100 dark:bg-slate-700 p-2 rounded dark:text-white"><option value="keep">--</option><option value="РТИ">РТИ</option><option value="3D">3D</option></select></div>
                    <table className="w-full text-sm dark:text-slate-200"><tbody>{proposals.map((p: any, i: number) => (
                        <tr key={i} className="border-b dark:border-slate-700"><td><input value={p.date} onChange={e => handleFieldChange(i, 'date', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-600 p-1"/></td><td><input value={p.item} onChange={e => handleFieldChange(i, 'item', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-600 p-1"/></td><td><input value={p.amount} onChange={e => handleFieldChange(i, 'amount', e.target.value)} className="w-full bg-gray-100 dark:bg-slate-600 p-1"/></td><td><button onClick={() => handleDeleteRow(i)} className="text-red-500">x</button></td></tr>
                    ))}</tbody></table>
                </div>
                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3"><button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 px-4 py-2 rounded dark:text-white">Отмена</button><button onClick={() => onSave(proposals)} className="bg-blue-600 text-white px-4 py-2 rounded">Импорт</button></div>
            </div>
        </div>
    );
};

const ConfirmCampaignsImportModal: React.FC<any> = ({ onClose, onSave, initialData }) => {
    const [campaigns, setCampaigns] = useState(initialData);
    const handleDeleteRow = (index: number) => setCampaigns(campaigns.filter((_:any, i:number) => i !== index));
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b dark:border-slate-700"><h2 className="text-xl font-bold dark:text-white">Импорт Кампаний</h2></div>
                <div className="p-6 overflow-auto"><table className="w-full text-sm dark:text-slate-200"><tbody>{campaigns.map((c:any, i:number) => (
                    <tr key={i} className="border-b dark:border-slate-700"><td>{c.name}</td><td>{c.status}</td><td>{c.spend}</td><td><button onClick={() => handleDeleteRow(i)} className="text-red-500">x</button></td></tr>
                ))}</tbody></table></div>
                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3"><button onClick={onClose} className="bg-gray-200 dark:bg-slate-600 px-4 py-2 rounded dark:text-white">Отмена</button><button onClick={() => onSave(campaigns)} className="bg-blue-600 text-white px-4 py-2 rounded">Импорт</button></div>
            </div>
        </div>
    )
};

const WelcomeScreen: React.FC<{ onPromptClick: (prompt: string) => void }> = ({ onPromptClick }) => {
    const prompts = [
        "Какой курс доллара на сегодня?",
        "Какие есть ГОСТы на техпластину?",
        "Сделай краткий анализ наших продаж",
        "Переведи 'счет на оплату' на английский",
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
            <p className="text-slate-500 dark:text-slate-400 text-lg">Я могу искать информацию в интернете и анализировать ваши данные.</p>
            
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

// --- ГЕНЕРАЦИЯ БЕЗОПАСНОГО КОНТЕКСТА (Чтобы чат не вылетал) ---
const generateSafeContext = (data: UserData) => {
    const today = new Date().toLocaleDateString('ru-RU');
    
    // Оставляем только свежие данные
    const knowledgeBase = {
        reports: data.reports.slice(0, 6).map(r => ({ period: r.name, metrics: r.metrics })),
        proposals: data.proposals.slice(0, 30).map(p => ({ client: p.company, item: p.item, price: p.amount, status: p.status, type: p.direction })),
        campaigns: data.campaigns.slice(0, 15).map(c => ({ name: c.name, status: c.status, spend: c.spend })),
        payments: data.payments.slice(0, 10),
        links: data.links,
        storageFiles: data.files.map(f => f.name),
        companyInfo: data.companyProfile.details
    };

    return `
    SYSTEM_CONTEXT:
    DATE: ${today}
    ROLE: Ты — Lumi, интеллектуальный текстовый ассистент компании KZ TRANSIT.
    
    YOUR KNOWLEDGE BASE (JSON):
    ${JSON.stringify(knowledgeBase)}

    INSTRUCTIONS:
    1. Анализируй данные из JSON выше.
    2. Отвечай на РУССКОМ языке.
    3. Будь вежлива, полезна и профессиональна.
    4. Используй Markdown для форматирования.
    
    USER CUSTOM INSTRUCTIONS:
    ${data.companyProfile.aiSystemInstruction}
    `;
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
    isGlobalVoiceActive, onDisableGlobalVoice 
}) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [showWelcome, setShowWelcome] = useState(true);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    const [fileForUpload, setFileForUpload] = useState<File | null>(null);
    const [isUploadTypeModalOpen, setUploadTypeModalOpen] = useState(false);
    
    const [reportDataToCreate, setReportDataToCreate] = useState<Report['directions'] | null>(null);
    const [proposalsToConfirm, setProposalsToConfirm] = useState<Omit<CommercialProposal, 'id'>[] | null>(null);
    const [campaignsToConfirm, setCampaignsToConfirm] = useState<Omit<AdCampaign, 'id'>[] | null>(null);

    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
    useEffect(scrollToBottom, [messages]);
    
    const addMessage = (message: Omit<Message, 'id'>) => {
        setMessages(prev => [...prev, {...message, id: uuidv4()}]);
    }

    const handleSend = async (promptText?: string) => {
        const textToSend = promptText || input;
        if (textToSend.trim() === '' || isLoading) return;
        
        if (isGlobalVoiceActive) onDisableGlobalVoice();
        if (showWelcome) setShowWelcome(false);

        addMessage({ text: textToSend, sender: 'user' });
        setInput('');
        setIsLoading(true);
        
        try {
            const fullContext = generateSafeContext(userData);
            const response = await getAIAssistantResponse(textToSend, userData, fullContext);
            
            addMessage({ 
                text: response.text || "Извините, я задумалась. Попробуйте спросить иначе.", 
                sender: 'ai' 
            });

        } catch (error) {
            console.error(error);
            addMessage({ text: 'Извините, произошла ошибка. Попробуйте позже.', sender: 'ai' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAttachmentClick = () => fileInputRef.current?.click();
    const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) { setFileForUpload(e.target.files[0]); setUploadTypeModalOpen(true); }
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
                setReportDataToCreate({ 'РТИ': {...emptyMetrics, ...(parsedDirections['РТИ']||{})}, '3D': {...emptyMetrics, ...(parsedDirections['3D']||{})} });
            } else if (type === 'proposals') {
                const parsed = await analyzeProposalsImage(fileForUpload.type, base64Data);
                setProposalsToConfirm((parsed['РТИ']||[]).concat(parsed['3D']||[]));
                addMessage({ text: `Обнаружено КП. Проверьте данные.`, sender: 'ai' });
            } else if (type === 'campaigns') {
                 const parsed = await analyzeCampaignsImage(fileForUpload.type, base64Data);
                 setCampaignsToConfirm(parsed);
                 addMessage({ text: `Обнаружено кампаний: ${parsed.length}`, sender: 'ai' });
            }
        } catch (err) {
            addMessage({ text: `Ошибка анализа: ${err instanceof Error ? err.message : 'Неизвестная'}`, sender: 'ai' });
        } finally {
            setIsLoading(false);
            setFileForUpload(null);
        }
    };
    
    // Функции сохранения
    const handleSaveReportFromAI = (name: string, creationDate: string, directions: Report['directions']) => {
        // Важно: суммируем метрики при сохранении
        const rti = directions['РТИ'];
        const d3 = directions['3D'];
        const totalMetrics = {
            budget: (rti.budget||0) + (d3.budget||0),
            clicks: (rti.clicks||0) + (d3.clicks||0),
            leads: (rti.leads||0) + (d3.leads||0),
            proposals: (rti.proposals||0) + (d3.proposals||0),
            invoices: (rti.invoices||0) + (d3.invoices||0),
            deals: (rti.deals||0) + (d3.deals||0),
            sales: (rti.sales||0) + (d3.sales||0),
        };

        addReport({ name, creationDate, directions, metrics: totalMetrics });
        setReportDataToCreate(null);
        addMessage({ text: `Отчет "${name}" создан.`, sender: 'ai' });
    };
    
    const handleConfirmProposals = (final: any[]) => { 
        addMultipleProposals(final); 
        setProposalsToConfirm(null); 
        addMessage({ text: `Импортировано КП: ${final.length}`, sender: 'ai' }); 
    };
    
    const handleConfirmCampaigns = (final: any[]) => { 
        addMultipleCampaigns(final); 
        setCampaignsToConfirm(null); 
        addMessage({ text: `Импортировано кампаний: ${final.length}`, sender: 'ai' }); 
    };

    return (
        <div className="flex flex-col h-[calc(100vh-100px)] max-w-5xl mx-auto w-full bg-white dark:bg-slate-800 rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-slate-700">
            {isUploadTypeModalOpen && <UploadTypeModal onClose={() => setUploadTypeModalOpen(false)} onSelect={handleUploadTypeSelect} />}
            {reportDataToCreate && <ConfirmReportImportModal onClose={() => setReportDataToCreate(null)} onSave={handleSaveReportFromAI} existingReports={userData.reports} initialData={reportDataToCreate} />}
            {proposalsToConfirm && <ConfirmProposalsImportModal onClose={() => setProposalsToConfirm(null)} onSave={handleConfirmProposals} initialData={proposalsToConfirm} />}
            {campaignsToConfirm && <ConfirmCampaignsImportModal onClose={() => setCampaignsToConfirm(null)} onSave={handleConfirmCampaigns} initialData={campaignsToConfirm} />}
            
            {/* Header */}
            <div className="p-4 border-b bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg">
                        ✨
                    </div>
                    <div>
                        <h2 className="font-bold text-slate-800 dark:text-white">Lumi Chat</h2>
                        <p className="text-xs text-slate-500">База знаний подключена</p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-800">
                 {showWelcome ? (
                    <WelcomeScreen onPromptClick={handleSend} />
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex items-start gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                                {msg.sender === 'ai' && (
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-blue-600 text-xs">AI</div>
                                )}
                                <div className={`px-4 py-3 rounded-2xl max-w-[80%] shadow-sm whitespace-pre-wrap text-sm ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none border border-gray-100 dark:border-slate-600'}`}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-white dark:bg-slate-700 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm border border-gray-100 dark:border-slate-600">
                                    <div className="flex gap-1">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}/>
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}/>
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}/>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>
            
            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                <div className="flex gap-2 items-end bg-gray-100 dark:bg-slate-900 p-2 rounded-xl border border-gray-200 dark:border-slate-700 focus-within:ring-2 ring-blue-500/20 transition-all">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept="image/*,application/pdf" />
                    <button onClick={handleAttachmentClick} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Прикрепить файл">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </button>
                    
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        placeholder="Спросите Lumi..."
                        className="flex-1 bg-transparent border-0 focus:ring-0 p-2 max-h-32 resize-none text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                        rows={1}
                        disabled={isLoading}
                    />
                    
                    <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg transition-colors shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg>
                    </button>
                </div>
                <p className="text-center text-xs text-slate-400 mt-2">Lumi может ошибаться. Проверяйте важные данные.</p>
            </div>
        </div>
    );
};

export default AIAssistantPage;
