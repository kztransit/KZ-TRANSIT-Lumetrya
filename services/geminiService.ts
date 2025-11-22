import { GoogleGenAI, FunctionDeclaration } from "@google/genai";
import { UserData } from "../types";

// --- ИНСТРУМЕНТЫ (Без изменений) ---
export const navigationFunctionDeclaration: FunctionDeclaration = {
    name: 'navigateToPage',
    description: 'Переходит на указанную страницу.',
    parameters: { type: "OBJECT", properties: { page: { type: "STRING", enum: ['/dashboard', '/reports', '/proposals', '/campaigns', '/payments', '/storage', '/settings', '/compare', '/conversions', '/unit-economics'] } }, required: ['page'] }
};
export const createCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'createCommercialProposal',
    description: 'Создает КП.',
    parameters: { type: "OBJECT", properties: { company: { type: "STRING" }, item: { type: "STRING" }, amount: { type: "NUMBER" }, direction: { type: "STRING" }, date: { type: "STRING" } }, required: ['company', 'item', 'amount'] }
};
export const createOtherReportFunctionDeclaration: FunctionDeclaration = {
    name: 'createOtherReport',
    description: 'Создает отчет.',
    parameters: { type: "OBJECT", properties: { name: { type: "STRING" }, category: { type: "STRING" }, date: { type: "STRING" }, kpis: { type: "ARRAY", items: { type: "OBJECT", properties: { name: {type: "STRING"}, value: {type: "STRING"} } } } }, required: ['name', 'category'] }
};
export const updateOtherReportKpiFunctionDeclaration: FunctionDeclaration = {
    name: 'updateOtherReportKpi',
    description: 'Обновляет KPI.',
    parameters: { type: "OBJECT", properties: { reportName: { type: "STRING" }, kpiName: { type: "STRING" }, newValue: { type: "STRING" } }, required: ['reportName', 'kpiName', 'newValue'] }
};
export const updateCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'updateCommercialProposal',
    description: 'Обновляет КП.',
    parameters: { type: "OBJECT", properties: { company: { type: "STRING" }, fieldToUpdate: { type: "STRING" }, newValue: { type: "STRING" } }, required: ['company', 'fieldToUpdate', 'newValue'] }
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
        model: "gemini-2.0-flash-exp", // Убрали models/
        config: { systemInstruction: "JSON only" },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract data" }] }]
    });
    return cleanJson(response.text());
};
export const analyzeProposalsImage = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: { systemInstruction: "JSON only" },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract proposals" }] }]
    });
    return JSON.parse(cleanJson(response.text()));
};
export const analyzeCampaignsImage = async (mimeType: string, base64Data: string): Promise<any[]> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: { systemInstruction: "JSON only" },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract campaigns" }] }]
    });
    return JSON.parse(cleanJson(response.text()));
};
export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        config: { systemInstruction: "JSON only" },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Extract invoice data" }] }]
    });
    return JSON.parse(cleanJson(response.text()));
};
export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: `Analyze: ${JSON.stringify(reports.slice(-5))}` }] }]
    });
    return response.text() || "Error";
};

// --- ГЛАВНАЯ ФУНКЦИЯ ТЕКСТОВОГО ЧАТА (ИСПРАВЛЕНА) ---
export const getAIAssistantResponse = async (prompt: string, userData: UserData, systemInstruction: string) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    
    // Используем generateContent вместо chat.create для надежности
    const response = await client.models.generateContent({
        model: "gemini-2.0-flash-exp", // Без 'models/' для текстового SDK
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
        },
        contents: [{ role: "user", parts: [{ text: prompt }] }]
    });

    // Безопасное извлечение function calls
    const functionCalls = response.functionCalls();
    
    if (functionCalls && functionCalls.length > 0) {
        return { text: null, functionCall: functionCalls[0] };
    }

    return { text: response.text(), functionCall: null };
};
