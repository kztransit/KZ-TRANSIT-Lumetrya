
import React, { useState, useMemo, useEffect } from 'react';
import { Report } from '../types';

interface ComparePeriodsPageProps {
    reports: Report[];
}

const formatTenge = (value: number) => `₸${new Intl.NumberFormat('ru-RU').format(Math.round(value))}`;
const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.round(value));

const CompareCard: React.FC<{label: string, p1: number, p2: number, format: (v:number) => string, p1Name: string, p2Name: string, colorClass: string}> = ({label, p1, p2, format, p1Name, p2Name, colorClass}) => {
    const change = p2 !== 0 ? ((p1 - p2) / p2) * 100 : p1 > 0 ? 100 : 0;
    const isPositive = change >= 0;
    return (
        <div className={`p-4 rounded-xl shadow-md ${colorClass}`}>
            <p className="text-sm text-slate-500 mb-2">{label}</p>
            <div className="flex items-center justify-between">
                <div className="text-center">
                    <p className="text-xs text-slate-500">{p1Name}</p>
                    <p className="font-bold text-lg">{format(p1)}</p>
                </div>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                 <div className="text-center">
                    <p className="text-xs text-slate-500">{p2Name}</p>
                    <p className="font-bold text-lg">{format(p2)}</p>
                </div>
            </div>
             <p className={`text-center mt-2 font-semibold text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {change.toFixed(1) !== '0.0' && (isPositive ? '↑ ' : '↓ ')}{Math.abs(change).toFixed(1)}%
            </p>
        </div>
    );
};

const ComparePeriodsPage: React.FC<ComparePeriodsPageProps> = ({ reports }) => {
    const sortedReports = useMemo(() => {
        if (!reports) return [];
        return [...reports].sort((a,b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime());
    }, [reports]);

    const [activeTab, setActiveTab] = useState('Метрики');
    const [direction, setDirection] = useState<'Общие' | 'РТИ' | '3D'>('Общие');
    const [period1Id, setPeriod1Id] = useState('');
    const [period2Id, setPeriod2Id] = useState('');
    const [isDataIdentical, setIsDataIdentical] = useState(false);

    useEffect(() => {
        if (sortedReports.length > 0 && !period1Id) {
            setPeriod1Id(sortedReports[0].id);
        }
        if (sortedReports.length > 1 && !period2Id) {
            setPeriod2Id(sortedReports[1].id);
        }
    }, [sortedReports, period1Id, period2Id]);

    const period1 = useMemo(() => sortedReports.find(r => r.id === period1Id), [sortedReports, period1Id]);
    const period2 = useMemo(() => sortedReports.find(r => r.id === period2Id), [sortedReports, period2Id]);
    
    const getMetricsForPeriod = (report: Report | undefined): Report['metrics'] => {
        const defaultMetrics = { budget: 0, clicks: 0, leads: 0, proposals: 0, invoices: 0, deals: 0, sales: 0 };
        if (!report) return defaultMetrics;
        if (direction === 'Общие') return report.metrics;
        return report.directions?.[direction] || defaultMetrics;
    };

    const metrics1 = useMemo(() => getMetricsForPeriod(period1), [period1, direction]);
    const metrics2 = useMemo(() => getMetricsForPeriod(period2), [period2, direction]);

    useEffect(() => {
        if (period1 && period2 && period1.id !== period2.id) {
            // Using JSON.stringify for a simple deep comparison of the metrics objects
            const identical = JSON.stringify(metrics1) === JSON.stringify(metrics2);
            setIsDataIdentical(identical);
        } else {
            setIsDataIdentical(false);
        }
    }, [period1, period2, metrics1, metrics2]);


    const metricsData = useMemo(() => {
        return [
            { label: 'Рекламный бюджет', p1: metrics1.budget, p2: metrics2.budget, format: formatTenge },
            { label: 'Клики', p1: metrics1.clicks, p2: metrics2.clicks, format: formatNumber },
            { label: 'Лиды', p1: metrics1.leads, p2: metrics2.leads, format: formatNumber },
            { label: 'КП', p1: metrics1.proposals, p2: metrics2.proposals, format: formatNumber },
            { label: 'Счета', p1: metrics1.invoices, p2: metrics2.invoices, format: formatNumber },
            { label: 'Реализовано', p1: metrics1.deals, p2: metrics2.deals, format: formatNumber },
            { label: 'Сумма продаж', p1: metrics1.sales, p2: metrics2.sales, format: formatTenge },
            { label: 'Средний чек', p1: metrics1.deals > 0 ? metrics1.sales / metrics1.deals : 0, p2: metrics2.deals > 0 ? metrics2.sales / metrics2.deals : 0, format: formatTenge },
        ];
    }, [metrics1, metrics2]);

    const conversionsData = useMemo(() => {
        const m1 = metrics1;
        const m2 = metrics2;
        const calc = (num: number, den: number) => (den > 0 ? (num / den) * 100 : 0);
        return [
            { label: 'Клики → Лиды', p1: calc(m1.leads, m1.clicks), p2: calc(m2.leads, m2.clicks) },
            { label: 'Лиды → КП', p1: calc(m1.proposals, m1.leads), p2: calc(m2.proposals, m2.leads) },
            { label: 'КП → Счета', p1: calc(m1.invoices, m1.proposals), p2: calc(m2.invoices, m2.proposals) },
            { label: 'Счета → Реализовано', p1: calc(m1.deals, m1.invoices), p2: calc(m2.deals, m2.invoices) },
            { label: 'Лиды → Реализовано', p1: calc(m1.deals, m1.leads), p2: calc(m2.deals, m2.leads) },
        ];
    }, [metrics1, metrics2]);
    
    const cardColors = [
        'bg-blue-50', 'bg-green-50', 'bg-purple-50', 'bg-orange-50',
        'bg-pink-50', 'bg-yellow-50', 'bg-indigo-50', 'bg-teal-50'
    ];

    if (sortedReports.length < 2) {
        return (
            <div>
                 <h1 className="text-3xl font-bold mb-2">Сравнение периодов</h1>
                 <p className="text-slate-500 mb-6">Создайте как минимум два отчета, чтобы сравнивать их показатели.</p>
            </div>
        )
    }

    const DirectionButton: React.FC<{label: 'Общие' | 'РТИ' | '3D'}> = ({label}) => (
        <button 
            onClick={() => setDirection(label)} 
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${direction === label ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:bg-white/60'}`}
        >
            {label}
        </button>
    )

    return (
        <div>
            <h1 className="text-3xl font-bold mb-2">Сравнение периодов</h1>
            <p className="text-slate-500 mb-6">Сравните показатели разных периодов для анализа динамики</p>
            
            <div className="bg-white p-4 rounded-xl shadow-lg mb-6">
                 <h3 className="text-base font-semibold mb-3">Выберите периоды для сравнения</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select value={period1Id} onChange={e => setPeriod1Id(e.target.value)} className="bg-gray-100 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {sortedReports.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                    <select value={period2Id} onChange={e => setPeriod2Id(e.target.value)} className="bg-gray-100 p-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {sortedReports.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                </div>
            </div>

            {isDataIdentical && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 p-4 rounded-r-lg mb-6" role="alert">
                    <p className="font-bold">Внимание: Данные совпадают</p>
                    <p>Числовые показатели для выбранных периодов полностью идентичны. Это может указывать на ошибку при создании отчетов. Рекомендуем проверить исходные данные.</p>
                </div>
            )}
            
            <div className="mb-6">
                <div className="flex items-center space-x-1 bg-gray-200 p-1 rounded-lg self-start max-w-min">
                    <DirectionButton label="Общие" />
                    <DirectionButton label="РТИ" />
                    <DirectionButton label="3D" />
                </div>
            </div>

            <div className="border-b border-gray-200 mb-6">
                <nav className="flex space-x-2">
                    {['Метрики', 'Конверсии'].map(tab => (
                         <button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 px-4 font-semibold text-sm rounded-t-lg ${activeTab === tab ? 'text-blue-500 bg-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-900'}`}>{tab}</button>
                    ))}
                </nav>
            </div>
            
            {activeTab === 'Метрики' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {metricsData.map((m, i) => <CompareCard key={m.label} {...m} p1Name={period1?.name || ''} p2Name={period2?.name || ''} colorClass={cardColors[i % cardColors.length]} />)}
                </div>
            )}
            {activeTab === 'Конверсии' && (
                <div className="bg-white p-4 rounded-xl shadow-md">
                    <h3 className="font-semibold mb-4 text-slate-900">Сравнение конверсий</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-slate-500 font-medium border-b border-gray-200">
                                    <th className="py-2 px-2">Этап воронки</th>
                                    <th className="py-2 px-2 text-right">{period1?.name}</th>
                                    <th className="py-2 px-2 text-right">{period2?.name}</th>
                                    <th className="py-2 px-2 text-right">Изменение</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conversionsData.map(c => {
                                    const change = c.p1 - c.p2;
                                    const isPositive = change >= 0;
                                    return (
                                        <tr key={c.label} className="border-b border-gray-200 last:border-b-0">
                                            <td className="py-3 px-2 text-slate-600 font-medium">{c.label}</td>
                                            <td className="py-3 px-2 text-right font-semibold text-slate-800">{c.p1.toFixed(1)}%</td>
                                            <td className="py-3 px-2 text-right text-slate-500">{c.p2.toFixed(1)}%</td>
                                            <td className={`py-3 px-2 text-right font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                                {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)} п.п.
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ComparePeriodsPage;