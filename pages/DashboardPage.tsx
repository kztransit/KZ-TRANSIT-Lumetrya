
import React, {useState, useMemo} from 'react';
import DashboardCard from '../components/DashboardCard';
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Funnel, FunnelChart, LabelList, ScatterChart, Scatter } from 'recharts';
import { CommercialProposal, Report } from '../types';
import { analyzeDataConsistency } from '../services/geminiService';

interface DashboardPageProps {
    reports: Report[];
    proposals: CommercialProposal[];
}

const COLORS = ['#2563eb', '#16a34a', '#9333ea', '#f59e0b']; // blue, green, purple, amber

const formatCurrency = (value: number) => `₸${(value / 1000000).toFixed(2)}M`;
const formatNumber = (value: number) => new Intl.NumberFormat('ru-RU').format(Math.round(value));
const formatTenge = (value: number) => `₸${new Intl.NumberFormat('ru-RU').format(Math.round(value))}`;

const EmptyState: React.FC = () => (
    <div className="text-center py-10 bg-white rounded-xl shadow-md">
        <h2 className="text-xl font-semibold text-slate-800">Нет данных для отображения</h2>
        <p className="text-slate-500 mt-2">Создайте свой первый отчет или коммерческое предложение, чтобы увидеть здесь аналитику.</p>
    </div>
);

const AnalysisModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    isAnalyzing: boolean;
    analysisResult: string | null;
}> = ({ isOpen, onClose, isAnalyzing, analysisResult }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                    <h2 className="text-xl font-bold">Анализ данных от AI</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-800 text-2xl">&times;</button>
                </div>
                <div className="p-6 bg-gray-50 overflow-y-auto">
                    {isAnalyzing ? (
                         <div className="flex flex-col items-center justify-center h-48">
                            <div className="flex items-center space-x-2 text-slate-500">
                                <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>AI анализирует ваши данные...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="whitespace-pre-wrap text-slate-700">
                           {analysisResult}
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-gray-200 flex justify-end sticky bottom-0 bg-white">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">Закрыть</button>
                </div>
            </div>
        </div>
    );
};

const DashboardPage: React.FC<DashboardPageProps> = ({ reports, proposals }) => {
    const [filters, setFilters] = useState({ direction: 'all', month: 'all', quarter: 'all', year: 'all' });
    const [isAnalysisModalOpen, setAnalysisModalOpen] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFilters(prev => ({...prev, [e.target.name]: e.target.value}));
    };
    
    const availableYears = useMemo(() => {
        if (!reports) return [];
        const years = new Set(reports.map(r => new Date(r.creationDate).getFullYear()));
        return Array.from(years).sort((a: number, b: number) => b - a);
    }, [reports]);

    const filteredReports = useMemo(() => {
        if (!reports) return [];
         return [...reports]
            .filter(report => {
                const reportDate = new Date(report.creationDate);
                const month = reportDate.getMonth() + 1;
                const year = reportDate.getFullYear();
                const quarter = Math.ceil(month / 3);

                const monthMatch = filters.month === 'all' || month.toString() === filters.month;
                const yearMatch = filters.year === 'all' || year.toString() === filters.year;
                const quarterMatch = filters.quarter === 'all' || quarter.toString() === filters.quarter;

                return monthMatch && yearMatch && quarterMatch;
            })
            .sort((a, b) => new Date(a.creationDate).getTime() - new Date(b.creationDate).getTime());
    }, [reports, filters]);
    
    const dashboardData = useMemo(() => {
        if (!filteredReports) return null;

        const reportsToUse = filters.direction === 'all' 
            ? filteredReports 
            : filteredReports.map(r => ({
                ...r,
                metrics: r.directions?.[filters.direction] || { budget: 0, clicks: 0, leads: 0, proposals: 0, invoices: 0, deals: 0, sales: 0 }
            }));
        
        const totalSales = reportsToUse.reduce((sum, r) => sum + r.metrics.sales, 0);
        const totalDeals = reportsToUse.reduce((sum, r) => sum + r.metrics.deals, 0);
        const totalBudget = reportsToUse.reduce((sum, r) => sum + r.metrics.budget, 0);
        const totalLeads = reportsToUse.reduce((sum, r) => sum + r.metrics.leads, 0);
        const totalClicks = reportsToUse.reduce((sum, r) => sum + r.metrics.clicks, 0);
        const totalProposalsFromReports = reportsToUse.reduce((sum, r) => sum + r.metrics.proposals, 0);
        const totalInvoicesFromReports = reportsToUse.reduce((sum, r) => sum + r.metrics.invoices, 0);
        
        const calculateConversion = (from: number, to: number) => (from > 0 ? (to / from) * 100 : 0);

        const costPerProposal = totalProposalsFromReports > 0 ? totalBudget / totalProposalsFromReports : 0;
        const costPerInvoice = totalInvoicesFromReports > 0 ? totalBudget / totalInvoicesFromReports : 0;
        const costPerDeal = totalDeals > 0 ? totalBudget / totalDeals : 0;


        return {
            totalBudget,
            totalLeads,
            totalRevenue: totalSales,
            dealsClosed: totalDeals,
            cpl: totalLeads > 0 ? totalBudget / totalLeads : 0,
            cpc: totalClicks > 0 ? totalBudget / totalClicks : 0,
            roi: totalBudget > 0 ? (totalSales - totalBudget) / totalBudget * 100 : 0,
            leadToDealConversion: totalLeads > 0 ? (totalDeals / totalLeads) * 100 : 0,
            
            costPerProposal,
            costPerInvoice,
            costPerDeal,
            
            kpiTrends: {
                budget: reportsToUse.slice(-6).map(r => ({value: r.metrics.budget})),
                leads: reportsToUse.slice(-6).map(r => ({value: r.metrics.leads})),
                revenue: reportsToUse.slice(-6).map(r => ({value: r.metrics.sales})),
                deals: reportsToUse.slice(-6).map(r => ({value: r.metrics.deals})),
            },
            
            funnelData: [
                { name: 'Лиды', value: totalLeads },
                { name: 'КП', value: totalProposalsFromReports },
                { name: 'Счета', value: totalInvoicesFromReports },
                { name: 'Сделки', value: totalDeals }
            ].filter(d => d.value > 0),
            
            leadDynamics: reportsToUse.slice(-12).map(r => ({ 
                name: r.name.split(' ').slice(-2)[0].substring(0,3),
                'РТИ Лиды': r.directions?.['РТИ']?.leads || 0, 
                '3D Лиды': r.directions?.['3D']?.leads || 0 
            })),
            
            budgetDistribution: [
                { name: 'РТИ', value: filteredReports.reduce((s,r) => s + (r.directions?.['РТИ']?.budget || 0), 0) },
                { name: '3D', value: filteredReports.reduce((s,r) => s + (r.directions?.['3D']?.budget || 0), 0) },
            ].filter(item => item.value > 0),
            
            revenueBudgetDynamics: reportsToUse.slice(-12).map(r => ({ 
                name: r.name.split(' ').slice(-2)[0].substring(0,3),
                'Выручка': r.metrics.sales, 
                'Бюджет': r.metrics.budget
            })),

            keyConversions: [
                { label: 'Клики → Лиды', value: calculateConversion(totalClicks, totalLeads) },
                { label: 'Лиды → КП', value: calculateConversion(totalLeads, totalProposalsFromReports) },
                { label: 'КП → Счета', value: calculateConversion(totalProposalsFromReports, totalInvoicesFromReports) },
                { label: 'Счета → Сделки', value: calculateConversion(totalInvoicesFromReports, totalDeals) }
            ],
        };
    }, [filteredReports, filters.direction]);

    const axisColor = '#6b7280';
    const gridColor = '#e5e7eb';
    const tooltipStyle = {
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    };
    
    const handleAnalyzeClick = async () => {
        setAnalysisModalOpen(true);
        setIsAnalyzing(true);
        setAnalysisResult(null);
        try {
            const result = await analyzeDataConsistency(filteredReports);
            setAnalysisResult(result);
        } catch (error) {
            setAnalysisResult("Произошла ошибка при анализе данных.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    if (!dashboardData || (reports.length === 0 && proposals.length === 0)) {
        return <EmptyState />;
    }

    return (
        <div className="space-y-6">
            <AnalysisModal
                isOpen={isAnalysisModalOpen}
                onClose={() => setAnalysisModalOpen(false)}
                isAnalyzing={isAnalyzing}
                analysisResult={analysisResult}
            />

            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-bold text-slate-900">Общий отчет</h1>
                    <p className="text-slate-500 mt-1">Комплексная сводка по всем маркетинговым кампаниям и продажам</p>
                </div>
                 <button 
                    onClick={handleAnalyzeClick} 
                    disabled={isAnalyzing}
                    className="bg-gradient-to-r from-blue-600 to-blue-500 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center space-x-2 shadow-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    <span>Анализ данных AI</span>
                </button>
            </div>

            <div className="flex items-center space-x-2 md:space-x-4 bg-white p-3 rounded-xl flex-wrap shadow-sm">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                </svg>
                <span className="font-semibold text-sm">Фильтры:</span>
                <select name="direction" value={filters.direction} onChange={handleFilterChange} className="bg-gray-100 px-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option value="all">Все направления</option>
                    <option value="РТИ">РТИ</option>
                    <option value="3D">3D</option>
                </select>
                <select name="month" value={filters.month} onChange={handleFilterChange} className="bg-gray-100 px-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option value="all">Все месяцы</option>
                    {Array.from({length: 12}, (_, i) => <option key={i+1} value={i+1}>{new Date(0, i).toLocaleString('ru', {month: 'long'})}</option>)}
                </select>
                <select name="quarter" value={filters.quarter} onChange={handleFilterChange} className="bg-gray-100 px-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option value="all">Все кварталы</option>
                    <option value="1">1 квартал</option>
                    <option value="2">2 квартал</option>
                    <option value="3">3 квартал</option>
                    <option value="4">4 квартал</option>
                </select>
                 <select name="year" value={filters.year} onChange={handleFilterChange} className="bg-gray-100 px-3 py-1.5 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                    <option value="all">Все годы</option>
                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <DashboardCard title="Общий бюджет" value={formatCurrency(dashboardData.totalBudget)} className="bg-blue-500 text-white" />
                <DashboardCard title="Всего лидов" value={formatNumber(dashboardData.totalLeads)} tag={`${dashboardData.leadToDealConversion.toFixed(1)}% CR`} tagColor="bg-black/20 text-white" className="bg-green-500 text-white" />
                <DashboardCard title="Общая выручка" value={formatCurrency(dashboardData.totalRevenue)} tag={`ROI ${dashboardData.roi.toFixed(0)}%`} tagColor="bg-black/20 text-white" className="bg-violet-500 text-white" />
                <DashboardCard title="Реализовано сделок" value={formatNumber(dashboardData.dealsClosed)} className="bg-amber-500 text-white" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-md">
                     <h3 className="font-semibold mb-4 text-slate-900">Воронка продаж</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <FunnelChart>
                            <Tooltip contentStyle={tooltipStyle} />
                            <Funnel dataKey="value" data={dashboardData.funnelData} isAnimationActive>
                                {dashboardData.funnelData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="opacity-70" />
                                ))}
                                <LabelList position="right" fill="#1e293b" stroke="none" dataKey="name" formatter={(value: string) => value} style={{ fontSize: '14px' }} />
                                <LabelList position="center" fill="#fff" stroke="none" dataKey="value" formatter={(value: number) => value.toLocaleString()} style={{ fontSize: '16px', fontWeight: 'bold' }} />
                            </Funnel>
                        </FunnelChart>
                    </ResponsiveContainer>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="font-semibold mb-4 text-slate-900">Динамика лидов по направлениям</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <ScatterChart data={dashboardData.leadDynamics}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="name" stroke={axisColor} fontSize={12} />
                            <YAxis stroke={axisColor} fontSize={12}/>
                            <Tooltip contentStyle={tooltipStyle}/>
                            <Legend />
                            <Scatter name="РТИ Лиды" dataKey="РТИ Лиды" fill="#2563eb" />
                            <Scatter name="3D Лиды" dataKey="3D Лиды" fill="#16a34a" />
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="font-semibold mb-4 text-slate-900">Бюджет vs Выручка</h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={dashboardData.revenueBudgetDynamics}>
                            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                            <XAxis dataKey="name" stroke={axisColor} fontSize={12} />
                            <YAxis stroke={axisColor} fontSize={12} tickFormatter={(value) => `${Number(value) / 1000000}M`}/>
                            <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatTenge(Number(value))}/>
                            <Legend />
                            <Bar dataKey="Выручка" fill="#9333ea" />
                            <Bar dataKey="Бюджет" fill="#d1d5db" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                 <div className="bg-white p-6 rounded-xl shadow-md">
                    <h3 className="font-semibold mb-4 text-slate-900">Ключевые фин. показатели</h3>
                     <div className="grid grid-cols-2 gap-4 h-full">
                        <div className="flex-1">
                             <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={dashboardData.budgetDistribution} cx="50%" cy="50%" labelLine={false} innerRadius={40} outerRadius={70} fill="#8884d8" dataKey="value" 
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} >
                                        {dashboardData.budgetDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={tooltipStyle}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-3">
                            <div><p className="text-sm text-slate-500">CPC</p><p className="font-bold text-lg">{formatTenge(dashboardData.cpc)}</p></div>
                            <div><p className="text-sm text-slate-500">CPL</p><p className="font-bold text-lg">{formatTenge(dashboardData.cpl)}</p></div>
                            <div><p className="text-sm text-slate-500">ROI</p><p className="font-bold text-lg text-purple-600">{dashboardData.roi.toFixed(1)}%</p></div>
                        </div>
                     </div>
                </div>
                <div className="p-6 rounded-2xl shadow-lg lg:col-span-2 bg-gradient-to-br from-blue-600 to-blue-500">
                    <h3 className="font-semibold mb-4 text-white/90">Ключевые конверсии воронки</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {dashboardData.keyConversions.map((conv, index) => (
                            <div key={index} className="bg-white/20 backdrop-blur-sm p-4 rounded-xl text-center text-white">
                                <p className="text-sm font-medium text-white/80">{conv.label}</p>
                                <p className="text-3xl font-bold text-white mt-1">{conv.value.toFixed(1)}%</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-md lg:col-span-2">
                    <h3 className="font-semibold mb-4 text-slate-900">Цена за этапы воронок</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm font-medium text-slate-600">Стоимость Лида</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{formatTenge(dashboardData.cpl)}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm font-medium text-slate-600">Стоимость КП</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{formatTenge(dashboardData.costPerProposal)}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm font-medium text-slate-600">Стоимость Счета</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{formatTenge(dashboardData.costPerInvoice)}</p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg text-center">
                            <p className="text-sm font-medium text-slate-600">Стоимость Сделки</p>
                            <p className="text-2xl font-bold text-blue-600 mt-1">{formatTenge(dashboardData.costPerDeal)}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-md overflow-x-auto">
                <h3 className="font-semibold mb-4 text-slate-900">Детализация по периодам</h3>
                <table className="w-full text-sm text-left text-slate-600">
                     <thead className="text-xs text-slate-500 uppercase bg-gray-50">
                        <tr>
                            <th className="px-4 py-3">Период</th>
                            <th className="px-4 py-3">Бюджет</th>
                            <th className="px-4 py-3">Клики</th>
                            <th className="px-4 py-3">Лиды</th>
                            <th className="px-4 py-3">Сделки</th>
                            <th className="px-4 py-3">Выручка</th>
                            <th className="px-4 py-3">CPL</th>
                            <th className="px-4 py-3">ROI</th>
                        </tr>
                     </thead>
                     <tbody>
                        {filteredReports.slice(-12).reverse().map(r => {
                            const cpl = r.metrics.leads > 0 ? r.metrics.budget / r.metrics.leads : 0;
                            const roi = r.metrics.budget > 0 ? (r.metrics.sales - r.metrics.budget) / r.metrics.budget * 100 : 0;
                            return (
                                <tr key={r.id} className="border-b border-gray-200">
                                    <td className="px-4 py-3 font-medium text-slate-900">{r.name.replace('Отчет ','')}</td>
                                    <td className="px-4 py-3">{formatTenge(r.metrics.budget)}</td>
                                    <td className="px-4 py-3">{formatNumber(r.metrics.clicks)}</td>
                                    <td className="px-4 py-3">{formatNumber(r.metrics.leads)}</td>
                                    <td className="px-4 py-3">{formatNumber(r.metrics.deals)}</td>
                                    <td className="px-4 py-3">{formatTenge(r.metrics.sales)}</td>
                                    <td className="px-4 py-3">{formatTenge(cpl)}</td>
                                    <td className={`px-4 py-3 font-semibold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>{roi.toFixed(1)}%</td>
                                </tr>
                            )
                        })}
                     </tbody>
                </table>
             </div>
        </div>
    );
};

export default DashboardPage;