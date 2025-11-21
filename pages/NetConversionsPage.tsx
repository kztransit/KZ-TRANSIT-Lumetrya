import React, { useMemo, useState, useEffect } from 'react';
import { Report } from '../types';

interface NetConversionsPageProps {
    reports: Report[];
    updateReport: (report: Report) => void;
}

const EditModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (value: number) => void;
    initialValue: number;
}> = ({ isOpen, onClose, onSave, initialValue }) => {
    const [value, setValue] = useState(initialValue);
    useEffect(() => { setValue(initialValue); }, [initialValue]);

    if (!isOpen) return null;

    const handleSaveClick = () => {
        onSave(value);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold">Редактировать чистые конверсии</h2>
                </div>
                <div className="p-6">
                    <label className="text-sm text-slate-500 block mb-1">Квалифицированные лиды</label>
                    <input type="number" value={value} onChange={e => setValue(Number(e.target.value))} className="w-full bg-gray-100 p-2 rounded-lg"/>
                </div>
                <div className="p-6 border-t flex justify-end gap-2">
                    <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 font-bold py-2 px-4 rounded-lg">Отмена</button>
                    <button onClick={handleSaveClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Сохранить</button>
                </div>
            </div>
        </div>
    );
};


const NetConversionsPage: React.FC<NetConversionsPageProps> = ({ reports, updateReport }) => {
    
    const sortedReports = useMemo(() => {
        if (!reports || reports.length === 0) return [];
        return [...reports].sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
    }, [reports]);

    const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    // Устанавливаем дефолтный ID при загрузке
    useEffect(() => {
        if (sortedReports.length > 0 && !selectedReportId) {
            setSelectedReportId(sortedReports[0].id);
        }
    }, [sortedReports, selectedReportId]);

    const selectedReport = useMemo(() => {
        return sortedReports.find(r => r.id === selectedReportId) || null;
    }, [sortedReports, selectedReportId]);
    
    const dataPoints = useMemo(() => {
        if (!selectedReport) return { totalLeads: 0, qualified: 0, proposals: 0, invoices: 0, deals: 0 };
        const m = selectedReport.metrics;
        // Безопасное чтение netMetrics
        const qualified = selectedReport.netMetrics?.qualifiedLeads ?? 0;
        
        return {
            totalLeads: m.leads,
            qualified,
            proposals: m.proposals,
            invoices: m.invoices,
            deals: m.deals,
        };
    }, [selectedReport]);

    const stages = useMemo(() => {
        const { totalLeads, qualified, proposals, invoices, deals } = dataPoints;
        return [
            { from: 'Лиды', to: 'Квалифицированные', fromValue: totalLeads, toValue: qualified, conversion: totalLeads > 0 ? (qualified / totalLeads) * 100 : 0 },
            { from: 'Квалифицированные', to: 'КП', fromValue: qualified, toValue: proposals, conversion: qualified > 0 ? (proposals / qualified) * 100 : 0 },
            { from: 'КП', to: 'Счета', fromValue: proposals, toValue: invoices, conversion: proposals > 0 ? (invoices / proposals) * 100 : 0 },
            { from: 'Счета', to: 'Реализация', fromValue: invoices, toValue: deals, conversion: invoices > 0 ? (deals / invoices) * 100 : 0 },
        ];
    }, [dataPoints]);
    
    const handleSave = (qualifiedLeadsValue: number) => {
        if (!selectedReport) return;
        
        const updatedReport = {
            ...selectedReport,
            netMetrics: {
                ...(selectedReport.netMetrics || {}), // Сохраняем старые метрики, если были
                qualifiedLeads: qualifiedLeadsValue,
            }
        };
        // Вызываем функцию обновления (она подключена к Supabase в App.tsx)
        updateReport(updatedReport);
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (!selectedReport) return;
        if (!window.confirm('Сбросить количество квалифицированных лидов до 0?')) return;

        const updatedReport = {
            ...selectedReport,
            netMetrics: {
                ...(selectedReport.netMetrics || {}),
                qualifiedLeads: 0,
            }
        };
        updateReport(updatedReport);
    };

    if (reports.length === 0) {
        return (
            <div>
                 <h1 className="text-3xl font-bold mb-2 text-slate-900">Чистые конверсии</h1>
                <p className="text-slate-500 mb-6">Создайте отчет, чтобы увидеть анализ чистых конверсий.</p>
            </div>
        )
    }

    return (
        <div>
            {selectedReport && (
                <EditModal 
                    isOpen={isEditing}
                    onClose={() => setIsEditing(false)}
                    onSave={handleSave}
                    initialValue={selectedReport.netMetrics?.qualifiedLeads || 0}
                />
            )}
            <h1 className="text-3xl font-bold mb-2 text-slate-900">Чистые конверсии</h1>
            <p className="text-slate-500 mb-6">Анализ конверсий с квалифицированными лидами</p>

            <div className="flex items-center space-x-1 bg-white p-1 rounded-lg mb-6 self-start max-w-min">
                <button className="px-4 py-1.5 rounded-md text-sm font-semibold bg-gray-100 text-slate-800">Направление РТИ</button>
                <button className="px-4 py-1.5 rounded-md text-sm font-semibold text-slate-500">Направление 3D</button>
            </div>
            
             <div className="bg-white p-6 rounded-xl shadow-lg">
                 <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                    <div className="flex-grow">
                        <label className="text-sm text-slate-500 block mb-1">Выберите отчет для анализа</label>
                        <select
                            value={selectedReportId || ''}
                            onChange={e => setSelectedReportId(e.target.value)}
                            className="bg-gray-100 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 w-full md:w-auto"
                        >
                            {sortedReports.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                    </div>
                    <div className="flex space-x-2">
                        <button onClick={() => setIsEditing(true)} className="bg-gray-100 hover:bg-gray-200 text-slate-800 font-bold py-2 px-4 rounded-lg text-sm">Редактировать</button>
                        <button onClick={handleDelete} className="bg-red-500/10 hover:bg-red-500/20 text-red-700 font-bold py-2 px-4 rounded-lg text-sm">Сбросить</button>
                    </div>
                </div>

                {selectedReport && (
                    <>
                        <div className="space-y-4 mb-6">
                            <h4 className="font-semibold text-lg text-slate-900">Конверсии за {selectedReport.name}</h4>
                            {stages.map((stage, index) => (
                                <div key={index} className="bg-gray-50 p-4 rounded-lg">
                                    <div className="flex justify-between items-center mb-2">
                                        <p className="font-semibold text-slate-800">{stage.from} → {stage.to}</p>
                                        <p className="text-xl font-bold text-purple-600">{stage.conversion.toFixed(1)}%</p>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                                        <div className="bg-purple-600 h-2.5 rounded-full" style={{width: `${stage.conversion}%`}}></div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">{stage.fromValue.toLocaleString()} {stage.from.toLowerCase()} → {stage.toValue.toLocaleString()} {stage.to.toLowerCase()}</p>
                                </div>
                            ))}
                        </div>

                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6 text-center">
                            <p className="text-sm text-blue-800">Общая конверсия (Лиды → Реализация)</p>
                            <p className="text-2xl font-bold text-slate-900 my-1">{dataPoints.totalLeads > 0 ? (dataPoints.deals / dataPoints.totalLeads * 100).toFixed(1) : '0.0'}%</p>
                            <p className="text-xs text-slate-500">Из {dataPoints.totalLeads} лидов реализовано {dataPoints.deals} сделок</p>
                        </div>

                        <div>
                            <h4 className="font-semibold text-lg mb-4 text-slate-900">Детальные данные</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-sm text-slate-500">Всего лидов</p><p className="text-xl font-bold text-slate-800">{dataPoints.totalLeads.toLocaleString()}</p></div>
                                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-sm text-slate-500">Квалифицированные</p><p className="text-xl font-bold text-slate-800">{dataPoints.qualified.toLocaleString()}</p></div>
                                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-sm text-slate-500">КП</p><p className="text-xl font-bold text-slate-800">{dataPoints.proposals.toLocaleString()}</p></div>
                                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-sm text-slate-500">Счета</p><p className="text-xl font-bold text-slate-800">{dataPoints.invoices.toLocaleString()}</p></div>
                                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-sm text-slate-500">Реализовано</p><p className="text-xl font-bold text-slate-800">{dataPoints.deals.toLocaleString()}</p></div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default NetConversionsPage;
