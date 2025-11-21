
import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Report } from '../types';

interface ConversionsPageProps {
    reports: Report[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981'];

const ConversionsPage: React.FC<ConversionsPageProps> = ({ reports }) => {
    const [filters, setFilters] = useState({ month: 'all', year: 'all', direction: 'all' });

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const availableYears = useMemo(() => {
        if (!reports) return [];
        const years = new Set(reports.map(r => new Date(r.creationDate).getFullYear()));
        return Array.from(years).sort((a: number, b: number) => b - a);
    }, [reports]);

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
        value: (i + 1).toString(),
        label: new Date(0, i).toLocaleString('ru', { month: 'long' })
    }));

    const filteredReports = useMemo(() => {
        if (!reports) return [];
        const sorted = [...reports].sort((a,b) => new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime());

        return sorted.filter(report => {
            const reportDate = new Date(report.creationDate);
            const monthMatch = filters.month === 'all' || (reportDate.getMonth() + 1).toString() === filters.month;
            const yearMatch = filters.year === 'all' || reportDate.getFullYear().toString() === filters.year;
            return monthMatch && yearMatch;
        });
    }, [reports, filters]);

    const funnelData = useMemo(() => {
        const defaultDirectionMetrics = { clicks: 0, leads: 0, proposals: 0, invoices: 0, deals: 0, sales: 0, budget: 0 };

        return filteredReports.reduce((acc, report) => {
            const metrics = filters.direction === 'all' 
                ? report.metrics 
                : report.directions[filters.direction as 'РТИ' | '3D'] || defaultDirectionMetrics;
            
            acc.totalClicks += metrics.clicks;
            acc.totalLeads += metrics.leads;
            acc.sentProposals += metrics.proposals;
            acc.issuedInvoices += metrics.invoices;
            acc.closedDeals += metrics.deals;
            return acc;
        }, { totalClicks: 0, totalLeads: 0, sentProposals: 0, issuedInvoices: 0, closedDeals: 0 });
    }, [filteredReports, filters.direction]);


    const stages = useMemo(() => [
        { from: 'Клики', to: 'Лиды', fromValue: funnelData.totalClicks, toValue: funnelData.totalLeads, conversion: funnelData.totalClicks > 0 ? (funnelData.totalLeads / funnelData.totalClicks) * 100 : 0 },
        { from: 'Лиды', to: 'КП', fromValue: funnelData.totalLeads, toValue: funnelData.sentProposals, conversion: funnelData.totalLeads > 0 ? (funnelData.sentProposals / funnelData.totalLeads) * 100 : 0 },
        { from: 'КП', to: 'Счета', fromValue: funnelData.sentProposals, toValue: funnelData.issuedInvoices, conversion: funnelData.sentProposals > 0 ? (funnelData.issuedInvoices / funnelData.sentProposals) * 100 : 0 },
        { from: 'Счета', to: 'Сделки', fromValue: funnelData.issuedInvoices, toValue: funnelData.closedDeals, conversion: funnelData.issuedInvoices > 0 ? (funnelData.closedDeals / funnelData.issuedInvoices) * 100 : 0 },
    ], [funnelData]);

    const chartData = useMemo(() => {
        return filteredReports.map(report => {
            const metrics = filters.direction === 'all'
                ? report.metrics
                : report.directions[filters.direction as 'РТИ' | '3D'] || { clicks: 0, leads: 0, proposals: 0, deals: 0 };

            const calcConversion = (numerator: number, denominator: number) => (denominator > 0 ? (numerator / denominator) * 100 : 0);
            return {
                name: report.name.split(' ')[1],
                'Клики в Лиды': calcConversion(metrics.leads, metrics.clicks),
                'Лиды в КП': calcConversion(metrics.proposals, metrics.leads),
                'КП в Сделки': calcConversion(metrics.deals, metrics.proposals),
            };
        });
    }, [filteredReports, filters.direction]);

    if (reports.length === 0) {
        return (
            <div>
                 <h1 className="text-3xl font-bold mb-2">Конверсии</h1>
                <p className="text-slate-500 mb-6">Создайте отчет, чтобы увидеть анализ конверсий.</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold mb-2">Конверсии</h1>
            <p className="text-slate-500 mb-6">Анализ эффективности каждого этапа воронки продаж</p>

            <div className="flex items-center space-x-2 md:space-x-4 bg-white p-3 rounded-xl flex-wrap shadow-sm">
                <select name="direction" value={filters.direction} onChange={handleFilterChange} className="bg-gray-100 px-3 py-1.5 rounded-full text-sm">
                    <option value="all">Все направления</option>
                    <option value="РТИ">РТИ</option>
                    <option value="3D">3D</option>
                </select>
                <select name="month" value={filters.month} onChange={handleFilterChange} className="bg-gray-100 px-3 py-1.5 rounded-full text-sm">
                    <option value="all">Все месяцы</option>
                    {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
                <select name="year" value={filters.year} onChange={handleFilterChange} className="bg-gray-100 px-3 py-1.5 rounded-full text-sm">
                    <option value="all">Все годы</option>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stages.map((stage, index) => (
                    <div key={index} className="bg-white p-5 rounded-xl shadow-lg">
                        <div className="flex justify-between items-center mb-2">
                             <p className="text-sm font-semibold text-slate-700">{stage.from} → {stage.to}</p>
                            <p className="font-bold text-lg" style={{ color: COLORS[index % COLORS.length] }}>{stage.conversion.toFixed(1)}%</p>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div className="h-2.5 rounded-full" style={{ width: `${stage.conversion}%`, backgroundColor: COLORS[index % COLORS.length] }}></div>
                        </div>
                         <p className="text-xs text-slate-500 mt-2">{stage.fromValue.toLocaleString()} → {stage.toValue.toLocaleString()}</p>
                    </div>
                ))}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="font-semibold mb-4 text-slate-900">Динамика конверсий по периодам</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis unit="%" />
                        <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="Клики в Лиды" stroke={COLORS[0]} />
                        <Line type="monotone" dataKey="Лиды в КП" stroke={COLORS[1]} />
                        <Line type="monotone" dataKey="КП в Сделки" stroke={COLORS[2]} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

             <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="font-semibold mb-4 text-slate-900">Детализация воронки</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-gray-50">
                            <tr>
                                <th className="p-3">Этап</th>
                                <th className="p-3">Количество</th>
                                <th className="p-3">Конверсия с пред. этапа</th>
                                <th className="p-3">Общая конверсия</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-slate-800">Клики</td>
                                <td className="p-3">{funnelData.totalClicks.toLocaleString()}</td>
                                <td className="p-3">-</td>
                                <td className="p-3">100%</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-slate-800">Лиды</td>
                                <td className="p-3">{funnelData.totalLeads.toLocaleString()}</td>
                                <td className="p-3">{(stages[0].conversion).toFixed(1)}%</td>
                                <td className="p-3">{(funnelData.totalClicks > 0 ? (funnelData.totalLeads / funnelData.totalClicks) * 100 : 0).toFixed(1)}%</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-slate-800">КП</td>
                                <td className="p-3">{funnelData.sentProposals.toLocaleString()}</td>
                                <td className="p-3">{(stages[1].conversion).toFixed(1)}%</td>
                                <td className="p-3">{(funnelData.totalClicks > 0 ? (funnelData.sentProposals / funnelData.totalClicks) * 100 : 0).toFixed(1)}%</td>
                            </tr>
                            <tr className="border-b">
                                <td className="p-3 font-semibold text-slate-800">Счета</td>
                                <td className="p-3">{funnelData.issuedInvoices.toLocaleString()}</td>
                                <td className="p-3">{(stages[2].conversion).toFixed(1)}%</td>
                                <td className="p-3">{(funnelData.totalClicks > 0 ? (funnelData.issuedInvoices / funnelData.totalClicks) * 100 : 0).toFixed(1)}%</td>
                            </tr>
                            <tr>
                                <td className="p-3 font-semibold text-slate-800">Сделки</td>
                                <td className="p-3">{funnelData.closedDeals.toLocaleString()}</td>
                                <td className="p-3">{(stages[3].conversion).toFixed(1)}%</td>
                                <td className="p-3">{(funnelData.totalClicks > 0 ? (funnelData.closedDeals / funnelData.totalClicks) * 100 : 0).toFixed(1)}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ConversionsPage;
