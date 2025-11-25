import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { 
    getAIAssistantResponse, 
    analyzeReportImage, 
    analyzeProposalsImage, 
    analyzeCampaignsImage
} from '../services/geminiService';
import { UserData, Report, CommercialProposal, AdCampaign, OtherReport } from '../types';
import { fileToBase64 } from '../utils';

type UploadType = 'report' | 'proposals' | 'campaigns';

interface Message {
    id: string;
    text: string;
    sender: 'user' | 'ai';
}

const generateContext = (data: UserData) => {
    const today = new Date().toLocaleDateString('ru-RU');
    
    const reportStr = data.reports.slice(0, 5).map(r => `[ОТЧЕТ ${r.name}]: Продажи ${r.metrics.sales}, Лиды ${r.metrics.leads}`).join('; ');
    const propStr = data.proposals.slice(0, 10).map(p => `[КП]: ${p.company}, ${p.amount}тг, Статус: ${p.status}`).join('; ');
    const campStr = data.campaigns.slice(0, 5).map(c => `[РЕКЛАМА]: ${c.name}, Статус ${c.status}`).join('; ');
    const payStr = data.payments.slice(0, 5).map(p => `[ПЛАТЕЖ]: ${p.serviceName}, ${p.amount}`).join('; ');
    
    return `
    СЕГОДНЯ: ${today}
    ИМЯ: Люми.
    РОЛЬ: Умный AI-ассистент компании ${data.companyProfile.companyName}.
    
    ТВОЯ ЗАДАЧА В ЭТОМ ЧАТЕ:
    1. Искать актуальную информацию в интернете (курсы, новости, ГОСТы).
    2. Анализировать данные компании (предоставлены ниже).
    3. Помогать с текстами, переводами, расчетами.
    4. Давать рекомендации по бизнесу.
    
    ВАЖНО:
    - Ты НЕ можешь управлять интерфейсом (открывать страницы) в этом чате.
    - Ты НЕ создаешь документы автоматически в этом чате.
    - Просто давай текстовые ответы и советы.

    ДАННЫЕ КОМПАНИИ:
    ОТЧЕТЫ: ${reportStr}
    КП: ${propStr}
    РЕКЛАМА: ${campStr}
    ПЛАТЕЖИ: ${payStr}
    ПРОЧЕЕ: ${JSON.stringify(data.otherReports)}
    
    ИНСТРУКЦИЯ: ${data.companyProfile.aiSystemInstruction}
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
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm block">Месяц</label><select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full bg-gray-100 p-2 rounded">{monthNames.map((n, i) => <option key={n} value={i+1}>{n}</option>)}</select></div>
                    <div><label className="text-sm block">Год</label><input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="w-full bg-gray-100 p-2 rounded"/></div>
                </div>
                 {error && <p className="text-red-500 text-sm">{error}</p>}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {(['РТИ', '3D'] as const).map(dir => (
                        <div key={dir} className="space-y-3 p-4 border rounded">
                            <h3 className="font-semibold">{dir}</h3>
                            {Object.keys(metricLabels).map(key => (
                                <div key={key}><label className="text-xs">{metricLabels[key as keyof typeof metricLabels]}</label><input type="number" value={editableData[dir]?.[key as keyof Report['metrics']] ?? 0} onChange={e => handleMetricChange(dir, key as keyof Report['metrics'], e.target.value)} className="w-full bg-gray-50 p-1 rounded text-sm"/></div>
                            ))}
                        </div>
                    ))}
                 </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3"><button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">Отмена</button><button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded">Создать</button></div>
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
                <div className="p-6 border-b"><h2 className="text-xl font-bold">Импорт КП</h2></div>
                <div className="p-6 overflow-auto">
                    <div className="flex justify-between mb-4"><p>Проверьте данные</p><select onChange={handleGlobalDirectionChange} className="bg-gray-100 p-2 rounded"><option value="keep">--</option><option value="РТИ">РТИ</option><option value="3D">3D</option></select></div>
                    <table className="w-full text-sm"><tbody>{proposals.map((p: any, i: number) => (
                        <tr key={i} className="border-b"><td><input value={p.date} onChange={e => handleFieldChange(i, 'date', e.target.value)} className="w-full bg-gray-100 p-1"/></td><td><input value={p.item} onChange={e => handleFieldChange(i, 'item', e.target.value)} className="w-full bg-gray-100 p-1"/></td><td><input value={p.amount} onChange={e => handleFieldChange(i, 'amount', e.target.value)} className="w-full bg-gray-100 p-1"/></td><td><button onClick={() => handleDeleteRow(i)} className="text-red-500">x</button></td></tr>
                    ))}</tbody></table>
                </div>
                <div className="p-6 border-t flex justify-end gap-3"><button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">Отмена</button><button onClick={() => onSave(proposals)} className="bg-blue-600 text-white px-4 py-2 rounded">Импорт</button></div>
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
                <div className="p-6 border-b"><h2 className="text-xl font-bold">Импорт Кампаний</h2></div>
                <div className="p-6 overflow-auto"><table className="w-full text-sm"><tbody>{campaigns.map((c:any, i:number) => (
                    <tr key={i} className="border-b"><td>{c.name}</td><td>{c.status}</td><td>{c.spend}</td><td><button onClick={() => handleDeleteRow(i)} className="text-red-500">x</button></td></tr>
                ))}</tbody></table></div>
                <div className="p-6 border-t flex justify-end gap-3"><button onClick={onClose} className="bg-gray-200 px-4 py-2 rounded">Отмена</button><button onClick={() => onSave(campaigns)} className="bg-blue-600 text-white px-4 py-2 rounded">Импорт</button></div>
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

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };
    useEffect(scrollToBottom, [messages]);
    
    const addMessage = (message: Omit<Message, 'id'>) => {
        setMessages(prev => [...prev, {...message, id: uuidv4()}]);
    }

    const handleSend = async (promptText?: string) => {
        const textToSend = promptText || input;
        if (textToSend.trim() === '' || isLoading) return;
        
        // Если работает глобальный ассистент (в сайдбаре) - выключаем его, чтобы не мешал
        if (isGlobalVoiceActive) onDisableGlobalVoice();
        
        if (showWelcome) setShowWelcome(false);

        addMessage({ text: textToSend, sender: 'user' });
        setInput('');
        setIsLoading(true);
        
        try {
            const fullContext = generateContext(userData);
            
            // Используем ТОЛЬКО текстовый режим
            const { text } = await getAIAssistantResponse(textToSend, userData, fullContext);
            
            if (text) {
                addMessage({ text, sender: 'ai' });
            } else {
                addMessage({ text: "Молчание (нет текстового ответа от модели).", sender: 'ai' });
            }

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
                // Упрощенная логика создания, чтобы не перегружать ответ
                const emptyMetrics = { budget: 0, clicks: 0, leads: 0, proposals: 0, invoices: 0, deals: 0, sales: 0 };
                setReportDataToCreate({ 'РТИ': {...emptyMetrics, ...(parsedDirections['РТИ']||{})}, '3D': {...emptyMetrics, ...(parsedDirections['3D']||{})} });
            } else if (type === 'proposals') {
                const parsed = await analyzeProposalsImage(fileForUpload.type, base64Data);
                // Преобразование данных...
                setProposalsToConfirm((parsed['РТИ']||[]).concat(parsed['3D']||[])); // Упрощено
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
    
    // Функции сохранения (упрощены для примера, используйте свои полные версии)
    const handleSaveReportFromAI = (name: string, creationDate: string, directions: Report['directions']) => {
        addReport({ name, creationDate, directions, metrics: {budget:0, clicks:0, leads:0, proposals:0, invoices:0, deals:0, sales:0} }); // Добавить расчет метрик
        setReportDataToCreate(null);
        addMessage({ text: `Отчет "${name}" создан.`, sender: 'ai' });
    };
    const handleConfirmProposals = (final: any[]) => { addMultipleProposals(final); setProposalsToConfirm(null); addMessage({ text: `Импортировано КП: ${final.length}`, sender: 'ai' }); };
    const handleConfirmCampaigns = (final: any[]) => { addMultipleCampaigns(final); setCampaignsToConfirm(null); addMessage({ text: `Импортировано кампаний: ${final.length}`, sender: 'ai' }); };
    
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
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-slate-700 flex items-center justify-center text-blue-600">AI</div>
                                )}
                                <div className={`px-4 py-2 rounded-2xl max-w-lg shadow ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-none'}`}>
                                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                </div>
                            </div>
                        ))}
                        {isLoading && <div className="text-slate-500 p-4">Люми думает...</div>}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>
            
            <div className="relative">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-2 flex items-center shadow-lg">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelected} className="hidden" accept="image/*,application/pdf" />
                    <button onClick={handleAttachmentClick} title="Прикрепить" className="p-2 text-slate-500 hover:text-blue-600">📎</button>
                    
                    {/* МИКРОФОН УДАЛЕН ОТСЮДА */}
                    
                    <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="Спросите Lumi..." className="flex-grow bg-transparent px-3 outline-none dark:text-white" disabled={isLoading} />
                    <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className="bg-blue-600 text-white rounded-lg p-2">➤</button>
                </div>
            </div>
        </div>
    );
};

export default AIAssistantPage;
