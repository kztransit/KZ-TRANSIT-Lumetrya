import React from 'react';

interface HeaderProps {
    onLogout: () => void;
    toggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ onLogout, toggleSidebar }) => {
    return (
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 p-3 flex justify-between items-center z-20 sticky top-0">
            <div className="flex items-center">
                <button onClick={toggleSidebar} className="text-gray-500 hover:text-gray-900 lg:hidden mr-3 p-1 rounded-md hover:bg-gray-200">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>
            <div className="flex items-center space-x-2 sm:space-x-4">
                <button onClick={onLogout} className="text-gray-500 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-200" title="Выйти">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
        </header>
    );
};

export default Header;