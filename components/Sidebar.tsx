

import React, { useState, useRef, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { CompanyProfile } from '../types';
import Logo from './Logo';

const navItems = [
    { to: "/dashboard", label: "Общий отчет", icon: <><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0 0 13.5 3v7.5Z" /></> },
    { to: "/reports", label: "Отчеты", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /> },
    { to: "/other-reports", label: "Другие отчеты", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" /> },
    { to: "/proposals", label: "КП", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 0 0-3.7-3.7 48.678 48.678 0 0 0-7.324 0 4.006 4.006 0 0 0-3.7 3.7c-.092 1.21-.138 2.43-.138 3.662a4.006 4.006 0 0 0 3.7 3.7 48.656 48.656 0 0 0 7.324 0 4.006 4.006 0 0 0 3.7-3.7Zm-1.5 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z" /> },
    { to: "/compare", label: "Сравнить периоды", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /> },
    { to: "/conversions", label: "Конверсии", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0 0 12 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52v16.5m-13.5-16.5v16.5m13.5 0c.351.21.701.43 1.05.67m-12 0c.351.21.701.43 1.05.67m6.75-1.282A35.846 35.846 0 0 1 12 20.25a35.846 35.846 0 0 1-6.75-1.282" /> },
    { to: "/net-conversions", label: "Чистые конверсии", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.667 0l3.181-3.183m-4.991-2.492v4.992" /> },
    { to: "/campaigns", label: "Рекламные кампании", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0 0 20.25 18V6A2.25 2.25 0 0 0 18 3.75H6A2.25 2.25 0 0 0 3.75 6v12A2.25 2.25 0 0 0 6 20.25Z" /> },
    { to: "/unit-economics", label: "Юнит экономика", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125-1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /> },
    { to: "/payments", label: "Управление платежами", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15A2.25 2.25 0 0 0 2.25 6.75v10.5A2.25 2.25 0 0 0 4.5 19.5Z" /> },
    { to: "/storage", label: "Облачное хранилище", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" /> },
    { to: "/settings", label: "Настройки и профиль", icon: <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-1.007 1.11-1.226M10.343 3.94a3.75 3.75 0 0 1-1.04-2.288M9 3.75a3.75 3.75 0 0 0-1.04 2.288M9 3.75c-.344.026-.68.096-1.006.205M16.5 3.75c.344.026.68.096 1.006.205M16.5 3.75a3.75 3.75 0 0 0 1.04-2.288M17.557 3.94c.55.219 1.02.684 1.11 1.226M17.557 3.94a3.75 3.75 0 0 1 1.04 2.288M18 9.75a3.75 3.75 0 0 0-1.04-2.288M18 9.75c-.344.026-.68.096-1.006.205M13.5 9.75c.344.026.68.096 1.006.205M13.5 9.75a3.75 3.75 0 0 0 1.04-2.288M12.443 9.54c.55.219 1.02.684 1.11 1.226M12.443 9.54a3.75 3.75 0 0 1 1.04 2.288M13.5 15.75a3.75 3.75 0 0 0 1.04 2.288M13.5 15.75c.344.026.68.096 1.006.205M10.343 15.94c.55.219 1.02.684 1.11 1.226M10.343 15.94a3.75 3.75 0 0 1-1.04 2.288M9 15.75a3.75 3.75 0 0 0-1.04 2.288M9 15.75c-.344.026-.68.096-1.006.205M4.5 15.75a3.75 3.75 0 0 1-1.04-2.288M4.5 15.75c.344.026.68.096 1.006.205M6.443 15.54c.55.219 1.02.684 1.11 1.226M6.443 15.54a3.75 3.75 0 0 0 1.04 2.288M5.25 9.75a3.75 3.75 0 0 1-1.04-2.288M5.25 9.75c.344.026.68.096 1.006.205M7.657 9.54c.55.219 1.02.684 1.11 1.226M7.657 9.54a3.75 3.75 0 0 0 1.04 2.288M12 3.75a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008a.75.75 0 0 1 .75-.75h.008Zm0 6a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008a.75.75 0 0 1 .75-.75h.008Zm0 6a.75.75 0 0 1 .75.75v.008a.75.75 0 0 1-.75.75h-.008a.75.75 0 0 1-.75-.75v-.008a.75.75 0 0 1 .75-.75h.008Z" /> },
];

interface SidebarProps {
    isOpen: boolean;
    setOpen: (isOpen: boolean) => void;
    companyProfile: CompanyProfile;
    setCompanyProfile: (profile: CompanyProfile) => void;
    onLogout: () => void;
    isVoiceControlActive: boolean;
    onToggleVoiceControl: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, setOpen, companyProfile, setCompanyProfile, onLogout, isVoiceControlActive, onToggleVoiceControl }) => {
    
    const NavItem: React.FC<{ to: string, label: string, icon: React.ReactNode, indicator?: boolean, disabled?: boolean }> = ({ to, label, icon, indicator, disabled }) => {
        const baseClasses = 'flex items-center p-2 rounded-lg transition-colors duration-200';
        const activeClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold';
        const inactiveClasses = 'text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100';
        const disabledClasses = 'text-slate-400 dark:text-slate-500 cursor-not-allowed';

        if (disabled) {
            return (
                <li className={`${baseClasses} ${disabledClasses}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">{icon}</svg>
                    <span className="text-sm font-medium">{label}</span>
                </li>
            );
        }
        
        return (
            <li>
                <NavLink
                    to={to}
                    onClick={() => !isOpen && setOpen(false)}
                    className={({ isActive }) => `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">{icon}</svg>
                    <span className="text-sm font-medium flex-1">{label}</span>
                    {indicator && <div className="w-2 h-2 bg-blue-500 rounded-full"></div>}
                </NavLink>
            </li>
        );
    }
    
    const baseClasses = 'flex items-center p-2 rounded-lg transition-colors duration-200';
    const activeClasses = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold';
    const inactiveClasses = 'text-slate-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100';

    return (
       <>
        <div className={`fixed inset-0 bg-black/60 z-30 transition-opacity lg:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setOpen(false)}></div>
        <aside className={`bg-white dark:bg-black w-64 min-w-[16rem] space-y-6 py-6 px-2 fixed inset-y-0 left-0 transform ${isOpen ? "translate-x-0" : "-translate-x-full"} lg:relative lg:translate-x-0 transition-transform duration-200 ease-in-out z-40 flex flex-col border-r border-gray-200 dark:border-slate-700`}>
            <div className="px-4 h-[36px] flex items-center pt-4">
                <NavLink to="/dashboard" aria-label="Lumetrya Home">
                   <Logo className="h-9 w-auto" />
                </NavLink>
            </div>

            <nav className="flex-grow px-2 overflow-y-auto">
                <ul className="space-y-1.5">
                     <li>
                        <NavLink
                            to="/ai-assistant"
                            className={({ isActive }) => `${baseClasses} ${isActive ? activeClasses : inactiveClasses}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />
                            </svg>
                            <span className="text-sm font-medium flex-1 text-left">AI помощник</span>
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        </NavLink>
                    </li>
                    {navItems.map(item => <NavItem key={item.to + item.label} {...item} />)}
                </ul>
            </nav>

            <div className="px-4 pt-4 border-t border-gray-200 dark:border-slate-700">
                <div title="Голосовой AI ассистент" className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Голосовой AI</span>
                    <button
                        onClick={onToggleVoiceControl}
                        aria-label="Toggle voice control"
                        role="switch"
                        aria-checked={isVoiceControlActive}
                        className={`relative inline-flex items-center h-8 w-14 rounded-full transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-slate-900 ${isVoiceControlActive ? 'bg-blue-600' : 'bg-gray-300 dark:bg-slate-600'}`}
                    >
                        <span
                            className={`inline-block w-6 h-6 transform bg-white rounded-full transition-transform duration-300 ease-in-out flex items-center justify-center shadow-md ${isVoiceControlActive ? 'translate-x-7' : 'translate-x-1'}`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 transition-all duration-300" viewBox="0 0 24 24">
                                <defs>
                                    <linearGradient id="sparkle-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" style={{stopColor:'#818cf8', stopOpacity:1}} />
                                        <stop offset="50%" style={{stopColor:'#c084fc', stopOpacity:1}} />
                                        <stop offset="100%" style={{stopColor:'#f472b6', stopOpacity:1}} />
                                    </linearGradient>
                                </defs>
                                <g fill={isVoiceControlActive ? "url(#sparkle-gradient)" : "#9ca3af" /* gray-400 */}>
                                    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                    <path d="M18.258 8.715L18 9.75l-.258-1.035a3.375 3.375 0 00-2.456-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.456-2.456L18 2.25l.258 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                                </g>
                            </svg>
                        </span>
                    </button>
                </div>
            </div>

            <div className="p-2 mt-auto border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2">
                <NavLink 
                    to="/settings" 
                    className="flex-grow p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors group"
                    aria-label="Перейти в профиль компании"
                >
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{companyProfile.companyName}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Профиль компании</p>
                </NavLink>
                <button 
                    onClick={onLogout} 
                    className="flex-shrink-0 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-500 p-2 rounded-lg transition-colors"
                    title="Выход"
                    aria-label="Выйти из системы"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                    </svg>
                </button>
            </div>
        </aside>
       </>
    );
};

export default Sidebar;