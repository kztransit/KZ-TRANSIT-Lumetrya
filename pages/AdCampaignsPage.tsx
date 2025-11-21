import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { AdCampaign } from '../types';
import { fileToBase64 } from '../utils';
import { analyzeCampaignsImage } from '../services/geminiService';

interface AdCampaignsPageProps {
    campaigns: AdCampaign[];
    addCampaign: (campaign: Omit<AdCampaign, 'id'>) => void;
    deleteCampaign: (id: string) => void;
    setCampaigns: (campaigns: AdCampaign[] | ((prev: AdCampaign[]) => AdCampaign[])) => void;
}

const statusColorMap: { [key in AdCampaign['status']]: string } = {
    'Включено': 'bg-green-100 text-green-800',
    'Приостановлено': 'bg-yellow-100 text-yellow-800',
    'Завершено': 'bg-gray-100 text-gray-800',
};
const typeColorMap: { [key in AdCampaign['type']]: string } = {
    'Поиск': 'bg-blue-100 text-blue-800',
    'Максимальная эффективность': 'bg-purple-100 text-purple-800'
}

const formatTenge = (value: number) => `₸${new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;

const AddCampaignModal: React.FC<{onClose: () => void, onSave: (campaign: Omit<AdCampaign, 'id'>) => void}> = ({onClose, onSave}) => {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newCampaign = {
            name: formData.get('name') as string,
            status: formData.get('status') as AdCampaign['status'],
            type: formData.get('type') as AdCampaign['type'],
            budget: Number(formData.get('budget')),
            budgetType: formData.get('budgetType') as AdCampaign['budgetType'],
            impressions: 0, clicks: 0, ctr: 0, spend: 0, conversions: 0, cpc: 0, conversionRate: 0, cpa: 0,
            strategy: 'Максимум конверсий',
            period: new Date().toLocaleDateString(),
        };
        onSave(newCampaign);
        onClose();
    };
    
    return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
             <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                <h2 className="text-xl font-bold text-slate-900">Добавить кампанию</h2>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-800 text-2xl">&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
             <div className="p-6 space-y-4">
                <div><label className="text-sm text-slate-500 block mb-1">Название кампании</label><input required name="name" type="text" className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm text-slate-500 block mb-1">Статус</label><select name="status" className="w-full bg-gray-100 p-2 rounded-lg"><option>Включено</option><option>Приостановлено</option></select></div>
                    <div><label className="text-sm text-slate-500 block mb-1">Тип кампании</label><select name="type" className="w-full bg-gray-100 p-2 rounded-lg"><option>Поиск</option><option>Максимальная эффективность</option></select></div>
                    <div><label className="text-sm text-slate-500 block mb-1">Бюджет</label><input name="budget" type="number" className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                    <div><label className="text-sm text-slate-500 block mb-1">Тип бюджета</label><select name="budgetType" className="w-full bg-gray-100 p-2 rounded-lg"><option>Дневной</option><option>На весь срок</option></select></div>
                </div>
            </div>
             <div className="p-6 border-t border-gray-200 flex justify-end gap-3 sticky bottom-0 bg-white">
                <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 font-bold py-2 px-4 rounded-lg">Отмена</button>
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Сохранить</button>
            </div>
            </form>
        </div>
    </div>
    )
};

const ImportCampaignsModal: React.FC<{onClose: () => void, onImport: (campaigns: Omit<AdCampaign, 'id'>[]) => void}> = ({ onClose, onImport }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [parsedCampaigns, setParsedCampaigns] = useState<Omit<AdCampaign, 'id'>[]>([]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if(e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
            setError('');
        }
    };

    const handleParse = async () => {
        if (!file) return;
        setIsLoading(true);
        setError('');
        try {
            const base64Data = await fileToBase64(file);
            const analyzedData = await analyzeCampaignsImage(file.type, base64Data);
            
            const newCampaigns = analyzedData.map(p => {
                const statusStr = (p.status || '').toLowerCase();
                let status: AdCampaign['status'] = 'Приостановлено';
                if (statusStr.includes('включено') || statusStr.includes('eligible')) status = 'Включено';
                if (statusStr.includes('завершено')) status = 'Завершено';

                const typeStr = (p.type || '').toLowerCase();
                let type: AdCampaign['type'];
                if (typeStr.includes('поиск') || typeStr.includes('search')) {
                    type = 'Поиск';
                } else if (typeStr.includes('максимальная') || typeStr.includes('эффективность') || typeStr.includes('pmax')) {
                    type = 'Максимальная эффективность';
                } else {
                    // Fallback to old logic if AI fails to determine type
                    type = ((p.name || '').toLowerCase().includes('поиск') ? 'Поиск' : 'Максимальная эффективность');
                }

                return {
                    name: p.name || 'N/A',
                    status: status,
                    type: type,
                    budget: p.budget || 0,
                    budgetType: 'Дневной' as AdCampaign['budgetType'],
                    impressions: p.impressions || 0,
                    clicks: p.clicks || 0,
                    ctr: p.ctr || 0,
                    spend: p.spend || 0,
                    conversions: p.conversions || 0,
                    cpc: p.cpc || 0,
                    conversionRate: p.clicks && p.clicks > 0 ? ((p.conversions || 0) / p.clicks) * 100 : 0,
                    cpa: p.conversions && p.conversions > 0 ? (p.spend || 0) / p.conversions : 0,
                    strategy: 'Максимум конверсий',
                    period: new Date().toLocaleDateString(),
                };
            });

            setParsedCampaigns(newCampaigns);
            setStep(2);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось проанализировать файл.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleConfirmImport = () => {
        onImport(parsedCampaigns);
        onClose();
    };

    const handleFieldChange = (index: number, field: keyof AdCampaign, value: any) => {
        const updated = [...parsedCampaigns];
        (updated[index] as any)[field] = value;
        setParsedCampaigns(updated);
    };
    
    const handleDeleteRow = (index: number) => {
        setParsedCampaigns(parsedCampaigns.filter((_, i) => i !== index));
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center"><h2 className="text-xl font-bold">Импорт кампаний (Шаг {step}/2)</h2><button type="button" onClick={onClose}>&times;</button></div>
                {step === 1 && (
                    <>
                    <div className="p-6">
                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center">
                            <input type="file" id="campaign-file-upload" className="hidden" onChange={handleFileChange} accept="image/*,application/pdf" />
                            <label htmlFor="campaign-file-upload" className="cursor-pointer text-cyan-600 font-semibold">{file ? file.name : "Выберите файл..."}</label>
                            <p className="text-xs text-slate-500 mt-2">Загрузите скриншот или PDF-файл из рекламного кабинета Google Ads</p>
                        </div>
                        {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
                    </div>
                    <div className="p-6 border-t border-gray-200 flex justify-end">
                        <button onClick={handleParse} disabled={!file || isLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-slate-400">
                            {isLoading ? "Анализ..." : "Далее →"}
                        </button>
                    </div>
                    </>
                )}
                {step === 2 && (
                    <>
                    <div className="p-6 overflow-auto">
                        <p className="text-slate-600 mb-4">Проверьте данные, извлеченные из файла. Вы можете их отредактировать или удалить строки перед импортом.</p>
                        <div className="overflow-x-auto">
                           <table className="w-full text-sm">
                               <thead>
                                 <tr className="text-left text-xs text-slate-500 bg-gray-50">
                                    {['Название', 'Статус', 'Бюджет', 'Клики', 'Расходы', ''].map(h => <th key={h} className="p-2 font-medium">{h}</th>)}
                                 </tr>
                               </thead>
                               <tbody>
                                {parsedCampaigns.map((c, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        <td className="p-1"><input type="text" value={c.name} onChange={e => handleFieldChange(i, 'name', e.target.value)} className="w-full bg-gray-100 p-1 rounded-md text-sm"/></td>
                                        <td className="p-1">
                                            <select value={c.status} onChange={e => handleFieldChange(i, 'status', e.target.value)} className="w-full bg-gray-100 p-1 rounded-md text-sm">
                                                <option>Включено</option><option>Приостановлено</option><option>Завершено</option>
                                            </select>
                                        </td>
                                        <td className="p-1"><input type="number" value={c.budget} onChange={e => handleFieldChange(i, 'budget', Number(e.target.value))} className="w-full bg-gray-100 p-1 rounded-md text-sm"/></td>
                                        <td className="p-1"><input type="number" value={c.clicks} onChange={e => handleFieldChange(i, 'clicks', Number(e.target.value))} className="w-full bg-gray-100 p-1 rounded-md text-sm"/></td>
                                        <td className="p-1"><input type="number" value={c.spend} onChange={e => handleFieldChange(i, 'spend', Number(e.target.value))} className="w-full bg-gray-100 p-1 rounded-md text-sm"/></td>
                                        <td className="p-1 text-center"><button onClick={() => handleDeleteRow(i)} className="text-red-500 hover:text-red-700 p-1 rounded-full">🗑️</button></td>
                                    </tr>
                                ))}
                               </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="p-6 border-t flex justify-between items-center mt-auto">
                         <button onClick={() => setStep(1)} className="bg-gray-200 hover:bg-gray-300 font-bold py-2 px-4 rounded-lg text-sm">← Назад</button>
                        <button onClick={handleConfirmImport} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">
                             Импортировать ({parsedCampaigns.length})
                        </button>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};


const AdCampaignsPage: React.FC<AdCampaignsPageProps> = ({ campaigns, addCampaign, deleteCampaign, setCampaigns }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [isImporting, setIsImporting] = useState(false);
    const [filters, setFilters] = useState({ status: '', type: '' });
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({...prev, [e.target.name]: e.target.value}));
    };
    
    const filteredCampaigns = useMemo(() => {
        return campaigns.filter(c => 
            (filters.status === '' || c.status === filters.status) &&
            (filters.type === '' || c.type === filters.type)
        )
    }, [campaigns, filters]);

    const summary = useMemo(() => filteredCampaigns.reduce((acc, c) => ({
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        spend: acc.spend + c.spend,
        conversions: acc.conversions + c.conversions
    }), {impressions: 0, clicks: 0, spend: 0, conversions: 0}), [filteredCampaigns]);
    
    // ИСПРАВЛЕНО: теперь вызываем addCampaign (который шлет запрос в Supabase) для каждой кампании
    const handleImportSave = (importedCampaigns: Omit<AdCampaign, 'id'>[]) => {
        importedCampaigns.forEach(campaign => {
            addCampaign(campaign);
        });
    };

    const handleDeleteCampaign = (id: string) => {
        if (window.confirm('Вы уверены, что хотите удалить эту кампанию?')) {
            deleteCampaign(id);
        }
    };

    return (
        <div>
            {isAdding && <AddCampaignModal onClose={() => setIsAdding(false)} onSave={addCampaign} />}
            {isImporting && <ImportCampaignsModal onClose={() => setIsImporting(false)} onImport={handleImportSave} />}
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                 <div>
                    <h1 className="text-3xl font-bold text-slate-900">Рекламные кампании</h1>
                    <p className="text-slate-500 mt-1">Управление и анализ рекламных кампаний Google Ads</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setIsImporting(true)} className="bg-white hover:bg-gray-100 text-slate-800 font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 border border-gray-300">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L11 8.586V3a1 1 0 10-2 0v5.586L8.707 7.293z" /><path d="M3 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /></svg>
                        <span>Загрузить отчет</span>
                    </button>
                    <button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Добавить кампанию</button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Показы</p><p className="text-2xl font-bold text-slate-900">{summary.impressions.toLocaleString()}</p></div>
                <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Клики</p><p className="text-2xl font-bold text-slate-900">{summary.clicks.toLocaleString()}</p><p className="text-xs text-slate-500">CTR {summary.impressions > 0 ? ((summary.clicks/summary.impressions)*100).toFixed(2) : '0.00'}%</p></div>
                <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Расходы</p><p className="text-2xl font-bold text-slate-900">{formatTenge(summary.spend)}</p><p className="text-xs text-slate-500">CPC {formatTenge(summary.clicks > 0 ? summary.spend / summary.clicks : 0)}</p></div>
                <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Конверсии</p><p className="text-2xl font-bold text-slate-900">{summary.conversions.toFixed(2)}</p><p className="text-xs text-slate-500">Цена {formatTenge(summary.conversions > 0 ? summary.spend / summary.conversions : 0)}</p></div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-lg">
                <div className="flex items-center space-x-2 md:space-x-4 mb-4 flex-wrap">
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="bg-gray-100 p-2 rounded-lg text-sm"><option value="">Все статусы</option><option>Включено</option><option>Приостановлено</option><option>Завершено</option></select>
                    <select name="type" value={filters.type} onChange={handleFilterChange} className="bg-gray-100 p-2 rounded-lg text-sm"><option value="">Все типы</option><option>Поиск</option><option>Максимальная эффективность</option></select>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 uppercase bg-gray-50">
                            <tr>
                                {["Кампания", "Статус", "Тип", "Бюджет", "Показы", "Клики", "CTR", "Расходы", "Конверсии", "CPC", "Действия"].map(h => <th key={h} scope="col" className="px-4 py-3">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCampaigns.length > 0 ? filteredCampaigns.map(c => (
                                <tr key={c.id} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{c.name}</td>
                                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColorMap[c.status]}`}>{c.status}</span></td>
                                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${typeColorMap[c.type]}`}>{c.type}</span></td>
                                    <td className="px-4 py-3">{formatTenge(c.budget)}<span className="text-xs text-slate-500">/{c.budgetType}</span></td>
                                    <td className="px-4 py-3">{c.impressions.toLocaleString()}</td>
                                    <td className="px-4 py-3">{c.clicks.toLocaleString()}</td>
                                    <td className="px-4 py-3">{c.ctr.toFixed(2)}%</td>
                                    <td className="px-4 py-3">{formatTenge(c.spend)}</td>
                                    <td className="px-4 py-3">{c.conversions.toFixed(2)}<p className="text-xs text-slate-500">{c.conversionRate.toFixed(2)}%</p></td>
                                    <td className="px-4 py-3">{formatTenge(c.cpc)}</td>
                                    <td className="px-4 py-3 flex space-x-3">
                                        <button className="text-slate-400 hover:text-cyan-500">✏️</button>
                                        <button onClick={() => handleDeleteCampaign(c.id)} className="text-slate-400 hover:text-red-500">🗑️</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={11} className="text-center py-10 text-slate-500">Нет данных для отображения. Загрузите отчет или создайте кампанию.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default AdCampaignsPage;
