import { GoogleGenAI, FunctionDeclaration } from "@google/genai";
import { UserData } from "../types";

// --- ИНСТРУМЕНТЫ (Экспортируем их для Voice Assistant, но в текстовом чате отключаем) ---
export const navigationFunctionDeclaration: FunctionDeclaration = {
    name: 'navigateToPage',
    description: 'Переходит на указанную страницу приложения.',
    parameters: {
        type: "OBJECT",
        properties: {
            page: {
                type: "STRING",
                description: 'Путь (например: /reports, /proposals, /settings)',
                enum: ['/dashboard', '/reports', '/other-reports', '/proposals', '/compare', '/conversions', '/net-conversions', '/campaigns', '/unit-economics', '/payments', '/storage', '/settings']
            }
        },
        required: ['page']
    }
};

export const createCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'createCommercialProposal',
    description: 'Создает новое коммерческое предложение (КП).',
    parameters: {
        type: "OBJECT",
        properties: {
            company: { type: "STRING", description: 'Название компании' },
            item: { type: "STRING", description: 'Товар' },
            amount: { type: "NUMBER", description: 'Сумма' },
            direction: { type: "STRING", enum: ['РТИ', '3D'] },
            date: { type: "STRING" }
        },
        required: ['company', 'item', 'amount']
    }
};

export const createOtherReportFunctionDeclaration: FunctionDeclaration = {
    name: 'createOtherReport',
    description: 'Создает отчет.',
    parameters: {
        type: "OBJECT",
        properties: {
            name: { type: "STRING" },
            category: { type: "STRING" },
            date: { type: "STRING" },
            kpis: { type: "ARRAY", items: { type: "OBJECT", properties: { name: {type: "STRING"}, value: {type: "STRING"} } } }
        },
        required: ['name', 'category']
    }
};

export const updateOtherReportKpiFunctionDeclaration: FunctionDeclaration = {
    name: 'updateOtherReportKpi',
    description: 'Обновляет KPI.',
    parameters: {
        type: "OBJECT",
        properties: { reportName: { type: "STRING" }, kpiName: { type: "STRING" }, newValue: { type: "STRING" } },
        required: ['reportName', 'kpiName', 'newValue']
    }
};

export const updateCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'updateCommercialProposal',
    description: 'Обновляет КП.',
    parameters: {
        type: "OBJECT",
        properties: { company: { type: "STRING" }, fieldToUpdate: { type: "STRING" }, newValue: { type: "STRING" } },
        required: ['company', 'fieldToUpdate', 'newValue']
    }
};

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

const cleanJson = (text: string | null | undefined): string => {
    if (!text) return "{}";
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// Функция безопасного извлечения текста из ответа Gemini
// (Решает проблему "intermediate value is not a function")
const getSafeText = (response: any): string => {
    if (typeof response.text === 'function') {
        try {
            return response.text();
        } catch (e) {
            console.warn("response.text() error, using fallback");
        }
    }
    // Фолбэк на структуру candidates
    return response.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// --- АНАЛИЗ ФАЙЛОВ И ДАННЫХ ---

export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Извлеки данные в JSON: { 'РТИ': {...}, '3D': {...} }." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Данные отчета" }] }]
    });
    return cleanJson(getSafeText(response));
};

export const analyzeProposalsImage = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Извлеки КП в JSON { 'РТИ': [], '3D': [] }." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Список КП" }] }]
    });
    return JSON.parse(cleanJson(getSafeText(response)));
};

export const analyzeCampaignsImage = async (mimeType: string, base64Data: string): Promise<any[]> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Извлеки кампании в JSON []." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Таблица кампаний" }] }]
    });
    return JSON.parse(cleanJson(getSafeText(response)));
};

// Вернули эту функцию, она нужна для PaymentsPage
export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Проанализируй счет. Верни JSON: { serviceName, amount, currency, paymentPeriod, lastPaymentDate, paymentDetails, paymentMethod }." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Данные платежа" }] }]
    });
    return JSON.parse(cleanJson(getSafeText(response)));
};

// ✅ ВЕРНУЛИ ЭТУ ФУНКЦИЮ (Из-за ее отсутствия падал билд)
export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    
    try {
        const response = await client.models.generateContent({
            model: "models/gemini-2.0-flash-exp",
            config: {
                systemInstruction: "Ты аналитик данных. Найди аномалии или тренды в данных JSON.",
            },
            contents: [{ role: "user", parts: [{ text: `Analyze briefly: ${JSON.stringify(reports.slice(-5))}` }] }]
        });
        return getSafeText(response) || "Данных недостаточно для анализа.";
    } catch (e) {
        console.error("Error analyzing consistency:", e);
        return "Не удалось провести анализ данных.";
    }
};

// --- ГЛАВНАЯ ФУНКЦИЯ ТЕКСТОВОГО ЧАТА ---
export const getAIAssistantResponse = async (prompt: string, userData: UserData, systemInstruction: string) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    
    try {
        const response = await client.models.generateContent({
            model: "models/gemini-2.0-flash-exp",
            config: {
                systemInstruction: {
                    parts: [{ text: systemInstruction }]
                },
                tools: [
                    // ✅ Оставляем ТОЛЬКО Google Search для текстового режима (чтобы избежать конфликта 400 Bad Request)
                    { googleSearch: {} } 
                ]
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ]
        });

        const text = getSafeText(response);
        
        if (!text) {
             return { text: "Извините, не удалось получить ответ от сервиса.", functionCall: null };
        }

        return { text: text, functionCall: null };
        
    } catch (error: any) {
        console.error("GEMINI ERROR:", error);
        throw new Error(error.message || "Ошибка AI сервиса");
    }
};
