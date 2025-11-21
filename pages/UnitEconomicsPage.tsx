import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ResponsiveContainer, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Report, CommercialProposal } from '../types';

interface UnitEconomicsPageProps {
    reports: Report[];
    proposals: CommercialProposal[];
}

const FormulasModal: React.FC<{onClose: () => void}> = ({onClose}) => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800"><h2 className="text-xl font-bold">Формулы расчета юнит экономики</h2><button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-2xl">&times;</button></div>
            <div className="p-6 space-y-6 text-slate-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-900/50">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border dark:border-slate-700"><h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-2">Основные метрики</h3><p className="text-sm">CAC = Расходы на маркетинг / Количество клиентов</p><p className="text-sm">LTV = (Средний чек х (Процент маржи / 100)) / (1 - (Возврат клиентов / 100))</p><p className="text-sm">LTV / CAC = LTV / CAC</p></div>
                <div className="bg-green-50 dark:bg-green-500/10 p-4 rounded-lg border border-green-200 dark:border-green-500/20"><h3 className="font-semibold text-green-800 dark:text-green-400 mb-2">Финансовые показатели</h3><p className="text-sm">Валовая маржа = Выручка х (Процент маржи / 100)</p><p className="text-sm">Чистая прибыль = Валовая маржа - Расходы на маркетинг - Фиксированные затраты</p></div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-end sticky bottom-0 bg-white dark:bg-slate-800"><button onClick={onClose} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg">Закрыть</button></div>
        </div>
    </div>
);


const UnitEconomicsPage: React.FC<UnitEconomicsPageProps> = ({ reports, proposals }) => {
    // State for existing calculator
    const initialRevenue = useMemo(() => proposals.filter(p => p.status === 'Оплачено').reduce((sum, p) => sum + p.amount, 0), [proposals]);
    const initialMarketingSpend = useMemo(() => reports.reduce((sum, r) => sum + r.metrics.budget, 0), [reports]);
    const initialClients = useMemo(() => proposals.filter(p => p.status === 'Оплачено').length, [proposals]);
    const initialAvgCheck = useMemo(() => (initialClients > 0 ? initialRevenue / initialClients : 20000), [initialClients, initialRevenue]);
    
    const [avgCheck, setAvgCheck] = useState(initialAvgCheck);
    const [marketingSpend, setMarketingSpend] = useState(initialMarketingSpend || 100000);
    const [fixedCosts, setFixedCosts] = useState(16500000);
    const [margin, setMargin] = useState(30);
    const [clients, setClients] = useState(initialClients || 50);
    const [retention, setRetention] = useState(30);
    const [forecastGrowth, setForecastGrowth] = useState(10);
    const [isFormulasOpen, setFormulasOpen] = useState(false);

    // State for new financial model
    const [initialInvestment, setInitialInvestment] = useState(5000000);
    const [monthlyNewClients, setMonthlyNewClients] = useState(20);
    const [clientGrowth, setClientGrowth] = useState(15);
    const [cogs, setCogs] = useState(40);
    const [churnRate, setChurnRate] = useState(5);
    const [forecastPeriod, setForecastPeriod] = useState(24);
    const [modelCac, setModelCac] = useState(15000);
    const [modelAvgCheck, setModelAvgCheck] = useState(50000);
    const [modelFixedCosts, setModelFixedCosts] = useState(1000000);
    
    useEffect(() => {
        setAvgCheck(initialAvgCheck > 0 ? initialAvgCheck : 20000);
        setMarketingSpend(initialMarketingSpend > 0 ? initialMarketingSpend : 100000);
        setClients(initialClients > 0 ? initialClients : 50);
    }, [initialAvgCheck, initialMarketingSpend, initialClients]);

    const axisColor = 'hsl(222 8% 45%)';
    const gridColor = 'hsl(215 20% 90%)';
    const tooltipStyle = {
        backgroundColor: 'hsl(0 0% 100%)',
        border: '1px solid hsl(215 20% 90%)',
        borderRadius: '0.75rem',
        color: 'hsl(222 24% 15%)',
    };
    
    // Calculations for existing calculator
    const { revenue, cac, ltv, ltvCacRatio, netProfit, profitPerClient, marketingRoi, breakevenClients, returnedClients, newClients } = useMemo(() => {
        const revenue = avgCheck * clients;
        const cac = clients > 0 ? marketingSpend / clients : 0;
        const ltv = retention > 0 && retention < 100 ? (avgCheck * margin / 100) * (1 / (1 - (retention / 100))) : (avgCheck * margin / 100);
        const ltvCacRatio = cac > 0 ? ltv / cac : 0;
        const grossMargin = revenue * (margin / 100);
        const netProfit = grossMargin - fixedCosts - marketingSpend;
        const profitPerClient = clients > 0 ? netProfit / clients : 0;
        const marketingRoi = marketingSpend > 0 ? (grossMargin - marketingSpend) / marketingSpend * 100 : 0;
        const costPerAcquisition = clients > 0 ? marketingSpend / clients : 0;
        const profitPerClientRaw = (avgCheck * margin / 100);
        const breakevenClients = (profitPerClientRaw > costPerAcquisition) ? (fixedCosts) / (profitPerClientRaw - costPerAcquisition) : Infinity;
        const returnedClients = Math.round(clients * (retention / 100));
        const newClients = clients - returnedClients;
        return { revenue, cac, ltv, ltvCacRatio, netProfit, profitPerClient, marketingRoi, breakevenClients, returnedClients, newClients };
    }, [avgCheck, marketingSpend, fixedCosts, margin, clients, retention]);
    
    const calculatorForecastData = useMemo(() => {
        let lastMonthRevenue = revenue;
        let lastMonthProfit = netProfit;
        let lastMonthClients = clients;
        return Array.from({ length: 13 }, (_, i) => {
            if (i > 0) {
                 lastMonthClients *= (1 + forecastGrowth / 100);
                 lastMonthRevenue = lastMonthClients * avgCheck;
                 const forecastMarketingSpend = marketingSpend * (1 + forecastGrowth / 100); 
                 lastMonthProfit = (lastMonthRevenue * margin / 100) - fixedCosts - forecastMarketingSpend;
            }
            return { name: `M${i}`, Выручка: lastMonthRevenue, Прибыль: lastMonthProfit, Клиенты: lastMonthClients };
        });
    }, [clients, avgCheck, margin, fixedCosts, marketingSpend, forecastGrowth, revenue, netProfit]);
    
    // Calculations for new financial model
    const financialModelData = useMemo(() => {
        const data = [];
        let cumulativeProfit = -initialInvestment;
        let totalClientsAtMonthStart = 0;
        let paybackMonth = null;

        for (let i = 1; i <= forecastPeriod; i++) {
            const newClientsThisMonth = Math.round(monthlyNewClients * Math.pow(1 + clientGrowth / 100, i - 1));
            const lostClients = Math.round(totalClientsAtMonthStart * (churnRate / 100));
            const endingClients = totalClientsAtMonthStart + newClientsThisMonth - lostClients;

            const revenue = endingClients * modelAvgCheck;
            const grossProfit = revenue * (1 - cogs / 100);
            const marketingCosts = newClientsThisMonth * modelCac;
            const netProfit = grossProfit - modelFixedCosts - marketingCosts;
            cumulativeProfit += netProfit;

            if (paybackMonth === null && cumulativeProfit > 0) {
                paybackMonth = i;
            }

            data.push({
                month: i,
                startingClients: totalClientsAtMonthStart,
                newClients: newClientsThisMonth,
                lostClients,
                endingClients,
                revenue,
                grossProfit,
                marketingCosts,
                netProfit,
                cumulativeProfit,
            });
            
            totalClientsAtMonthStart = endingClients;
        }

        const arpu = modelAvgCheck * (1 - cogs / 100); 
        const ltv = churnRate > 0 ? arpu / (churnRate / 100) : Infinity; 
        const ltvCacRatio = modelCac > 0 ? ltv / modelCac : Infinity;

        return {
            tableData: data,
            paybackPeriod: paybackMonth,
            totalProfit: cumulativeProfit,
            ltv,
            ltvCacRatio,
        };
    }, [initialInvestment, monthlyNewClients, clientGrowth, churnRate, forecastPeriod, modelAvgCheck, cogs, modelCac, modelFixedCosts]);


    const InputSlider: React.FC<{label: string, value: number, setValue: (v: number) => void, min: number, max: number, step: number, format: (v: number) => string, unit?: '₸' | '%'}> = 
        ({label, value, setValue, min, max, step, format, unit}) => {
    
        const [inputValue, setInputValue] = useState(value.toString());
        const inputRef = useRef<HTMLInputElement>(null);

        useEffect(() => {
            if (document.activeElement !== inputRef.current) {
                setInputValue(value.toString());
            }
        }, [value]);
        
        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setInputValue(e.target.value);
        };

        const handleInputBlur = () => {
            let numValue = parseInt(inputValue, 10);
            if (isNaN(numValue) || numValue < min) {
                numValue = min;
            } else if (numValue > max) {
                numValue = max;
            }
            setValue(numValue);
            setInputValue(numValue.toString());
        };
        
        const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
                handleInputBlur();
                inputRef.current?.blur();
            }
        };

        return (
            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-300">{label}</label>
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-slate-700/50 rounded-lg p-1 border border-transparent focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-all">
                        {unit === '₸' && <span className="text-sm text-slate-500 dark:text-slate-400 pl-1">{unit}</span>}
                        <input 
                            ref={inputRef}
                            type="number" 
                            value={inputValue} 
                            onChange={handleInputChange}
                            onBlur={handleInputBlur}
                            onKeyDown={handleInputKeyDown}
                            min={min}
                            max={max}
                            step={step}
                            className="w-32 text-right font-semibold text-blue-600 dark:text-blue-400 text-base bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        {unit === '%' && <span className="text-sm text-slate-500 dark:text-slate-400 pr-1">{unit}</span>}
                    </div>
                </div>
                <input 
                    type="range" 
                    min={min} 
                    max={max} 
                    step={step} 
                    value={value} 
                    onChange={(e) => setValue(Number(e.target.value))} 
                    className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <p>{format(min)}</p>
                    <p>{format(max)}</p>
                </div>
            </div>
        );
    };
    
    return (
        <div className="space-y-8">
            {isFormulasOpen && <FormulasModal onClose={() => setFormulasOpen(false)} />}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                 <div><h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Юнит экономика и финмодель</h1><p className="text-slate-500 dark:text-slate-400 mt-1">Анализ, моделирование и прогнозирование экономики бизнеса</p></div>
                <div className="flex space-x-2"><button onClick={() => setFormulasOpen(true)} className="bg-white dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold py-2 px-4 rounded-lg text-sm border border-gray-300 dark:border-slate-700">Формулы расчета</button></div>
            </div>
            
             {/* New Financial Model Section */}
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl border border-blue-200 dark:border-blue-800">
                <h2 className="text-2xl font-bold mb-1 dark:text-slate-100">Финансовая модель и прогноз запуска</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Смоделируйте запуск нового продукта или проекта, чтобы оценить его потенциал.</p>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1 space-y-4">
                        <InputSlider label="Инвестиции на запуск" value={initialInvestment} setValue={setInitialInvestment} min={0} max={50000000} step={100000} format={v => `${(v/1000000).toFixed(1)}M`} unit="₸"/>
                        <InputSlider label="Новых клиентов в месяц" value={monthlyNewClients} setValue={setMonthlyNewClients} min={1} max={1000} step={1} format={v => v.toString()}/>
                        <InputSlider label="Ежемесячный рост клиентов" value={clientGrowth} setValue={setClientGrowth} min={0} max={100} step={1} format={v => `${v}%`} unit="%"/>
                        <InputSlider label="Средний чек" value={modelAvgCheck} setValue={setModelAvgCheck} min={1000} max={5000000} step={1000} format={v => `${(v/1000).toFixed(0)}K`} unit="₸"/>
                        <InputSlider label="Себестоимость (COGS)" value={cogs} setValue={setCogs} min={0} max={100} step={1} format={v => `${v}%`} unit="%"/>
                        <InputSlider label="Ежемесячный отток (Churn)" value={churnRate} setValue={setChurnRate} min={0} max={100} step={1} format={v => `${v}%`} unit="%"/>
                        <InputSlider label="Затраты на клиента (CAC)" value={modelCac} setValue={setModelCac} min={0} max={500000} step={1000} format={v => `${(v/1000).toFixed(0)}K`} unit="₸"/>
                        <InputSlider label="Ежемес. фикс. затраты" value={modelFixedCosts} setValue={setModelFixedCosts} min={0} max={10000000} step={50000} format={v => `${(v/1000000).toFixed(1)}M`} unit="₸"/>
                        <InputSlider label="Период прогноза (мес)" value={forecastPeriod} setValue={setForecastPeriod} min={6} max={36} step={1} format={v => v.toString()}/>
                    </div>
                    <div className="lg:col-span-2 space-y-4">
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-blue-50 dark:bg-blue-900/50 p-3 rounded-lg"><p className="text-xs text-blue-800 dark:text-blue-300">Срок окупаемости</p><p className="text-lg font-bold text-blue-900 dark:text-blue-200">{financialModelData.paybackPeriod ? `${financialModelData.paybackPeriod} мес.` : 'N/A'}</p></div>
                            <div className="bg-green-50 dark:bg-green-900/50 p-3 rounded-lg"><p className="text-xs text-green-800 dark:text-green-300">LTV / CAC</p><p className="text-lg font-bold text-green-900 dark:text-green-200">{isFinite(financialModelData.ltvCacRatio) ? `${financialModelData.ltvCacRatio.toFixed(1)}x` : '∞'}</p></div>
                            <div className="bg-purple-50 dark:bg-purple-900/50 p-3 rounded-lg"><p className="text-xs text-purple-800 dark:text-purple-300">LTV</p><p className="text-lg font-bold text-purple-900 dark:text-purple-200">{isFinite(financialModelData.ltv) ? `₸${financialModelData.ltv.toLocaleString(undefined, {maximumFractionDigits:0})}` : '∞'}</p></div>
                            <div className="bg-orange-50 dark:bg-orange-900/50 p-3 rounded-lg"><p className="text-xs text-orange-800 dark:text-orange-300">Итоговая прибыль</p><p className="text-lg font-bold text-orange-900 dark:text-orange-200">{`₸${(financialModelData.totalProfit/1000000).toFixed(2)}M`}</p></div>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart
                                data={financialModelData.tableData}
                                margin={{ top: 10, right: 30, left: 0, bottom: 20 }}
                            >
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorNetProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorCumulative" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                                <XAxis dataKey="month" stroke={axisColor} fontSize={12} label={{ value: 'Месяц', position: 'insideBottom', offset: 0 }}/>
                                <YAxis stroke={axisColor} fontSize={12} tickFormatter={(val) => `${(val/1000000).toFixed(1)}M`} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(val: number) => `₸${val.toLocaleString()}`}/>
                                <Legend verticalAlign="bottom" height={36}/>
                                <Area type="monotone" dataKey="revenue" name="Выручка" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" activeDot={{ r: 6 }} />
                                <Area type="monotone" dataKey="netProfit" name="Чистая прибыль" stroke="#22c55e" fillOpacity={1} fill="url(#colorNetProfit)" activeDot={{ r: 6 }} />
                                <Area type="monotone" dataKey="cumulativeProfit" name="Накопленная прибыль" stroke="#f97316" fillOpacity={1} fill="url(#colorCumulative)" activeDot={{ r: 6 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                         <div className="max-h-64 overflow-y-auto mt-6">
                           <table className="w-full text-xs text-left">
                                <thead className="sticky top-0 bg-gray-100 dark:bg-slate-700"><tr className="text-slate-600 dark:text-slate-300">{['Мес', 'Клиенты', 'Выручка', 'Прибыль', 'Накоп. прибыль'].map(h=><th key={h} className="p-1.5 font-medium">{h}</th>)}</tr></thead>
                                <tbody>{financialModelData.tableData.map(row=>(<tr key={row.month} className="border-b dark:border-slate-700"><td className="p-1.5">{row.month}</td><td className="p-1.5">{row.endingClients}</td><td className="p-1.5">{row.revenue.toLocaleString(undefined,{maximumFractionDigits:0})}</td><td className={`p-1.5 ${row.netProfit < 0 ? 'text-red-500' : 'text-green-600'}`}>{row.netProfit.toLocaleString(undefined,{maximumFractionDigits:0})}</td><td className={`p-1.5 ${row.cumulativeProfit < 0 ? 'text-red-500' : ''}`}>{row.cumulativeProfit.toLocaleString(undefined,{maximumFractionDigits:0})}</td></tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Existing Unit Economics Calculator */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg space-y-5"><h3 className="text-xl font-bold dark:text-slate-100">Калькулятор юнит-экономики</h3>
                    <InputSlider label="Средний чек" value={avgCheck} setValue={setAvgCheck} min={1000} max={5000000} step={1000} format={v => (v/1000).toFixed(0) + 'K'} unit="₸"/>
                    <InputSlider label="Количество клиентов" value={clients} setValue={setClients} min={1} max={1000} step={1} format={v => v.toString()}/>
                    <InputSlider label="Маркетинговые расходы" value={marketingSpend} setValue={setMarketingSpend} min={0} max={50000000} step={50000} format={v => (v/1000000).toFixed(1) + 'M'} unit="₸"/>
                    <InputSlider label="Фиксированные затраты" value={fixedCosts} setValue={setFixedCosts} min={0} max={50000000} step={50000} format={v => (v/1000000).toFixed(1) + 'M'} unit="₸"/>
                    <InputSlider label="Процент маржи" value={margin} setValue={setMargin} min={0} max={100} step={1} format={v => `${v}%`} unit="%"/>
                    <InputSlider label="Возврат клиентов" value={retention} setValue={setRetention} min={0} max={100} step={1} format={v => `${v}%`} unit="%"/>
                </div>
                <div className="lg:col-span-3 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg"><h3 className="text-xl font-bold mb-4 dark:text-slate-100">Рассчитанные метрики</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 rounded-lg col-span-1 sm:col-span-2"><p className="text-sm text-blue-700 dark:text-blue-300">Расчетная выручка</p><p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{`₸${revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</p></div>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg"><p className="text-sm text-slate-500 dark:text-slate-400">CAC</p><p className="text-xl font-bold dark:text-slate-200">{`₸${cac.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</p></div>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg"><p className="text-sm text-slate-500 dark:text-slate-400">LTV</p><p className="text-xl font-bold dark:text-slate-200">{`₸${ltv.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}</p></div>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg col-span-1 sm:col-span-2"><p className="text-sm text-slate-500 dark:text-slate-400">LTV / CAC Ratio</p><p className="text-2xl font-bold text-green-600 dark:text-green-400">{ltvCacRatio.toFixed(2)}x</p></div>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg"><p className="text-sm text-slate-500 dark:text-slate-400">Структура клиентов</p><p className="text-lg font-bold dark:text-slate-200">Новые: {newClients} | Вернувшиеся: {returnedClients}</p></div>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg"><p className="text-sm text-slate-500 dark:text-slate-400">Чистая прибыль</p><p className="text-xl font-bold dark:text-slate-200">{`₸${(netProfit/1000000).toFixed(2)}M`}</p></div>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg"><p className="text-sm text-slate-500 dark:text-slate-400">Прибыль на клиента</p><p className="text-xl font-bold dark:text-slate-200">{`₸${profitPerClient.toLocaleString(undefined,{maximumFractionDigits:0})}`}</p></div>
                        <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg"><p className="text-sm text-slate-500 dark:text-slate-400">ROI маркетинга</p><p className="text-xl font-bold dark:text-slate-200">{`${marketingRoi.toFixed(0)}%`}</p></div>
                        <div className="bg-orange-100 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-3 rounded-lg"><p className="text-sm text-orange-700 dark:text-orange-300">Точка безубыточности (клиентов)</p><p className="text-xl font-bold text-orange-800 dark:text-orange-200">{isFinite(breakevenClients) ? Math.ceil(breakevenClients) : 'N/A'}</p></div>
                    </div>
                </div>
            </div>
            
            <div className="mt-6 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg">
                <h3 className="font-semibold mb-4 dark:text-slate-100">Прогноз развития (на основе калькулятора)</h3>
                <InputSlider label="Темп роста (%/месяц)" value={forecastGrowth} setValue={setForecastGrowth} min={0} max={50} step={1} format={v => `${v}%`} unit="%"/>
                <ResponsiveContainer width="100%" height={300} className="mt-4">
                    <LineChart data={calculatorForecastData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                        <XAxis dataKey="name" stroke={axisColor} fontSize={12} />
                        <YAxis yAxisId="left" stroke="#2563eb" fontSize={12} tickFormatter={(val) => `${(val/1000000).toFixed(0)}M`} />
                        <YAxis yAxisId="right" orientation="right" stroke="#f472b6" fontSize={12} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(val, name) => [name === 'Клиенты' ? Math.round(Number(val)).toString() : `₸${Number(val).toLocaleString(undefined, {maximumFractionDigits: 0})}`, name]} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="Выручка" stroke="#2563eb" strokeWidth={2} />
                        <Line yAxisId="left" type="monotone" dataKey="Прибыль" stroke="#34d399" strokeWidth={2} />
                        <Line yAxisId="right" type="monotone" dataKey="Клиенты" stroke="#f472b6" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg text-center"><p className="text-sm text-slate-500 dark:text-slate-400">Выручка через 12 мес.</p><p className="text-xl font-bold dark:text-slate-200">{`₸${(calculatorForecastData[12].Выручка/1000000).toFixed(2)}M`}</p></div>
                    <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg text-center"><p className="text-sm text-slate-500 dark:text-slate-400">Прибыль через 12 мес.</p><p className="text-xl font-bold dark:text-slate-200">{`₸${(calculatorForecastData[12].Прибыль/1000000).toFixed(2)}M`}</p></div>
                    <div className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg text-center"><p className="text-sm text-slate-500 dark:text-slate-400">Клиентов через 12 мес.</p><p className="text-xl font-bold dark:text-slate-200">{Math.round(calculatorForecastData[12].Клиенты)}</p></div>
                </div>
            </div>
        </div>
    );
};

export default UnitEconomicsPage;