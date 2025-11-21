import React, { useState, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { OtherReport, OtherReportKpi } from '../types';

interface OtherReportsPageProps {
    reports: OtherReport[];
    addReport: (report: Omit<OtherReport, 'id'>) => void;
    updateReport: (report: OtherReport) => void;
    deleteReport: (id: string) => void;
}

const ReportFormModal: React.FC<{
    onClose: () => void;
    onSave: (report: OtherReport | Omit<OtherReport, 'id'>) => void;
    initialData?: OtherReport | null;
}> = ({ onClose, onSave, initialData }) => {
    const isEditing = !!initialData;

    const [formData, setFormData] = useState<Omit<OtherReport, 'id'>>(() => {
        return initialData || {
            name: '',
            date: new Date().toISOString().split('T')[0],
            category: 'Склад',
            description: '',
            kpis: [{ id: uuidv4(), name: '', value: '' }]
        };
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleKpiChange = (id: string, field: 'name' | 'value', value: string) => {
        setFormData(prev => ({
            ...prev,
            kpis: prev.kpis.map(kpi => kpi.id === id ? { ...kpi, [field]: value } : kpi)
        }));
    };
    
    const handleAddKpi = () => {
        setFormData(prev => ({
            ...prev,
            kpis: [...prev.kpis, { id: uuidv4(), name: '', value: '' }]
        }));
    };
    
    const handleRemoveKpi = (id: string) => {
        setFormData(prev => ({
            ...prev,
            kpis: prev.kpis.filter(kpi => kpi.id !== id)
        }));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const reportToSave = { 
            ...formData, 
            kpis: formData.kpis.filter(k => k.name.trim() !== '' && k.value.trim() !== '') 
        };
        if (isEditing) {
            onSave({ ...reportToSave, id: initialData.id });
        } else {
            onSave(reportToSave);
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b dark:border-slate-700">
                    <h2 className="text-xl font-bold">{isEditing ? 'Редактировать отчет' : 'Создать отчет'}</h2>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div><label className="text-sm">Название отчета*</label><input required name="name" value={formData.name} onChange={handleChange} className="w-full mt-1 bg-gray-100 dark:bg-slate-700 p-2 rounded-lg"/></div>
                        <div><label className="text-sm">Категория*</label><select name="category" value={formData.category} onChange={handleChange} className="w-full mt-1 bg-gray-100 dark:bg-slate-700 p-2 rounded-lg"><option>Склад</option><option>Логистика</option><option>HR</option><option>Производство</option><option>Другое</option></select></div>
                    </div>
                    <div><label className="text-sm">Дата*</label><input required type="date" name="date" value={formData.date} onChange={handleChange} className="w-full mt-1 bg-gray-100 dark:bg-slate-700 p-2 rounded-lg"/></div>
                    <div><label className="text-sm">Описание</label><textarea name="description" value={formData.description} onChange={handleChange} className="w-full mt-1 bg-gray-100 dark:bg-slate-700 p-2 rounded-lg" rows={3}/></div>
                    
                    <div>
                        <h3 className="text-base font-semibold mb-2">Ключевые показатели (KPI)</h3>
                        <div className="space-y-2">
                            {formData.kpis.map((kpi) => (
                                <div key={kpi.id} className="flex items-center gap-2">
                                    <input value={kpi.name} onChange={e => handleKpiChange(kpi.id, 'name', e.target.value)} placeholder="Название KPI" className="w-1/2 bg-gray-50 dark:bg-slate-700 p-2 rounded-lg border"/>
                                    <input value={kpi.value} onChange={e => handleKpiChange(kpi.id, 'value', e.target.value)} placeholder="Значение" className="w-1/2 bg-gray-50 dark:bg-slate-700 p-2 rounded-lg border"/>
                                    <button type="button" onClick={() => handleRemoveKpi(kpi.id)} className="text-red-500 p-1">✕</button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={handleAddKpi} className="text-sm text-blue-600 font-semibold mt-2">+ Добавить KPI</button>
                    </div>
                </div>
                <div className="p-6 border-t dark:border-slate-700 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-600 dark:hover:bg-slate-500 font-bold py-2 px-4 rounded-lg">Отмена</button>
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Сохранить</button>
                </div>
            </form>
        </div>
    );
};

const ReportCard: React.FC<{
    report: OtherReport;
    onOpen: (report: OtherReport) => void;
    onDelete: (id: string) => void;
}> = ({ report, onOpen, onDelete }) => (
    <button onClick={() => onOpen(report)} className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-lg transition-all hover:shadow-blue-500/20 hover:scale-[1.02] flex flex-col text-left w-full">
        <div>
            <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-semibold px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300 rounded-full">{report.category}</span>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(report.id); }} 
                    className="text-slate-400 hover:text-red-500 z-10 p-1"
                    aria-label="Удалить отчет"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{report.name}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 h-10 overflow-hidden">{report.description}</p>
            {report.kpis.length > 0 && (
                <div className="space-y-1.5 text-sm mb-4">
                    {report.kpis.slice(0, 2).map(kpi => (
                        <div key={kpi.id} className="flex justify-between"><span className="text-slate-500">{kpi.name}</span><span className="font-semibold text-slate-800 dark:text-slate-200">{kpi.value}</span></div>
                    ))}
                    {report.kpis.length > 2 && <div className="text-xs text-slate-400">...и еще {report.kpis.length - 2}</div>}
                </div>
            )}
        </div>
        <div className="border-t border-gray-200 dark:border-slate-700 pt-3 mt-auto">
            <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(report.date).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
        </div>
    </button>
);

const EmptyState = () => (
    <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">Отчетов пока нет</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2">Здесь будут храниться отчеты, не связанные с основной аналитикой.</p>
    </div>
);

const ReportDetailView: React.FC<{
    report: OtherReport;
    onBack: () => void;
    onEdit: (report: OtherReport) => void;
    onDelete: (id: string) => void;
}> = ({ report, onBack, onEdit, onDelete }) => {
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <button onClick={onBack} className="text-blue-600 hover:text-blue-500 flex items-center text-sm font-semibold">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Назад ко всем отчетам
                </button>
                 <div className="flex space-x-2">
                    <button onClick={() => onEdit(report)} className="bg-white dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 border border-gray-300 dark:border-slate-600">✏️ Редактировать</button>
                    <button onClick={() => onDelete(report.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-700 font-bold py-2 px-4 rounded-lg text-sm">🗑️ Удалить</button>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className="text-sm font-semibold px-2 py-1 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-slate-300 rounded-full">{report.category}</span>
                        <h2 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mt-2">{report.name}</h2>
                        <p className="text-slate-500 dark:text-slate-400">{new Date(report.date).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'})}</p>
                    </div>
                </div>
                {report.description && <p className="text-slate-600 dark:text-slate-300 mb-6 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-lg">{report.description}</p>}
                
                <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-slate-200">Ключевые показатели</h3>
                {report.kpis.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {report.kpis.map(kpi => (
                            <div key={kpi.id} className="bg-blue-50 dark:bg-blue-900/40 p-4 rounded-lg">
                                <p className="text-sm text-blue-800 dark:text-blue-300">{kpi.name}</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{kpi.value}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-slate-500">Для этого отчета не задано ключевых показателей.</p>
                )}
            </div>
        </div>
    );
};


const OtherReportsPage: React.FC<OtherReportsPageProps> = ({ reports, addReport, updateReport, deleteReport }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingReport, setEditingReport] = useState<OtherReport | null>(null);
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [selectedReport, setSelectedReport] = useState<OtherReport | null>(null);

    const sortedReports = useMemo(() => {
        return [...reports].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [reports]);

    const handleAddClick = () => {
        setEditingReport(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (report: OtherReport) => {
        setEditingReport(report);
        setIsModalOpen(true);
    };

    const handleDeleteReport = (id: string) => {
        if (window.confirm('Вы уверены, что хотите удалить этот отчет?')) {
            deleteReport(id);
            if (selectedReport?.id === id) {
                setView('list');
                setSelectedReport(null);
            }
        }
    };

    const handleSave = (reportData: Omit<OtherReport, 'id'> | OtherReport) => {
        if ('id' in reportData) {
            updateReport(reportData);
            if (selectedReport?.id === reportData.id) {
                setSelectedReport(reportData);
            }
        } else {
            addReport(reportData);
        }
    };
    
    const handleOpenReport = (report: OtherReport) => {
        setSelectedReport(report);
        setView('detail');
    };
    
    if (view === 'detail' && selectedReport) {
        return <ReportDetailView report={selectedReport} onBack={() => setView('list')} onEdit={handleEditClick} onDelete={handleDeleteReport} />;
    }

    return (
        <div>
            {isModalOpen && <ReportFormModal onClose={() => setIsModalOpen(false)} onSave={handleSave} initialData={editingReport} />}
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Другие отчеты</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Отчеты, которые не попадают в общую аналитику</p>
                </div>
                <button onClick={handleAddClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Создать отчет</button>
            </div>

            {sortedReports.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {sortedReports.map(report => (
                        <ReportCard key={report.id} report={report} onOpen={handleOpenReport} onDelete={handleDeleteReport} />
                    ))}
                </div>
            ) : (
                <EmptyState />
            )}
        </div>
    );
};

export default OtherReportsPage;