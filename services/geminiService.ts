import { GoogleGenAI, FunctionDeclaration, SchemaType } from "@google/genai";
import { UserData } from "../types";

// --- ОПРЕДЕЛЕНИЕ ФУНКЦИЙ (ИНСТРУМЕНТОВ) ---

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
            item: { type: "STRING", description: 'Товар/Услуга' },
            amount: { type: "NUMBER", description: 'Сумма' },
            direction: { type: "STRING", enum: ['РТИ', '3D'] },
            date: { type: "STRING", description: 'YYYY-MM-DD' }
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
        config: { systemInstruction: "JSON only output. Structure: { 'РТИ': {...}, '3D': {...} }" },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract data" }] }]
    });
    return cleanJson(response.text());
};

export const analyzeProposalsImage = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Extract proposals to JSON: { 'РТИ': [], '3D': [] }" },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract list" }] }]
    });
    return JSON.parse(cleanJson(response.text()));
};

export const analyzeCampaignsImage = async (mimeType: string, base64Data: string): Promise<any[]> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Extract campaigns to JSON array []" },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract table" }] }]
    });
    return JSON.parse(cleanJson(response.text()));
};

export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Extract invoice to JSON: { serviceName, amount, currency, paymentPeriod, lastPaymentDate, paymentDetails, paymentMethod }" },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract data" }] }]
    });
    return JSON.parse(cleanJson(response.text()));
};

export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: `Analyze trends (Russian): ${JSON.stringify(reports.slice(-5))}` }] }]
    });
    return response.text() || "Error";
};

// --- ГЛАВНАЯ ФУНКЦИЯ ТЕКСТОВОГО ЧАТА (ИСПРАВЛЕНА) ---
export const getAIAssistantResponse = async (prompt: string, userData: UserData, systemInstructionText: string) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    
    try {
        const response = await client.models.generateContent({
            model: "models/gemini-2.0-flash-exp", // ИСПРАВЛЕНО: Добавлен префикс models/
            config: {
                // Явно форматируем systemInstruction как Content Part, чтобы избежать 400 ошибки
                systemInstruction: {
                    parts: [{ text: systemInstructionText }]
                },
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
            },
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ]
        });

        const functionCalls = response.functionCalls();
        
        if (functionCalls && functionCalls.length > 0) {
            return { text: null, functionCall: functionCalls[0] };
        }

        return { text: response.text(), functionCall: null };
        
    } catch (error: any) {
        console.error("Full Gemini Error:", error);
        // Возвращаем читаемую ошибку для интерфейса
        throw new Error(error.message || "Ошибка при запросе к AI");
    }
};
