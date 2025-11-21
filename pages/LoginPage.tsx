

import React, { useState } from 'react';
import Logo from '../components/Logo';

interface LoginPageProps {
    onLogin: (email: string, pass: string, rememberMe: boolean) => boolean;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const [email, setEmail] = useState('kztransit');
    const [password, setPassword] = useState('Neoprenez2');
    const [rememberMe, setRememberMe] = useState(true);
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const success = onLogin(email, password, rememberMe);
        if (!success) {
            setError('Неверный логин или пароль.');
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <Logo className="mx-auto h-14 w-auto" />
                    <p className="text-slate-500 mt-4">Ваша комплексная аналитическая платформа</p>
                </div>

                <div className="bg-white rounded-2xl shadow-2xl p-8">
                    <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Вход в систему</h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-slate-600">Логин</label>
                            <input
                                type="text"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 mt-1 bg-gray-100 rounded-lg border focus:border-blue-500 focus:ring-blue-500 transition"
                                placeholder="Введите ваш логин"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium text-slate-600">Пароль</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 mt-1 bg-gray-100 rounded-lg border focus:border-blue-500 focus:ring-blue-500 transition"
                                placeholder="Введите ваш пароль"
                            />
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="flex items-center text-sm text-slate-600 select-none cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="ml-2">Запомнить меня</span>
                            </label>
                        </div>
                        
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <button
                            type="submit"
                            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-transform transform hover:scale-105"
                        >
                            Войти
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;