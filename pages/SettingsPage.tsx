import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { UserData, CompanyProfile, Employee, CompanyDetails, CompanyContacts } from '../types';

interface SettingsPageProps {
    fullUserData: UserData;
    setAllUserData: (data: UserData) => void;
    setCompanyProfile: (profile: CompanyProfile) => void;
}

const SettingsPage: React.FC<SettingsPageProps> = ({ fullUserData, setAllUserData, setCompanyProfile }) => {
    // Инициализируем состояние один раз при загрузке компонента
    const [profile, setProfile] = useState<CompanyProfile>(fullUserData.companyProfile);
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const importFileInputRef = useRef<HTMLInputElement>(null);

    // УБРАН useEffect, который перезаписывал состояние при каждом чихе родителя
    // Это решит проблему с вводом по одной букве.

    const handleDetailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({...prev, details: {...prev.details, [name]: value}}));
    };
    
    const handleContactChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({...prev, contacts: {...prev.contacts, [name]: value}}));
    };

    const handleGenericChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleListChange = (listName: 'websites' | 'socialMedia', index: number, value: string) => {
        setProfile(prev => {
            const newList = [...prev[listName]];
            newList[index] = value;
            return { ...prev, [listName]: newList };
        });
    };

    const handleAddListItem = (listName: 'websites' | 'socialMedia') => {
        setProfile(prev => ({...prev, [listName]: [...prev[listName], '']}));
    };

    const handleRemoveListItem = (listName: 'websites' | 'socialMedia', index: number) => {
        setProfile(prev => ({...prev, [listName]: prev[listName].filter((_, i) => i !== index)}));
    };
    
    const handleEmployeeChange = (id: string, field: 'name' | 'position', value: string) => {
        setProfile(prev => ({
            ...prev,
            employees: prev.employees.map(emp => emp.id === id ? { ...emp, [field]: value } : emp)
        }));
    };

    const handleAddEmployee = () => {
        setProfile(prev => ({
            ...prev,
            employees: [...prev.employees, { id: uuidv4(), name: '', position: '' }]
        }));
    };

    const handleRemoveEmployee = (id: string) => {
        setProfile(prev => ({
            ...prev,
            employees: prev.employees.filter(emp => emp.id !== id)
        }));
    };

    const handleSaveProfile = () => {
        setStatus('saving');
        setCompanyProfile(profile); // Отправляем данные в глобальный стейт только по кнопке
        setTimeout(() => {
            setStatus('saved');
            setTimeout(() => setStatus('idle'), 2000);
        }, 500);
    };

    const triggerImportInput = () => {
        importFileInputRef.current?.click();
    };

    const handleExport = () => {
        const dataStr = JSON.stringify(fullUserData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `lumetrya_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleFileImportChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const data = JSON.parse(text);
                if (window.confirm('Вы уверены? Импорт заменит все текущие данные в приложении.')) {
                    setAllUserData(data as UserData);
                    // После импорта обновляем и локальный профиль
                    if (data.companyProfile) {
                        setProfile(data.companyProfile);
                    }
                    alert('Импорт завершен. Данные обновлены.');
                }
            } catch (error) {
                alert(`Ошибка при импорте: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
            }
        };
        reader.readAsText(file);
        // Сбрасываем value инпута, чтобы можно было выбрать тот же файл снова
        event.target.value = '';
    };

    const DetailInput: React.FC<{name: keyof CompanyDetails, label: string}> = ({name, label}) => (
        <div>
            <label className="text-sm font-medium text-slate-600">{label}</label>
            <input 
                name={name} 
                value={profile.details[name] || ''} 
                onChange={handleDetailChange} 
                className="w-full mt-1 bg-gray-50 p-2 rounded-lg border focus:border-cyan-500"
            />
        </div>
    );
    
    const ContactInput: React.FC<{name: keyof CompanyContacts, label: string}> = ({name, label}) => (
        <div>
            <label className="text-sm font-medium text-slate-600">{label}</label>
            <input 
                name={name} 
                value={profile.contacts[name] || ''} 
                onChange={handleContactChange} 
                className="w-full mt-1 bg-gray-50 p-2 rounded-lg border focus:border-cyan-500"
            />
        </div>
    );
    
    const ListInput: React.FC<{listName: 'websites' | 'socialMedia', label: string}> = ({listName, label}) => (
        <div className="space-y-2">
            <h4 className="font-semibold">{label}</h4>
            {profile[listName].map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    <input value={item} onChange={(e) => handleListChange(listName, index, e.target.value)} className="w-full bg-gray-50 p-2 rounded-lg border"/>
                    <button onClick={() => handleRemoveListItem(listName, index)} className="text-red-500 p-1">✕</button>
                </div>
            ))}
            <button onClick={() => handleAddListItem(listName)} className="text-sm text-cyan-600 font-semibold">+ Добавить</button>
        </div>
    );

    return (
        <div className="space-y-6 pb-10">
            <h1 className="text-4xl font-bold text-slate-900">Настройки и профиль компании</h1>
            
            <div className="bg-white rounded-xl shadow-lg">
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold">Профиль компании</h2>
                     <button onClick={handleSaveProfile} disabled={status !== 'idle'} className={`text-white font-bold py-2 px-6 rounded-lg text-sm disabled:bg-slate-400 ${status === 'saved' ? 'bg-green-600' : 'bg-cyan-600 hover:bg-cyan-700'}`}>
                        {status === 'saving' ? 'Сохранение...' : status === 'saved' ? '✓ Сохранено!' : 'Сохранить профиль'}
                    </button>
                </div>
                <div className="p-6 space-y-8">
                    <div>
                        <label className="text-lg font-semibold text-slate-600">Название компании</label>
                         <p className="text-sm text-slate-500 mb-2">Это название будет отображаться в боковой панели.</p>
                        <input 
                            name="companyName" 
                            value={profile.companyName} 
                            onChange={handleGenericChange} 
                            className="w-full mt-1 bg-gray-50 p-2 rounded-lg border focus:border-cyan-500" 
                            placeholder="Название вашей компании"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border"><h3 className="font-semibold text-lg">Реквизиты</h3>
                            <DetailInput name="legalName" label="Юридическое название"/>
                            <DetailInput name="tin" label="ИНН"/>
                            <DetailInput name="kpp" label="КПП"/>
                            <DetailInput name="ogrn" label="ОГРН"/>
                            <DetailInput name="legalAddress" label="Юридический адрес"/>
                        </div>
                         <div className="space-y-4 p-4 bg-gray-50 rounded-lg border"><h3 className="font-semibold text-lg">Банковские реквизиты</h3>
                            <DetailInput name="bankName" label="Название банка"/>
                            <DetailInput name="bic" label="БИК"/>
                            <DetailInput name="correspondentAccount" label="Корр. счет"/>
                            <DetailInput name="checkingAccount" label="Расчетный счет"/>
                        </div>
                    </div>
                     <div className="space-y-4 p-4 bg-gray-50 rounded-lg border"><h3 className="font-semibold text-lg">Контакты</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <ContactInput name="phone" label="Телефон"/>
                            <ContactInput name="email" label="Email"/>
                            <ContactInput name="address" label="Фактический адрес"/>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                           <ListInput listName="websites" label="Сайты"/>
                        </div>
                        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                           <ListInput listName="socialMedia" label="Социальные сети"/>
                        </div>
                    </div>
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg border"><h3 className="font-semibold text-lg">Сотрудники</h3>
                        {profile.employees.map((emp, index) => (
                             <div key={emp.id} className="flex items-center gap-2">
                                <input value={emp.name} onChange={(e) => handleEmployeeChange(emp.id, 'name', e.target.value)} placeholder="Имя" className="w-full bg-white p-2 rounded-lg border"/>
                                <input value={emp.position} onChange={(e) => handleEmployeeChange(emp.id, 'position', e.target.value)} placeholder="Должность" className="w-full bg-white p-2 rounded-lg border"/>
                                <button onClick={() => handleRemoveEmployee(emp.id)} className="text-red-500 p-1">✕</button>
                            </div>
                        ))}
                        <button onClick={handleAddEmployee} className="text-sm text-cyan-600 font-semibold">+ Добавить сотрудника</button>
                    </div>
                    <div><label className="text-lg font-semibold text-slate-600">О компании</label><textarea name="about" value={profile.about} onChange={handleGenericChange} rows={5} className="w-full mt-1 bg-gray-50 p-2 rounded-lg border focus:border-cyan-500" placeholder="Краткое описание деятельности, миссия..."></textarea></div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg">
                 <div className="p-6 border-b"><h2 className="text-xl font-bold">Настройки AI ассистента</h2></div>
                 <div className="p-6 space-y-8">
                    <div>
                        <label className="text-lg font-semibold text-slate-600">Системная инструкция (промпт)</label>
                        <p className="text-sm text-slate-500 mb-2">Это главный промпт, который определяет поведение Lumi. Отредактируйте его, чтобы адаптировать ассистента под ваши задачи.</p>
                        <textarea name="aiSystemInstruction" value={profile.aiSystemInstruction} onChange={handleGenericChange} rows={15} className="w-full mt-1 bg-gray-50 p-2 rounded-lg border focus:border-cyan-500 font-mono text-sm"></textarea>
                    </div>
                 </div>
            </div>

             <div className="bg-white rounded-xl shadow-lg">
                 <div className="p-6 border-b"><h2 className="text-xl font-bold">Управление данными</h2></div>
                 <div className="p-6 space-y-6">
                    <div>
                         <h3 className="text-lg font-semibold text-slate-800 mb-2">Резервное копирование</h3>
                         <p className="text-sm text-slate-500 mb-4">Сохраняйте или загружайте полную копию всех данных приложения.</p>
                         <div className="flex flex-col sm:flex-row gap-3">
                            <button onClick={handleExport} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center justify-center gap-2">Экспорт данных (JSON)</button>
                            <input type="file" ref={importFileInputRef} onChange={handleFileImportChange} className="hidden" accept="application/json" />
                            <button onClick={triggerImportInput} className="w-full bg-gray-100 hover:bg-gray-200 text-slate-800 font-bold py-2 px-4 rounded-lg text-sm border">Импорт данных (JSON)</button>
                        </div>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default SettingsPage;
