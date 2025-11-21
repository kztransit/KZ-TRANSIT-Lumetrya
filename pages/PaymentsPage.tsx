import React, { useState, useMemo, useRef } from 'react';
import { Payment, StoredFile } from '../types';
import { fileToBase64 } from '../utils';
import { analyzePaymentInvoice } from '../services/geminiService';

interface PaymentsPageProps {
    payments: Payment[];
    files: StoredFile[];
    addPayment: (payment: Omit<Payment, 'id'>) => void;
    updatePayment: (payment: Payment) => void;
    deletePayment: (id: string) => void;
    addFile: (file: Omit<StoredFile, 'id'>) => Promise<StoredFile>;
}

const currencySymbols: Record<Payment['currency'], string> = {
    KZT: '₸',
    USD: '$',
    RUB: '₽',
};

const formatCurrency = (amount: number, currency: Payment['currency']) => {
    return `${currencySymbols[currency]}${new Intl.NumberFormat('ru-RU').format(amount)}`;
};

const PaymentFormModal: React.FC<{
    onClose: () => void;
    onSave: (payment: Omit<Payment, 'id'> | Payment) => void;
    initialData?: Partial<Payment> | null;
}> = ({ onClose, onSave, initialData }) => {
    
    const isEditing = !!initialData?.id;

    const [formData, setFormData] = useState<Omit<Payment, 'id'>>({
        serviceName: initialData?.serviceName || '',
        lastPaymentDate: initialData?.lastPaymentDate || new Date().toISOString().split('T')[0],
        nextPaymentDate: initialData?.nextPaymentDate || '',
        paymentPeriod: initialData?.paymentPeriod || 'monthly',
        amount: initialData?.amount || 0,
        currency: initialData?.currency || 'KZT',
        comment: initialData?.comment || '',
        paymentMethod: initialData?.paymentMethod || 'Карта',
        paymentDetails: initialData?.paymentDetails || '',
        invoiceId: initialData?.invoiceId || null,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const paymentToSave = { ...formData, amount: Number(formData.amount) };
        if (isEditing) {
            onSave({ ...paymentToSave, id: initialData.id! });
        } else {
            onSave(paymentToSave);
        }
        onClose();
    };

    return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b"><h2 className="text-xl font-bold">{isEditing ? 'Редактировать платеж' : 'Добавить платеж'}</h2></div>
            <div className="p-6 space-y-4 overflow-y-auto">
                 <div><label className="text-sm">Название сервиса*</label><input required name="serviceName" value={formData.serviceName} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg"/></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm">Сумма*</label><input required type="number" name="amount" value={formData.amount} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg"/></div>
                    <div><label className="text-sm">Валюта</label><select name="currency" value={formData.currency} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg"><option>KZT</option><option>USD</option><option>RUB</option></select></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm">Дата последнего платежа</label><input type="date" name="lastPaymentDate" value={formData.lastPaymentDate} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg"/></div>
                    <div><label className="text-sm">Дата следующего платежа*</label><input required type="date" name="nextPaymentDate" value={formData.nextPaymentDate} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg"/></div>
                 </div>
                 <div><label className="text-sm">Период оплаты</label><select name="paymentPeriod" value={formData.paymentPeriod} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg"><option value="monthly">Ежемесячно</option><option value="yearly">Ежегодно</option><option value="onetime">Единоразово</option></select></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-sm">Способ оплаты</label><select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg"><option>Карта</option><option>Безнал</option></select></div>
                    <div><label className="text-sm">Детали (карта, счет)</label><input name="paymentDetails" value={formData.paymentDetails} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg"/></div>
                 </div>
                 <div><label className="text-sm">Комментарий</label><textarea name="comment" value={formData.comment} onChange={handleChange} className="w-full mt-1 bg-gray-100 p-2 rounded-lg" rows={3}/></div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3"><button type="button" onClick={onClose} className="bg-gray-200 font-bold py-2 px-4 rounded-lg">Отмена</button><button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">Сохранить</button></div>
        </form>
    </div>
    )
};


const PaymentsPage: React.FC<PaymentsPageProps> = ({ payments, files, addPayment, updatePayment, deletePayment, addFile }) => {
    const [isFormOpen, setFormOpen] = useState(false);
    const [editingPayment, setEditingPayment] = useState<Payment | Partial<Payment> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const upcomingPayments = useMemo(() => {
        const now = new Date();
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        return payments
            .filter(p => {
                const nextPaymentDate = new Date(p.nextPaymentDate);
                return nextPaymentDate >= now && nextPaymentDate <= oneWeekFromNow;
            })
            .sort((a,b) => new Date(a.nextPaymentDate).getTime() - new Date(b.nextPaymentDate).getTime());
    }, [payments]);

    const summary = useMemo(() => {
        const monthlyTotal: Record<string, number> = { KZT: 0, USD: 0, RUB: 0 };
        
        payments.forEach(p => {
            if (p.paymentPeriod === 'monthly') {
                monthlyTotal[p.currency] += p.amount;
            } else if (p.paymentPeriod === 'yearly') {
                monthlyTotal[p.currency] += p.amount / 12;
            }
        });
        
        return {
            totalCount: payments.length,
            monthlyKZT: monthlyTotal.KZT,
            monthlyUSD: monthlyTotal.USD,
            monthlyRUB: monthlyTotal.RUB
        };
    }, [payments]);
    
    const handleAddClick = () => {
        setEditingPayment(null);
        setFormOpen(true);
    };

    const handleEditClick = (payment: Payment) => {
        setEditingPayment(payment);
        setFormOpen(true);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Вы уверены, что хотите удалить этот платеж?')) {
            deletePayment(id);
        }
    };
    
    // Эта функция вызывает addPayment из App.tsx, который уже подключен к Supabase
    const handleSave = (paymentData: Omit<Payment, 'id'> | Payment) => {
        if ('id' in paymentData) {
            updatePayment(paymentData);
        } else {
            addPayment(paymentData);
        }
    };
    
    const handleImportClick = () => {
        fileInputRef.current?.click();
    };
    
    const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setError('');
        try {
            const base64Data = await fileToBase64(file);
            const analyzedData = await analyzePaymentInvoice(file.type, base64Data);

            // addFile тоже подключен к Supabase в App.tsx
            const newFile = await addFile({
                name: file.name,
                type: file.type,
                size: file.size,
                content: base64Data,
                date: new Date().toISOString()
            });

            const nextPaymentDate = new Date(analyzedData.lastPaymentDate || Date.now());
            if (analyzedData.paymentPeriod === 'monthly') {
                nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
            } else if (analyzedData.paymentPeriod === 'yearly') {
                nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
            }

            setEditingPayment({
                ...analyzedData,
                nextPaymentDate: nextPaymentDate.toISOString().split('T')[0],
                invoiceId: newFile.id
            });
            setFormOpen(true);

        } catch(err) {
            setError(err instanceof Error ? err.message : 'Не удалось проанализировать файл.');
        } finally {
            setIsLoading(false);
            e.target.value = ''; // Reset file input
        }
    };

    return (
        <div className="space-y-6">
            {isFormOpen && <PaymentFormModal onClose={() => setFormOpen(false)} onSave={handleSave} initialData={editingPayment}/>}

            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Управление платежами</h1>
                    <p className="text-slate-500 mt-1">Отслеживание подписок и регулярных оплат</p>
                </div>
                 <div className="flex space-x-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileImport} className="hidden" accept="image/*,application/pdf" />
                    <button onClick={handleImportClick} disabled={isLoading} className="bg-white hover:bg-gray-100 text-slate-800 font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 border border-gray-300 disabled:opacity-50">
                        {isLoading ? 'Анализ...' : 'Добавить из инвойса'}
                    </button>
                    <button onClick={handleAddClick} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm">+ Добавить вручную</button>
                </div>
            </div>
            {error && <p className="text-red-500 text-sm text-center bg-red-100 p-2 rounded-lg">{error}</p>}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                 <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Всего подписок</p><p className="text-2xl font-bold text-slate-900">{summary.totalCount}</p></div>
                 <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Расходы в месяц (KZT)</p><p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.monthlyKZT, 'KZT')}</p></div>
                 <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Расходы в месяц (USD)</p><p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.monthlyUSD, 'USD')}</p></div>
                 <div className="bg-white p-4 rounded-xl shadow-md"><p className="text-sm text-slate-500">Расходы в месяц (RUB)</p><p className="text-2xl font-bold text-slate-900">{formatCurrency(summary.monthlyRUB, 'RUB')}</p></div>
            </div>

            {upcomingPayments.length > 0 && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-r-lg">
                    <h3 className="text-lg font-bold text-yellow-800 mb-2">🔥 Предстоящие платежи (7 дней)</h3>
                     <div className="space-y-2">
                        {upcomingPayments.map(p => (
                             <div key={p.id} className="bg-white/70 p-2 rounded-md flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-sm">{p.serviceName}</p>
                                    <p className="text-xs text-slate-500">{new Date(p.nextPaymentDate).toLocaleDateString()}</p>
                                </div>
                                <p className="font-bold text-sm">{formatCurrency(p.amount, p.currency)}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="bg-white p-4 rounded-xl shadow-lg">
                <h2 className="text-xl font-bold mb-4">Все платежи</h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-600">
                        <thead className="text-xs text-slate-500 uppercase bg-gray-50">
                            <tr>
                                {['Сервис', 'След. платеж', 'Сумма', 'Период', 'Способ оплаты', ''].map(h => <th key={h} className="px-4 py-3">{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {payments.map(p => (
                                <tr key={p.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-slate-900">{p.serviceName}<p className="text-xs font-normal text-slate-500">{p.comment}</p></td>
                                    <td className="px-4 py-3">{new Date(p.nextPaymentDate).toLocaleDateString()}</td>
                                    <td className="px-4 py-3 font-semibold">{formatCurrency(p.amount, p.currency)}</td>
                                    <td className="px-4 py-3">{p.paymentPeriod === 'monthly' ? 'Месяц' : p.paymentPeriod === 'yearly' ? 'Год' : 'Разово'}</td>
                                    <td className="px-4 py-3">{p.paymentMethod}<p className="text-xs text-slate-500">{p.paymentDetails}</p></td>
                                    <td className="px-4 py-3 flex space-x-3">
                                        <button onClick={() => handleEditClick(p)} className="text-slate-400 hover:text-cyan-500">✏️</button>
                                        <button onClick={() => handleDelete(p.id)} className="text-slate-400 hover:text-red-500">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                             {payments.length === 0 && (
                                <tr><td colSpan={6} className="text-center py-10 text-slate-500">Нет сохраненных платежей.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default PaymentsPage;
