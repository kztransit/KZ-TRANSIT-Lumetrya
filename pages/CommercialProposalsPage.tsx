import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CommercialProposal } from '../types';
import { fileToBase64 } from '../utils';
import { analyzeProposalsImage } from '../services/geminiService';

interface CommercialProposalsPageProps {
    proposals: CommercialProposal[];
    addProposal: (proposal: Omit<CommercialProposal, 'id'>) => void;
    deleteProposal: (id: string) => void;
    setProposals: (updater: (prevProposals: CommercialProposal[]) => CommercialProposal[]) => void;
    updateProposal: (proposal: CommercialProposal) => void;
}

const statusColorMap: { [key in CommercialProposal['status']]: string } = {
    'Оплачено': 'bg-green-100 text-green-800',
    'Ожидание': 'bg-yellow-100 text-yellow-800',
    'Отменено': 'bg-red-100 text-red-800',
};

const formatTenge = (value: number | null) => value ? `₸${new Intl.NumberFormat('ru-RU').format(value)}` : '-';

const calculateSummary = (proposalList: CommercialProposal[]): { paidAmount: number, paidCount: number, pendingAmount: number, pendingCount: number } => {
    let paidAmount = 0;
    let paidCount = 0;
    let pendingAmount = 0;
    let pendingCount = 0;
    for (const p of proposalList) {
        const amount = Number(p.amount) || 0;
        if (p.status === 'Оплачено') {
            paidAmount += amount;
            paidCount += 1;
        } else if (p.status === 'Ожидание') {
            pendingAmount += amount;
            pendingCount += 1;
        }
    }
    return { paidAmount, paidCount, pendingAmount, pendingCount };
};

const ProposalFormModal: React.FC<{
    onClose: () => void, 
    onSave: (proposal: Omit<CommercialProposal, 'id'> | CommercialProposal) => void,
    initialData?: CommercialProposal | null,
    defaultDirection?: 'РТИ' | '3D'
}> = ({onClose, onSave, initialData, defaultDirection}) => {
    
    const isEditing = !!initialData;

    const getInitialState = (): Omit<CommercialProposal, 'id'> => {
        if (initialData) return initialData;
        return {
            date: new Date().toISOString().split('T')[0],
            direction: defaultDirection || 'РТИ',
            item: '',
            amount: 0,
            company: null,
            invoiceNumber: null,
            invoiceDate: null,
            paymentDate: null,
            status: 'Ожидание',
            paymentType: null,
            proposalNumber: ''
        };
    };

    const [formData, setFormData] = useState<Omit<CommercialProposal, 'id'>>(getInitialState());

    useEffect(() => {
        setFormData(getInitialState());
    }, [initialData, defaultDirection]);


    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };
    
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const proposalToSave = {
            ...formData,
            amount: Number(formData.amount) || 0,
            proposalNumber: formData.proposalNumber || `КП-${Math.floor(Math.random() * 10000)}`
        };

        if (isEditing) {
            onSave({ ...proposalToSave, id: initialData.id });
        } else {
            onSave(proposalToSave);
        }

        onClose();
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                 <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white">
                    <h2 className="text-xl font-bold">{isEditing ? "Редактировать КП" : "Создать КП вручную"}</h2>
                    <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-800 text-2xl">&times;</button>
                </div>
                 <div className="p-6 space-y-6 bg-gray-50 overflow-y-auto">
                    <div className="bg-white p-4 rounded-lg border">
                        <h3 className="font-semibold mb-4">Основная информация</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-sm text-slate-500 block mb-1">Дата КП *</label><input required name="date" type="date" value={formData.date} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                            <div><label className="text-sm text-slate-500 block mb-1">Направление</label><select name="direction" value={formData.direction} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"><option>РТИ</option><option>3D</option></select></div>
                            <div className="md:col-span-2"><label className="text-sm text-slate-500 block mb-1">Наименование товара/услуги *</label><input required name="item" type="text" value={formData.item} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                            <div><label className="text-sm text-slate-500 block mb-1">Сумма (₸) *</label><input required name="amount" type="number" value={formData.amount} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                            <div><label className="text-sm text-slate-500 block mb-1">Компания</label><input name="company" type="text" value={formData.company || ''} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                        </div>
                    </div>
                     <div className="bg-white p-4 rounded-lg border">
                        <h3 className="font-semibold mb-4">Счет и оплата</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div><label className="text-sm text-slate-500 block mb-1">Номер счета</label><input name="invoiceNumber" type="text" value={formData.invoiceNumber || ''} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                            <div><label className="text-sm text-slate-500 block mb-1">Дата счета</label><input name="invoiceDate" type="date" value={formData.invoiceDate || ''} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                            <div><label className="text-sm text-slate-500 block mb-1">Дата поступления оплаты</label><input name="paymentDate" type="date" value={formData.paymentDate || ''} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"/></div>
                            <div><label className="text-sm text-slate-500 block mb-1">Статус</label><select name="status" value={formData.status} onChange={handleChange} className="w-full bg-gray-100 p-2 rounded-lg"><option>Ожидание</option><option>Оплачено</option><option>Отменено</option></select></div>
                        </div>
                    </div>
                 </div>
                 <div className="p-6 border-t border-gray-200 flex justify-end sticky bottom-0 bg-white">
                    <button type="submit" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg">✓ {isEditing ? "Сохранить" : "Создать КП"}</button>
                 </div>
            </form>
        </div>
    );
};

const ImportProposalsModal: React.FC<{
    onClose: () => void, 
    onImport: (proposals: Omit<CommercialProposal, 'id'>[]) => void, 
    importDirection: 'РТИ' | '3D'
}> = ({ onClose, onImport, importDirection }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    const [parsedProposals, setParsedProposals] = useState<Omit<CommercialProposal, 'id'>[]>([]);

    const handleFieldChange = (index: number, field: keyof CommercialProposal, value: any) => {
        const updated = [...parsedProposals];
        (updated[index] as any)[field] = value;
        if (field === 'paymentDate') {
            updated[index].status = value ? 'Оплачено' : 'Ожидание';
        }
        setParsedProposals(updated);
    };
    
    const handleDeleteRow = (index: number) => {
        setParsedProposals(parsedProposals.filter((_, i) => i !== index));
    };

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
            const analyzedData = await analyzeProposalsImage(file.type, base64Data, importDirection);
            
            if (typeof analyzedData !== 'object' || analyzedData === null || !Array.isArray(analyzedData[importDirection])) {
                console.error("Invalid data structure from AI for direction:", importDirection, analyzedData);
                throw new Error("AI вернул данные в неожиданном формате.");
            }
            
            const relevantAnalyzedProposals = (analyzedData[importDirection]).map(p => ({
                ...p,
                direction: importDirection
            }));
    
            const newProposals = relevantAnalyzedProposals.map(p => {
                const originalDate = p.date ? new Date(p.date) : null;
                const day = originalDate && !isNaN(originalDate.getTime()) ? originalDate.getDate() : 1;
                const finalDate = new Date(year, month - 1, day);

                return {
                    date: finalDate.toISOString().split('T')[0],
                    direction: importDirection,
                    item: p.item || 'N/A',
                    amount: p.amount || 0,
                    company: p.company || null,
                    invoiceNumber: p.invoiceNumber || null,
                    invoiceDate: p.invoiceDate || null,
                    paymentDate: p.paymentDate || null,
                    status: p.paymentDate ? 'Оплачено' as const : 'Ожидание' as CommercialProposal['status'],
                    paymentType: null,
                    proposalNumber: p.invoiceNumber || `КП-${Math.floor(Math.random() * 10000)}`
                };
            });

            if (newProposals.length === 0) {
                setError(`В файле не найдено предложений для направления "${importDirection}". Попробуйте другой файл или проверьте его содержимое.`);
                return;
            }

            setParsedProposals(newProposals);
            setStep(2);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Не удалось проанализировать файл.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleConfirmImport = () => {
        onImport(parsedProposals);
        onClose();
    };

    const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold">Импорт КП ({importDirection}) - Шаг {step}/2</h2>
                    <button type="button" onClick={onClose}>&times;</button>
                </div>
                {step === 1 && (
                    <div className="p-6 space-y-4">
                         <div>
                            <h3 className="font-semibold mb-2 text-slate-900">1. Укажите период для импорта</h3>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-slate-500 block mb-1">Месяц *</label>
                                    <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full bg-gray-100 p-2 rounded-lg">
                                        {monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-slate-500 block mb-1">Год *</label>
                                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full bg-gray-100 p-2 rounded-lg">
                                         {years.map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div>
                             <h3 className="font-semibold mb-2 text-slate-900">2. Загрузите файл</h3>
                            <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center">
                                <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept="image/*,application/pdf" />
                                <label htmlFor="file-upload" className="cursor-pointer text-cyan-600 font-semibold">{file ? file.name : "Выберите файл..."}</label>
                                <p className="text-xs text-slate-500 mt-2">Загрузите скриншот, фото или PDF-файл с таблицей КП</p>
                            </div>
                            {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
                        </div>
                         <div className="p-6 border-t border-gray-200 flex justify-end -m-6 mt-4">
                            <button onClick={handleParse} disabled={!file || isLoading} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-slate-400">
                                {isLoading ? "Анализ..." : "Далее →"}
                            </button>
                        </div>
                    </div>
                )}
                {step === 2 && (
                    <>
                    <div className="p-6 overflow-auto">
                        <p className="text-slate-600 mb-4">Проверьте данные, извлеченные для направления <span className="font-bold">{importDirection}</span>. Вы можете их отредактировать или удалить строки перед импортом.</p>
                        <div className="overflow-x-auto">
                           <table className="w-full text-sm">
                               <thead>
                                 <tr className="text-left text-xs text-slate-500 bg-gray-50">
                                    {['Дата', 'Направление', 'Товар', 'Компания', 'Сумма', 'Статус', 'Действие'].map(h => <th key={h} className="p-2 font-medium">{h}</th>)}
                                 </tr>
                               </thead>
                               <tbody>
                                {parsedProposals.map((p, i) => (
                                    <tr key={i} className="border-b last:border-0">
                                        <td className="p-1"><input type="date" value={p.date} onChange={e => handleFieldChange(i, 'date', e.target.value)} className="w-full bg-gray-100 p-1 rounded-md"/></td>
                                        <td className="p-1 text-center"><span className="bg-gray-100 p-1 rounded-md block w-full text-sm">{p.direction}</span></td>
                                        <td className="p-1"><input type="text" value={p.item} onChange={e => handleFieldChange(i, 'item', e.target.value)} className="w-full bg-gray-100 p-1 rounded-md"/></td>
                                        <td className="p-1"><input type="text" value={p.company || ''} onChange={e => handleFieldChange(i, 'company', e.target.value)} className="w-full bg-gray-100 p-1 rounded-md"/></td>
                                        <td className="p-1"><input type="number" value={p.amount} onChange={e => handleFieldChange(i, 'amount', Number(e.target.value))} className="w-full bg-gray-100 p-1 rounded-md"/></td>
                                        <td className="p-1">
                                            <select value={p.status} onChange={e => handleFieldChange(i, 'status', e.target.value)} className="w-full bg-gray-100 p-1 rounded-md">
                                                <option>Ожидание</option><option>Оплачено</option><option>Отменено</option>
                                            </select>
                                        </td>
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
                             Импортировать ({parsedProposals.length})
                        </button>
                    </div>
                    </>
                )}
            </div>
        </div>
    );
};

const ProposalTable: React.FC<{
    proposals: CommercialProposal[];
    onEdit: (proposal: CommercialProposal) => void;
    onDelete: (id: string) => void;
}> = ({ proposals, onEdit, onDelete }) => {
    if (proposals.length === 0) {
        return <div className="text-center py-10 text-slate-500">Нет данных для отображения.</div>;
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left text-slate-600">
                <thead className="text-xs text-slate-500 uppercase bg-gray-50">
                    <tr>
                        {["Дата", "№ счета", "Компания", "Наименование", "Сумма", "Статус", ""].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {proposals.map(p => (
                        <tr key={p.id} className="border-b border-gray-200 hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-slate-900">{new Date(p.date).toLocaleDateString()}</td>
                            <td className="px-4 py-3">{p.invoiceNumber || p.proposalNumber}</td>
                            <td className="px-4 py-3">{p.company}</td>
                            <td className="px-4 py-3">{p.item}</td>
                            <td className="px-4 py-3 font-semibold">{formatTenge(p.amount)}</td>
                            <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColorMap[p.status]}`}>{p.status}</span></td>
                            <td className="px-4 py-3 flex space-x-3">
                                <button onClick={() => onEdit(p)} className="text-slate-400 hover:text-cyan-500">✏️</button>
                                <button onClick={() => onDelete(p.id)} className="text-slate-400 hover:text-red-500">🗑️</button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const PaginationControls: React.FC<{
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}> = ({ currentPage, totalPages, onPageChange }) => (
    <div className="flex justify-between items-center mt-4 pt-4 border-t">
        <span className="text-sm text-slate-500">
            Страница {currentPage} из {totalPages}
        </span>
        <div className="flex space-x-2">
            <button
                onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm bg-white border rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
                Назад
            </button>
            <button
                onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm bg-white border rounded-md disabled:opacity-50 hover:bg-gray-50 transition-colors"
            >
                Вперед
            </button>
        </div>
    </div>
);


const CommercialProposalsPage: React.FC<CommercialProposalsPageProps> = ({ proposals, addProposal, deleteProposal, setProposals, updateProposal }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    const [editingProposal, setEditingProposal] = useState<CommercialProposal | null>(null);
    const [activeTab, setActiveTab] = useState<'РТИ' | '3D'>('РТИ');
    const [modalContext, setModalContext] = useState<'РТИ' | '3D'>('РТИ');

    const [filters, setFilters] = useState({
        status: 'all',
        month: 'all',
        year: 'all',
        search: '',
    });
    
    const [rtiCurrentPage, setRtiCurrentPage] = useState(1);
    const [d3CurrentPage, setD3CurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 30;

    const availableYears = useMemo(() => {
        if (!proposals) return [];
        const years = new Set(proposals.map(p => new Date(p.date).getFullYear()));
        // FIX: Explicitly type sort function parameters to prevent type inference issues.
        return Array.from(years).sort((a: number, b: number) => b - a);
    }, [proposals]);

    useEffect(() => {
        setRtiCurrentPage(1);
        setD3CurrentPage(1);
    }, [filters]);
    
    const { rtiProposals, d3Proposals, rtiSummary, d3Summary, totalSummary } = useMemo(() => {
        const filtered = proposals.filter(p => {
            const proposalDate = new Date(p.date);
            const searchLower = filters.search.toLowerCase();
            return (
                (filters.status === 'all' || p.status === filters.status) &&
                (filters.month === 'all' || (proposalDate.getMonth() + 1).toString() === filters.month) &&
                (filters.year === 'all' || proposalDate.getFullYear().toString() === filters.year) &&
                (filters.search === '' || 
                    p.item.toLowerCase().includes(searchLower) ||
                    (p.company && p.company.toLowerCase().includes(searchLower)) ||
                    p.proposalNumber.toLowerCase().includes(searchLower)
                )
            );
        });
        
        const rtiProposals = filtered.filter(p => p.direction === 'РТИ');
        const d3Proposals = filtered.filter(p => p.direction === '3D');
        
        const rtiSummary = calculateSummary(rtiProposals);
        const d3Summary = calculateSummary(d3Proposals);
        
        const totalSummary = {
            paidAmount: rtiSummary.paidAmount + d3Summary.paidAmount,
            paidCount: rtiSummary.paidCount + d3Summary.paidCount,
            pendingAmount: rtiSummary.pendingAmount + d3Summary.pendingAmount,
            pendingCount: rtiSummary.pendingCount + d3Summary.pendingCount,
            totalCount: filtered.length
        };

        return { rtiProposals, d3Proposals, rtiSummary, d3Summary, totalSummary };
    }, [proposals, filters]);
    
    const rtiTotalPages = Math.ceil(rtiProposals.length / ITEMS_PER_PAGE);
    const paginatedRtiProposals = rtiProposals.slice((rtiCurrentPage - 1) * ITEMS_PER_PAGE, rtiCurrentPage * ITEMS_PER_PAGE);
    
    const d3TotalPages = Math.ceil(d3Proposals.length / ITEMS_PER_PAGE);
    const paginatedD3Proposals = d3Proposals.slice((d3CurrentPage - 1) * ITEMS_PER_PAGE, d3CurrentPage * ITEMS_PER_PAGE);
    
    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleEdit = (proposal: CommercialProposal) => {
        setEditingProposal(proposal);
        setModalContext(proposal.direction);
        setIsFormOpen(true);
    };

    const handleDelete = useCallback((id: string) => {
        if (window.confirm('Вы уверены, что хотите удалить это КП?')) {
            deleteProposal(id);
        }
    }, [deleteProposal]);
    
    const handleSave = (proposalData: Omit<CommercialProposal, 'id'> | CommercialProposal) => {
        if ('id' in proposalData) {
            updateProposal(proposalData);
        } else {
            addProposal(proposalData);
        }
        setIsFormOpen(false);
        setEditingProposal(null);
    };

    // ИСПРАВЛЕНО: Теперь при импорте каждый элемент добавляется через addProposal (который сохраняет в Supabase)
    const handleImport = (importedProposals: Omit<CommercialProposal, 'id'>[]) => {
        importedProposals.forEach(proposal => {
            addProposal(proposal);
        });
    };
    
    const closeForm = () => {
        setIsFormOpen(false);
        setEditingProposal(null);
    }

    return (
        <div className="space-y-6">
            {isFormOpen && <ProposalFormModal onClose={closeForm} onSave={handleSave} initialData={editingProposal} defaultDirection={modalContext}/>}
            {isImportOpen && <ImportProposalsModal onClose={() => setIsImportOpen(false)} onImport={handleImport} importDirection={modalContext} />}

            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Коммерческие предложения</h1>
                    <p className="text-slate-500 mt-1">Отслеживание и управление всеми КП, счетами и оплатами</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Всего оплачено</p><p className="text-2xl font-bold text-green-600">{formatTenge(totalSummary.paidAmount)}</p><p className="text-xs text-slate-400">{totalSummary.paidCount} шт.</p></div>
                <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Всего в ожидании</p><p className="text-2xl font-bold text-yellow-600">{formatTenge(totalSummary.pendingAmount)}</p><p className="text-xs text-slate-400">{totalSummary.pendingCount} шт.</p></div>
                <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Общая конверсия в оплату</p><p className="text-2xl font-bold text-slate-900">{totalSummary.totalCount > 0 ? ((totalSummary.paidCount / totalSummary.totalCount) * 100).toFixed(1) : 0}%</p></div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-sm">
                 <div className="flex flex-col md:flex-row items-center gap-2">
                    <input type="search" name="search" placeholder="Поиск по товару, компании, номеру..." value={filters.search} onChange={handleFilterChange} className="bg-gray-100 p-2 rounded-lg text-sm w-full md:w-1/3"/>
                    <select name="status" value={filters.status} onChange={handleFilterChange} className="bg-gray-100 p-2 rounded-lg text-sm w-full md:w-auto"><option value="all">Все статусы</option><option>Оплачено</option><option>Ожидание</option><option>Отменено</option></select>
                    <select name="month" value={filters.month} onChange={handleFilterChange} className="bg-gray-100 p-2 rounded-lg text-sm w-full md:w-auto"><option value="all">Все месяцы</option>{Array.from({length:12}, (_,i)=><option key={i+1} value={i+1}>{new Date(0,i).toLocaleString('ru',{month:'long'})}</option>)}</select>
                    <select name="year" value={filters.year} onChange={handleFilterChange} className="bg-gray-100 p-2 rounded-lg text-sm w-full md:w-auto"><option value="all">Все годы</option>{availableYears.map(y=><option key={y} value={y}>{y}</option>)}</select>
                </div>
            </div>

            <div className="border-b border-gray-200">
                <nav className="flex space-x-2 -mb-px">
                    <button onClick={() => setActiveTab('РТИ')} className={`py-3 px-4 font-semibold text-sm rounded-t-lg ${activeTab === 'РТИ' ? 'text-blue-600 border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-900'}`}>
                        Направление: РТИ ({rtiProposals.length})
                    </button>
                    <button onClick={() => setActiveTab('3D')} className={`py-3 px-4 font-semibold text-sm rounded-t-lg ${activeTab === '3D' ? 'text-green-600 border-b-2 border-green-500' : 'text-slate-500 hover:text-slate-900'}`}>
                        Направление: 3D ({d3Proposals.length})
                    </button>
                </nav>
            </div>

            {activeTab === 'РТИ' && (
                <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-2">
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                             <span className="w-3 h-3 bg-blue-500 rounded-full"></span>РТИ
                        </h2>
                         <div className="flex space-x-2">
                            <button onClick={() => { setModalContext('РТИ'); setIsImportOpen(true); }} className="bg-white hover:bg-gray-100 text-slate-800 font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 border border-gray-300">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L11 8.586V3a1 1 0 10-2 0v5.586L8.707 7.293z" /><path d="M3 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /></svg>
                                <span>Импорт КП (РТИ)</span>
                            </button>
                             <button onClick={() => { setModalContext('РТИ'); setEditingProposal(null); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Добавить вручную</button>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-blue-50 p-3 rounded-lg"><p className="text-sm text-blue-800">Оплачено (РТИ)</p><p className="font-bold text-lg">{formatTenge(rtiSummary.paidAmount)}</p></div>
                        <div className="bg-yellow-50 p-3 rounded-lg"><p className="text-sm text-yellow-800">Ожидание (РТИ)</p><p className="font-bold text-lg">{formatTenge(rtiSummary.pendingAmount)}</p></div>
                        <div className="bg-gray-100 p-3 rounded-lg"><p className="text-sm text-gray-800">Конверсия (РТИ)</p><p className="font-bold text-lg">{rtiProposals.length > 0 ? ((rtiSummary.paidCount / rtiProposals.length) * 100).toFixed(1) : 0}%</p></div>
                    </div>
                    <ProposalTable proposals={paginatedRtiProposals} onEdit={handleEdit} onDelete={handleDelete} />
                    {rtiProposals.length > ITEMS_PER_PAGE && (
                        <PaginationControls currentPage={rtiCurrentPage} totalPages={rtiTotalPages} onPageChange={setRtiCurrentPage} />
                    )}
                </div>
            )}

            {activeTab === '3D' && (
                 <div className="bg-white p-4 rounded-xl shadow-lg flex flex-col">
                    <div className="flex flex-col md:flex-row justify-between md:items-center mb-4 gap-2">
                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-3 h-3 bg-green-500 rounded-full"></span>3D
                        </h2>
                        <div className="flex space-x-2">
                            <button onClick={() => { setModalContext('3D'); setIsImportOpen(true); }} className="bg-white hover:bg-gray-100 text-slate-800 font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 border border-gray-300">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M8.707 7.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l2-2a1 1 0 00-1.414-1.414L11 8.586V3a1 1 0 10-2 0v5.586L8.707 7.293z" /><path d="M3 12a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" /></svg>
                                <span>Импорт КП (3D)</span>
                            </button>
                             <button onClick={() => { setModalContext('3D'); setEditingProposal(null); setIsFormOpen(true); }} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Добавить вручную</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-green-50 p-3 rounded-lg"><p className="text-sm text-green-800">Оплачено (3D)</p><p className="font-bold text-lg">{formatTenge(d3Summary.paidAmount)}</p></div>
                        <div className="bg-yellow-50 p-3 rounded-lg"><p className="text-sm text-yellow-800">Ожидание (3D)</p><p className="font-bold text-lg">{formatTenge(d3Summary.pendingAmount)}</p></div>
                        <div className="bg-gray-100 p-3 rounded-lg"><p className="text-sm text-gray-800">Конверсия (3D)</p><p className="font-bold text-lg">{d3Proposals.length > 0 ? ((d3Summary.paidCount / d3Proposals.length) * 100).toFixed(1) : 0}%</p></div>
                    </div>
                    <ProposalTable proposals={paginatedD3Proposals} onEdit={handleEdit} onDelete={handleDelete} />
                    {d3Proposals.length > ITEMS_PER_PAGE && (
                        <PaginationControls currentPage={d3CurrentPage} totalPages={d3TotalPages} onPageChange={setD3CurrentPage} />
                    )}
                </div>
            )}
        </div>
    );
};

export default CommercialProposalsPage;
