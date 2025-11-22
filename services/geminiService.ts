import { GoogleGenAI, FunctionDeclaration } from "@google/genai";
import { UserData } from "../types";

// --- ИНСТРУМЕНТЫ (Function Declarations) ---

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
            company: { type: "STRING", description: 'Название компании клиента' },
            item: { type: "STRING", description: 'Товар или услуга' },
            amount: { type: "NUMBER", description: 'Сумма в тенге' },
            direction: { type: "STRING", enum: ['РТИ', '3D'] },
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
            company: { type: "STRING" },
            fieldToUpdate: { type: "STRING", enum: ['status', 'amount', 'item'] },
            newValue: { type: "STRING" }
        },
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

export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        contents: [{ role: "user", parts: [{ text: `Analyze: ${JSON.stringify(reports.slice(-5))}` }] }]
    });
    return response.text() || "Error";
};

// --- ГЛАВНАЯ ФУНКЦИЯ ТЕКСТОВОГО ЧАТА ---
export const getAIAssistantResponse = async (prompt: string, userData: UserData, systemInstruction: string) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    
    try {
        const chat = client.chats.create({
            model: "models/gemini-2.0-flash-exp",
            config: {
                // Передаем инструкцию строкой, это надежнее для этой версии
                systemInstruction: systemInstruction,
                tools: [
                    // Если включение googleSearch вызывает ошибку 400 вместе с функциями,
                    // то, к сожалению, в текущей версии API придется выбрать что-то одно.
                    // Я пока включил оба, но если снова будет 400 - уберите строку ниже.
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

        // ИСПРАВЛЕНИЕ: Передаем просто строку prompt, библиотека сама обернет её как надо
        const result = await chat.sendMessage(prompt);
        
        const functionCalls = result.functionCalls();
        
        if (functionCalls && functionCalls.length > 0) {
            return { text: null, functionCall: functionCalls[0] };
        }

        return { text: result.text(), functionCall: null };
        
    } catch (error: any) {
        console.error("GEMINI ERROR:", error);
        throw new Error(error.message || "Ошибка AI сервиса");
    }
};
