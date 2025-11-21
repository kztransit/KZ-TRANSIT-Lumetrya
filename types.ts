


export interface User {
    id: string;
    email: string;
    name: string;
    initials: string;
}

export interface Report {
    id:string;
    name: string;
    creationDate: string;
    metrics: {
        budget: number;
        clicks: number;
        leads: number;
        proposals: number;
        invoices: number;
        deals: number;
        sales: number;
    };
    previousMetrics?: Report['metrics'];
    directions: {
        [key: string]: {
            budget: number;
            clicks: number;
            leads: number;
            proposals: number;
            invoices: number;
            deals: number;
            sales: number;
        }
    };
    netMetrics?: {
        qualifiedLeads: number;
    };
}

export interface CommercialProposal {
    id: string;
    date: string;
    direction: 'РТИ' | '3D';
    proposalNumber: string; // Proposal number (e.g., КП-12345), can be a fallback for display
    invoiceNumber: string | null;
    company: string | null;
    item: string;
    amount: number;
    invoiceDate: string | null;
    paymentDate: string | null;
    paymentType: string | null;
    status: 'Ожидание' | 'Оплачено' | 'Отменено';
}

export interface AdCampaign {
    id: string;
    name: string;
    status: 'Включено' | 'Приостановлено' | 'Завершено';
    type: 'Поиск' | 'Максимальная эффективность';
    budgetType: 'Дневной' | 'На весь срок';
    budget: number;
    impressions: number;
    clicks: number;
    ctr: number;
    spend: number;
    conversions: number;
    cpc: number;
    conversionRate: number;
    cpa: number;
    strategy: string;
    period: string;
}

export interface Link {
    id: string;
    url: string;
    comment: string;
    date: string;
}

export interface StoredFile {
    id: string;
    name: string;
    type: string;
    size: number;
    content: string; // base64 encoded content
    date: string;
}

export interface CompanyDetails {
    legalName: string;
    tin: string; // ИНН
    kpp: string; // КПП
    ogrn: string; // ОГРН
    legalAddress: string;
    bankName: string;
    bic: string; // БИК
    correspondentAccount: string;
    checkingAccount: string;
}

export interface CompanyContacts {
    phone: string;
    email: string;
    address: string;
}

export interface Employee {
    id: string;
    name: string;
    position: string;
}

export interface Payment {
    id: string;
    serviceName: string;
    lastPaymentDate: string;
    nextPaymentDate: string;
    paymentPeriod: 'monthly' | 'yearly' | 'onetime';
    amount: number;
    currency: 'KZT' | 'USD' | 'RUB';
    comment: string;
    paymentMethod: 'Карта' | 'Безнал';
    paymentDetails: string; // e.g., "Card **** 1234", "Invoice #567"
    invoiceId: string | null; // ID of a file in StoredFile[]
}


export interface CompanyProfile {
    companyName: string;
    details: CompanyDetails;
    contacts: CompanyContacts;
    employees: Employee[];
    socialMedia: string[];
    websites: string[];
    about: string;
    aiSystemInstruction: string;
    darkModeEnabled: boolean;
    language: 'ru' | 'en' | 'kz';
}

export interface OtherReportKpi {
    id: string;
    name: string;
    value: string;
}

export interface OtherReport {
    id: string;
    name: string;
    date: string;
    category: string;
    description: string;
    kpis: OtherReportKpi[];
}

export interface UserData {
    companyProfile: CompanyProfile;
    reports: Report[];
    proposals: CommercialProposal[];
    campaigns: AdCampaign[];
    links: Link[];
    files: StoredFile[];
    payments: Payment[];
    otherReports: OtherReport[];
}