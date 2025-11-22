import { GoogleGenAI, FunctionDeclaration, Part } from "@google/genai";
import { UserData } from "../types";

// --- ОПРЕДЕЛЕНИЕ ФУНКЦИЙ (ИНСТРУМЕНТОВ) ---
// Исправление: Используем строки вместо SchemaType, так как в новой версии SDK его убрали/переименовали

export const navigationFunctionDeclaration: FunctionDeclaration = {
    name: 'navigateToPage',
    description: 'Переходит на указанную страницу в приложении (навигация).',
    parameters: {
        type: "OBJECT",
        properties: {
            page: {
                type: "STRING",
                description: 'Путь к странице. Например: /dashboard, /reports, /proposals, /settings, /campaigns.',
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
            company: { type: "STRING", description: 'Название компании клиента' },
            item: { type: "STRING", description: 'Товар или услуга' },
            amount: { type: "NUMBER", description: 'Сумма в тенге' },
            direction: { type: "STRING", description: 'Направление: РТИ или 3D', enum: ['РТИ', '3D'] },
            date: { type: "STRING", description: 'Дата создания (YYYY-MM-DD)' }
        },
        required: ['company', 'item', 'amount']
    }
};

export const createOtherReportFunctionDeclaration: FunctionDeclaration = {
    name: 'createOtherReport',
    description: 'Создает прочий/нестандартный отчет с KPI.',
    parameters: {
        type: "OBJECT",
        properties: {
            name: { type: "STRING", description: 'Название отчета' },
            category: { type: "STRING", description: 'Категория' },
            date: { type: "STRING", description: 'Дата' },
            kpis: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        name: { type: "STRING" },
                        value: { type: "STRING" }
                    },
                    required: ['name', 'value']
                }
            }
        },
        required: ['name', 'category']
    }
};

export const updateOtherReportKpiFunctionDeclaration: FunctionDeclaration = {
    name: 'updateOtherReportKpi',
    description: 'Обновляет значение KPI в существующем отчете.',
    parameters: {
        type: "OBJECT",
        properties: {
            reportName: { type: "STRING" },
            kpiName: { type: "STRING" },
            newValue: { type: "STRING" }
        },
        required: ['reportName', 'kpiName', 'newValue']
    }
};

export const updateCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'updateCommercialProposal',
    description: 'Обновляет поле в существующем КП.',
    parameters: {
        type: "OBJECT",
        properties: {
            company: { type: "STRING", description: 'Название компании' },
            fieldToUpdate: { type: "STRING", enum: ['status', 'amount', 'item'] },
            newValue: { type: "STRING" }
        },
        required: ['company', 'fieldToUpdate', 'newValue']
    }
};

// --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ: ЧИСТКА JSON ---
const cleanJson = (text: string | null | undefined): string => {
    if (!text) return "{}";
    const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    const firstSquare = cleaned.indexOf('[');
    const lastSquare = cleaned.lastIndexOf(']');

    if (firstBrace !== -1 && lastBrace !== -1 && (firstSquare === -1 || firstBrace < firstSquare)) {
        return cleaned.substring(firstBrace, lastBrace + 1);
    }
    if (firstSquare !== -1 && lastSquare !== -1) {
        return cleaned.substring(firstSquare, lastSquare + 1);
    }
    return cleaned;
};

// --- ФУНКЦИИ АНАЛИЗА ФАЙЛОВ ---

export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    
    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
            systemInstruction: "Ты аналитик данных. Твоя задача — извлечь данные из изображения маркетингового отчета и вернуть их СТРОГО в формате JSON. Структура JSON должна быть: { 'РТИ': { budget, clicks, leads, proposals, invoices, deals, sales }, '3D': { ...те же поля... } }. Если каких-то данных нет, ставь 0. Не пиши ничего кроме JSON."
        },
        contents: [
            {
                role: "user",
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: "Извлеки данные из этого отчета." }
                ]
            }
        ]
    });
    return cleanJson(response.text());
};

export const analyzeProposalsImage = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
            systemInstruction: "Извлеки данные о коммерческих предложениях из изображения. Верни JSON объект с ключами 'РТИ' и '3D', внутри массивы объектов: { date, company, item, amount, invoiceNumber, invoiceDate, paymentDate }. Даты в формате YYYY-MM-DD. Если направление не понятно, определи по контексту или помести в 'РТИ'."
        },
        contents: [
            {
                role: "user",
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: "Извлеки список КП." }
                ]
            }
        ]
    });
    
    return JSON.parse(cleanJson(response.text()));
};

export const analyzeCampaignsImage = async (mimeType: string, base64Data: string): Promise<any[]> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
            systemInstruction: "Извлеки данные рекламных кампаний. Верни массив JSON: [{ name, status, type, budget, impressions, clicks, ctr, spend, conversions, cpc }]. Status: Включено/Приостановлено. Type: Поиск/Максимальная эффективность."
        },
        contents: [
            {
                role: "user",
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: "Извлеки таблицу кампаний." }
                ]
            }
        ]
    });
    
    return JSON.parse(cleanJson(response.text()));
};

export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: {
            systemInstruction: "Проанализируй счет на оплату/инвойс. Верни JSON: { serviceName, amount, currency (KZT/USD/RUB), paymentPeriod (monthly/yearly), lastPaymentDate (YYYY-MM-DD), paymentDetails, paymentMethod (Карта/Безнал) }."
        },
        contents: [
            {
                role: "user",
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: "Извлеки данные платежа." }
                ]
            }
        ]
    });

    return JSON.parse(cleanJson(response.text()));
};

export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });

    const prompt = `Проанализируй эти маркетинговые отчеты на предмет аномалий, ошибок и трендов. Дай краткое резюме на русском языке. Данные: ${JSON.stringify(reports.slice(-5))}`;
    
    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    return response.text() || "Не удалось получить анализ.";
};

// --- ГЛАВНАЯ ФУНКЦИЯ ТЕКСТОВОГО ЧАТА ---
export const getAIAssistantResponse = async (prompt: string, userData: UserData, systemInstruction: string) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    
    const chat = client.chats.create({
        model: "gemini-2.0-flash-exp",
        config: {
            systemInstruction: systemInstruction,
            tools: [
                { googleSearch: {} },
                { functionDeclarations: [
                    navigationFunctionDeclaration,
                    createOtherReportFunctionDeclaration,
                    updateOtherReportKpiFunctionDeclaration,
                    createCommercialProposalFunctionDeclaration,
                    updateCommercialProposalFunctionDeclaration
                ]}
            ]
        }
    });

    const result = await chat.sendMessage({
        role: "user",
        parts: [{ text: prompt }]
    });
    
    // Безопасная обработка вызовов функций
    let functionCalls;
    try {
        functionCalls = result.functionCalls();
    } catch (e) {
        // Если библиотека не вернула вызовы (или метод другой), считаем что их нет
        functionCalls = [];
    }
    
    if (functionCalls && functionCalls.length > 0) {
        return { text: null, functionCall: functionCalls[0] };
    }

    return { text: result.text(), functionCall: null };
};
