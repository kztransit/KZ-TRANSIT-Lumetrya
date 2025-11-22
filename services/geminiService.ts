import { GoogleGenAI, FunctionDeclaration, SchemaType } from "@google/genai";
import { UserData } from "../types";

// --- ОПРЕДЕЛЕНИЕ ИНСТРУМЕНТОВ ---

export const navigationFunctionDeclaration: FunctionDeclaration = {
    name: 'navigateToPage',
    description: 'Переходит на указанную страницу.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            page: { type: SchemaType.STRING, description: 'Путь (например /reports)', enum: ['/dashboard', '/reports', '/proposals', '/campaigns', '/payments', '/storage', '/settings', '/compare', '/conversions', '/unit-economics'] }
        },
        required: ['page']
    }
};

export const createCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'createCommercialProposal',
    description: 'Создает КП.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            company: { type: SchemaType.STRING },
            item: { type: SchemaType.STRING },
            amount: { type: SchemaType.NUMBER },
            direction: { type: SchemaType.STRING, enum: ['РТИ', '3D'] },
            date: { type: SchemaType.STRING }
        },
        required: ['company', 'item', 'amount']
    }
};

export const createOtherReportFunctionDeclaration: FunctionDeclaration = {
    name: 'createOtherReport',
    description: 'Создает отчет.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            name: { type: SchemaType.STRING },
            category: { type: SchemaType.STRING },
            date: { type: SchemaType.STRING },
            kpis: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { name: {type: SchemaType.STRING}, value: {type: SchemaType.STRING} } } }
        },
        required: ['name', 'category']
    }
};

export const updateOtherReportKpiFunctionDeclaration: FunctionDeclaration = {
    name: 'updateOtherReportKpi',
    description: 'Обновляет KPI.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: { reportName: { type: SchemaType.STRING }, kpiName: { type: SchemaType.STRING }, newValue: { type: SchemaType.STRING } },
        required: ['reportName', 'kpiName', 'newValue']
    }
};

export const updateCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'updateCommercialProposal',
    description: 'Обновляет КП.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: { company: { type: SchemaType.STRING }, fieldToUpdate: { type: SchemaType.STRING }, newValue: { type: SchemaType.STRING } },
        required: ['company', 'fieldToUpdate', 'newValue']
    }
};

// --- ЧИСТКА ОТВЕТА ---
const cleanJson = (text: string | null | undefined): string => {
    if (!text) return "{}";
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
};

// --- АНАЛИЗ ФАЙЛОВ ---
// (Код анализа файлов оставляем без изменений, он был верным в прошлой версии)
export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
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
        model: "gemini-2.0-flash-exp",
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
        model: "gemini-2.0-flash-exp",
        config: { systemInstruction: "Извлеки кампании в JSON []." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Таблица кампаний" }] }]
    });
    return JSON.parse(cleanJson(response.text()));
};

// --- ГЛАВНАЯ ФУНКЦИЯ ТЕКСТОВОГО ЧАТА ---
export const getAIAssistantResponse = async (prompt: string, userData: UserData, systemInstruction: string) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    
    // Используем chats.create для поддержки истории в будущем
    const chat = client.chats.create({
        model: "gemini-2.0-flash-exp",
        config: {
            systemInstruction: systemInstruction,
            tools: [
                { googleSearch: {} }, // <-- ВОТ ОН, ПОИСК В ИНТЕРНЕТЕ
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
    
    const functionCalls = result.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
        return { text: null, functionCall: functionCalls[0] };
    }

    return { text: result.text(), functionCall: null };
};
