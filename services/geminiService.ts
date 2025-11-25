import { GoogleGenAI } from "@google/genai";
import { UserData } from "../types";

// --- ИНСТРУМЕНТЫ (Используются и Voice Assistant, и Text Chat - НЕ МЕНЯЕМ СТРУКТУРУ) ---

export const navigationFunctionDeclaration = {
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

export const createCommercialProposalFunctionDeclaration = {
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

export const createOtherReportFunctionDeclaration = {
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

export const updateOtherReportKpiFunctionDeclaration = {
    name: 'updateOtherReportKpi',
    description: 'Обновляет KPI.',
    parameters: {
        type: "OBJECT",
        properties: { reportName: { type: "STRING" }, kpiName: { type: "STRING" }, newValue: { type: "STRING" } },
        required: ['reportName', 'kpiName', 'newValue']
    }
};

export const updateCommercialProposalFunctionDeclaration = {
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
    let cleaned = text.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
    }
    return cleaned.trim();
};

const getSafeText = (response: any): string => {
    if (response?.text && typeof response.text === 'function') {
        try { return response.text(); } catch (e) {}
    }
    return response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// --- АНАЛИЗ ФАЙЛОВ (ДЛЯ ИМПОРТА ДАННЫХ) ---

export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: {
            systemInstruction: `Ты — аналитик данных. Извлеки цифры из скриншота отчета.
            ВАЖНО ПРО "sales" (Выручка): Это должны быть ДЕНЬГИ, а не количество.
            Верни JSON объект строго с ключами "РТИ" и "3D".
            Внутри: budget, clicks, leads, proposals, invoices, deals, sales.
            Все значения — ЧИСЛА (0 если нет).`
        },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Извлеки данные." }] }]
    });
    return cleanJson(getSafeText(response));
};

export const analyzeProposalsImage = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: `Распознай список КП. Верни JSON { 'РТИ': [], '3D': [] }. Для каждого КП: date, company, item, amount, status.` },
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
        config: { systemInstruction: "Извлеки таблицу кампаний. Верни массив JSON: [{ name, status, spend }]." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Таблица кампаний" }] }]
    });
    return JSON.parse(cleanJson(getSafeText(response)));
};

export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: { systemInstruction: "Проанализируй счет. Верни JSON: { serviceName, amount, currency, paymentPeriod, lastPaymentDate, paymentDetails, paymentMethod }." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Счет на оплату" }] }]
    });
    return JSON.parse(cleanJson(getSafeText(response)));
};

// --- НОВАЯ ФУНКЦИЯ: ОБЩИЙ АНАЛИЗ ДОКУМЕНТА (ДЛЯ ЧАТА) ---
export const analyzeGeneralDocument = async (mimeType: string, base64Data: string, prompt: string = "Проанализируй этот документ"): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: {
            // Инструкция для чистого текста
            systemInstruction: "Ты — помощник. Проанализируй документ. Отвечай на русском языке. Используй Markdown для форматирования, но не используй блоки кода ```, если не просят."
        },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: prompt }] }]
    });
    return getSafeText(response);
};

export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    
    try {
        const response = await client.models.generateContent({
            model: "models/gemini-2.0-flash-exp",
            config: { systemInstruction: "Найди аномалии или тренды в данных JSON." },
            contents: [{ role: "user", parts: [{ text: `Analyze: ${JSON.stringify(reports.slice(-5))}` }] }]
        });
        return getSafeText(response) || "Данных недостаточно.";
    } catch (e) { return "Не удалось провести анализ."; }
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
                // Подключаем Google Search для доступа в интернет
                tools: [{ googleSearch: {} }],
                generationConfig: {
                    maxOutputTokens: 2000,
                    temperature: 0.7 // Баланс между точностью и креативностью
                }
            },
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });

        const text = getSafeText(response);
        
        // Если ответ пустой или странный
        if (!text) return { text: "Извините, я не нашла информации по вашему запросу.", functionCall: null };
        
        return { text: text, functionCall: null };
        
    } catch (error: any) {
        console.error("GEMINI CHAT ERROR:", error);
        return { text: "Произошла ошибка соединения с ИИ. Попробуйте позже.", functionCall: null };
    }
};
