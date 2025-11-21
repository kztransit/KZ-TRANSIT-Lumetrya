import React from 'react';

interface LogoProps {
    className?: string;
}

const Logo: React.FC<LogoProps> = ({ className }) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 32" className={className} aria-label="Lumetrya Logo">
            <g transform="translate(0, 2)">
                <circle cx="14" cy="14" r="14" fill="#2563eb" opacity="0.9" />
                <circle cx="26" cy="14" r="14" fill="#16a34a" opacity="0.9" />
            </g>
            <text x="48" y="24" fontFamily="sans-serif" fontSize="24" fontWeight="600" className="fill-slate-800 dark:fill-slate-200 transition-colors">
                Lumetrya
            </text>
        </svg>
    );
};

export default Logo;