import { GoogleGenAI, FunctionDeclaration } from "@google/genai";
import { UserData } from "../types";

// --- ИНСТРУМЕНТЫ (Function Declarations) ---
// Используем строковые типы ("STRING", "OBJECT"), так как SchemaType устарел в новой версии SDK

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
    description: 'Создает КП.',
    parameters: {
        type: "OBJECT",
        properties: {
            company: { type: "STRING" },
            item: { type: "STRING" },
            amount: { type: "NUMBER" },
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

// --- ЧИСТКА JSON ---
const cleanJson = (text: string | null | undefined): string => {
    if (!text) return "{}";
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- АНАЛИЗ ФАЙЛОВ ---
export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Извлеки данные в JSON: { 'РТИ': {...}, '3D': {...} }." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Данные отчета" }] }]
    });
    return cleanJson(response.text());
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
    return JSON.parse(cleanJson(response.text()));
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
    return JSON.parse(cleanJson(response.text()));
};

export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Проанализируй счет. Верни JSON: { serviceName, amount, currency, paymentPeriod, lastPaymentDate, paymentDetails, paymentMethod }." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Данные платежа" }] }]
    });
    return JSON.parse(cleanJson(response.text()));
};

// --- АНАЛИЗ ДАННЫХ (ДЛЯ ДАШБОРДА) ---
// Вот эта функция, которой не хватало!
export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });

    // Сжимаем данные, чтобы не перегрузить запрос
    const simplifiedReports = reports.slice(-5).map(r => ({
        name: r.name,
        metrics: r.metrics
    }));

    const prompt = `Проанализируй эти маркетинговые отчеты. Найди тренды, аномалии (резкие падения/росты) и дай краткое резюме на русском языке. Данные: ${JSON.stringify(simplifiedReports)}`;
    
    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
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
        model: "models/gemini-2.0-flash-exp",
        config: {
            systemInstruction: systemInstruction,
            tools: [
                { googleSearch: {} }, // ПОИСК
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
    
    let functionCalls;
    try { functionCalls = result.functionCalls(); } catch (e) { functionCalls = []; }
    
    if (functionCalls && functionCalls.length > 0) {
        return { text: null, functionCall: functionCalls[0] };
    }

    return { text: result.text(), functionCall: null };
};
