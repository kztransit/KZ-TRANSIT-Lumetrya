import React from 'react';

interface DashboardCardProps {
    title: string;
    value: string;
    tag?: string;
    tagColor?: string;
    icon?: React.ReactNode;
    className?: string;
    sparklineData?: { value: number }[];
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, value, tag, tagColor, className }) => {
    return (
        <div className={`p-5 rounded-2xl shadow-lg relative overflow-hidden ${className}`}>
            <div className="relative z-10">
                 <div className="flex justify-between items-center">
                    <p className="text-base font-medium">{title}</p>
                    {tag && (
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg ${tagColor}`}>
                            {tag}
                        </span>
                    )}
                 </div>
                 <div className="mt-2">
                    <p className="text-4xl font-bold">{value}</p>
                 </div>
            </div>
        </div>
    );
};

export default DashboardCard;