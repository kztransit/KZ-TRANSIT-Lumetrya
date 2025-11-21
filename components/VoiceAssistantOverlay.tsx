import React from 'react';

interface VoiceAssistantOverlayProps {
    status: 'idle' | 'greeting' | 'listening' | 'speaking';
    userTranscript: string;
    aiTranscript: string;
    onClose: () => void;
}

const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({ status, userTranscript, aiTranscript, onClose }) => {
    
    const getStatusIndicator = () => {
        switch (status) {
            case 'greeting':
                 return (
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                        </svg>
                        <span>Приветствие...</span>
                    </div>
                );
            case 'listening':
                return (
                    <div className="flex items-center gap-2 text-blue-500">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                        <span>Слушаю...</span>
                    </div>
                );
            case 'speaking':
                return (
                    <div className="flex items-center gap-2 text-green-500">
                       <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                       </svg>
                        <span>Говорю...</span>
                    </div>
                );
             default:
                return null;
        }
    };

    return (
        <div className="fixed bottom-4 right-4 w-full max-w-sm z-50 animate-fade-in-up">
            <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.3s ease-out; }
            `}</style>
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                <div className="p-3 border-b dark:border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900 dark:to-slate-800 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                            </svg>
                        </div>
                        <div className="text-sm">
                            <span className="font-bold text-slate-800 dark:text-slate-200">Lumi</span>
                            {getStatusIndicator()}
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 text-2xl p-1 rounded-full">&times;</button>
                </div>
                <div className="p-4 space-y-2 max-h-60 overflow-y-auto text-sm">
                    {userTranscript && (
                        <div className="text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">Вы:</span> {userTranscript}
                        </div>
                    )}
                     {aiTranscript && (
                         <div className="text-slate-800 dark:text-slate-100">
                            <span className="font-semibold">Lumi:</span> {aiTranscript}
                        </div>
                    )}
                     {!userTranscript && !aiTranscript && status === 'listening' && (
                        <p className="text-slate-400 italic">Скажите "Люми" и задайте ваш вопрос...</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default VoiceAssistantOverlay;