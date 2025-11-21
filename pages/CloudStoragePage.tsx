import React, { useState, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Link, StoredFile } from '../types';
import { fileToBase64 } from '../utils';

// Modal component for adding a new link
const AddLinkModal: React.FC<{
    onClose: () => void;
    onSave: (url: string, comment: string) => void;
}> = ({ onClose, onSave }) => {
    const [url, setUrl] = useState('');
    const [comment, setComment] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim()) {
            setError('URL не может быть пустым');
            return;
        }
        try {
            // Basic URL validation
            new URL(url);
        } catch (_) {
            setError('Пожалуйста, введите корректный URL');
            return;
        }
        onSave(url, comment);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b">
                        <h2 className="text-xl font-bold">Добавить ссылку</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="text-sm text-slate-500 block mb-1">URL ссылки *</label>
                            <input
                                type="url"
                                value={url}
                                onChange={e => { setUrl(e.target.value); setError(''); }}
                                className="w-full bg-gray-100 p-2 rounded-lg"
                                placeholder="https://example.com"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm text-slate-500 block mb-1">Комментарий</label>
                            <input
                                type="text"
                                value={comment}
                                onChange={e => setComment(e.target.value)}
                                className="w-full bg-gray-100 p-2 rounded-lg"
                                placeholder="Краткое описание ссылки"
                            />
                        </div>
                        {error && <p className="text-red-500 text-sm">{error}</p>}
                    </div>
                    <div className="p-6 border-t flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 font-bold py-2 px-4 rounded-lg">Отмена</button>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Сохранить</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EmptyState = () => (
    <div className="text-center py-20">
         <div className="mx-auto w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4 border-4 border-white">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}><path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
        </div>
        <p className="text-slate-500">Пока нет файлов и ссылок</p>
    </div>
);

interface CloudStoragePageProps {
    links: Link[];
    files: StoredFile[];
    addLink: (link: Omit<Link, 'id'>) => void;
    deleteLink: (id: string) => void;
    addFile: (file: Omit<StoredFile, 'id'>) => void;
    deleteFile: (id: string) => void;
}

const CloudStoragePage: React.FC<CloudStoragePageProps> = ({ links, files, addLink, deleteLink, addFile, deleteFile }) => {
    const [activeTab, setActiveTab] = useState<'all' | 'files' | 'links'>('all');
    const [isAddLinkModalOpen, setAddLinkModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            // FIX: Iterate directly over the FileList. `Array.from` can cause type inference issues.
            // Fix: Changed `Array.from(event.target.files)` to `event.target.files` to ensure correct type inference for the `file` object.
            for (let i = 0; i < event.target.files.length; i++) {
                const file = event.target.files[i];
                if (file) {
                    try {
                        const content = await fileToBase64(file);
                        const newFile: Omit<StoredFile, 'id'> = {
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            content: content,
                            date: new Date().toISOString(),
                        };
                        addFile(newFile);
                    } catch (error) {
                        console.error("Error processing file:", error);
                        alert(`Не удалось обработать файл ${file.name}.`);
                    }
                }
            }
        }
    };
    
    const triggerFileInput = () => {
        fileInputRef.current?.click();
    }

    const handleDeleteFile = (id: string, name: string) => {
        if (window.confirm(`Вы уверены, что хотите удалить файл "${name}"?`)) {
            deleteFile(id);
        }
    };

    const handleAddLink = (url: string, comment: string) => {
        const newLink: Omit<Link, 'id'> = {
            url,
            comment,
            date: new Date().toISOString()
        };
        addLink(newLink);
        setAddLinkModalOpen(false);
    };

    const handleDeleteLink = (id: string) => {
        if (window.confirm('Вы уверены, что хотите удалить эту ссылку?')) {
            deleteLink(id);
        }
    };

    const visibleFiles = (activeTab === 'all' || activeTab === 'files') && files.length > 0;
    const visibleLinks = (activeTab === 'all' || activeTab === 'links') && links.length > 0;

    return (
        <div>
            {isAddLinkModalOpen && <AddLinkModal onClose={() => setAddLinkModalOpen(false)} onSave={handleAddLink} />}
            <div className="flex flex-col md:flex-row justify-between md:items-center mb-6 gap-4">
                 <div>
                    <h1 className="text-3xl font-bold text-slate-900">Облачное хранилище</h1>
                    <p className="text-slate-500 mt-1">Загружайте файлы и сохраняйте ссылки</p>
                </div>
                <div className="flex space-x-2">
                    <button onClick={() => setAddLinkModalOpen(true)} className="bg-white hover:bg-gray-100 text-slate-800 font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 border border-gray-300">
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0l-1.5-1.5a2 2 0 112.828-2.828l1.5 1.5 3-3a2 2 0 010 2.828l-3 3a2 2 0 11-2.828-2.828v-.001z" clipRule="evenodd" /></svg>
                        <span>Добавить ссылку</span>
                    </button>
                    <input type="file" multiple ref={fileInputRef} onChange={handleFileChange} className="hidden" />
                    <button onClick={triggerFileInput} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.414l-1.293 1.293a1 1 0 01-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L13 9.414V13H5.5z" /><path d="M9 13h2v5a1 1 0 11-2 0v-5z" /></svg>
                        <span>Загрузить файл</span>
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg mb-6">
                <div className="border-b border-gray-200 px-4">
                    <nav className="flex space-x-2">
                        <button onClick={() => setActiveTab('all')} className={`py-3 px-4 font-semibold text-sm ${activeTab === 'all' ? 'text-cyan-600 border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-900'}`}>Все ({files.length + links.length})</button>
                        <button onClick={() => setActiveTab('files')} className={`py-3 px-4 font-semibold text-sm ${activeTab === 'files' ? 'text-cyan-600 border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-900'}`}>Файлы ({files.length})</button>
                        <button onClick={() => setActiveTab('links')} className={`py-3 px-4 font-semibold text-sm ${activeTab === 'links' ? 'text-cyan-600 border-b-2 border-cyan-500' : 'text-slate-500 hover:text-slate-900'}`}>Ссылки ({links.length})</button>
                    </nav>
                </div>

                {!visibleFiles && !visibleLinks ? <EmptyState /> : (
                    <div className="p-4 space-y-6">
                        {visibleFiles && (
                             <div>
                                <h3 className="text-lg font-semibold mb-2 text-slate-800">Файлы</h3>
                                <div className="overflow-x-auto">
                                     <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-slate-500">
                                                <th className="p-2 font-medium">Имя файла</th>
                                                <th className="p-2 font-medium">Размер</th>
                                                <th className="p-2 font-medium">Дата загрузки</th>
                                                <th className="p-2 font-medium"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {files.map((file) => (
                                                <tr key={file.id} className="border-b border-gray-200 hover:bg-gray-50">
                                                    <td className="p-2 font-medium text-slate-800">{file.name}</td>
                                                    <td className="p-2">{(file.size / 1024).toFixed(2)} KB</td>
                                                    <td className="p-2">{new Date(file.date).toLocaleDateString()}</td>
                                                    <td className="p-2 text-right"><button onClick={() => handleDeleteFile(file.id, file.name)} className="text-red-500 hover:text-red-700">Удалить</button></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                     </table>
                                 </div>
                             </div>
                        )}
                        {visibleLinks && (
                             <div>
                                <h3 className="text-lg font-semibold mb-2 text-slate-800">Ссылки</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left text-slate-500">
                                                <th className="p-2 font-medium">Ссылка</th>
                                                <th className="p-2 font-medium">Комментарий</th>
                                                <th className="p-2 font-medium">Дата добавления</th>
                                                <th className="p-2 font-medium"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {links.map((link) => (
                                                <tr key={link.id} className="border-b border-gray-200 hover:bg-gray-50">
                                                    <td className="p-2 font-medium text-slate-800 max-w-xs truncate">
                                                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">
                                                            {link.url}
                                                        </a>
                                                    </td>
                                                    <td className="p-2">{link.comment}</td>
                                                    <td className="p-2">{new Date(link.date).toLocaleDateString()}</td>
                                                    <td className="p-2 text-right">
                                                        <button onClick={() => handleDeleteLink(link.id)} className="text-red-500 hover:text-red-700">
                                                            Удалить
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                 </div>
                             </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CloudStoragePage;