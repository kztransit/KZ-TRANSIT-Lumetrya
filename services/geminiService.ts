import { GoogleGenAI } from "@google/genai";
import { UserData } from "../types";

// --- ИНСТРУМЕНТЫ (Определяем как обычные объекты, чтобы избежать ошибок типизации при билде) ---

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
    // Убираем markdown обертку
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/^```json/, '').replace(/```$/, '');
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```/, '').replace(/```$/, '');
    }
    return cleaned.trim();
};

// --- АНАЛИЗ ФАЙЛОВ И ДАННЫХ ---

// 1. АНАЛИЗ ОТЧЕТА (С УСИЛЕННЫМ ПРОМПТОМ)
export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
    Ты — аналитик данных. Извлеки цифры из отчета.
    Верни JSON объект строго с ключами "РТИ" и "3D".
    Внутри каждого ключа: budget, clicks, leads, proposals, invoices, deals, sales.
    Все значения — ЧИСЛА (0 если нет данных).
    Пример: { "РТИ": { "budget": 100, ... }, "3D": { "budget": 0, ... } }
    `;

    const response = await model.generateContent([
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } }
    ]);

    return cleanJson(response.response.text());
};

// 2. АНАЛИЗ КП
export const analyzeProposalsImage = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
    Распознай список КП из изображения.
    Верни JSON объект с ключами "РТИ" и "3D" (массивы).
    Для каждого КП: date (YYYY-MM-DD), company, item, amount (число), status.
    Пример: { "РТИ": [{ "date": "2023-10-01", "company": "ABC", "amount": 50000 }], "3D": [] }
    `;

    try {
        const response = await model.generateContent([
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
        ]);
        return JSON.parse(cleanJson(response.response.text()));
    } catch (e) {
        console.error("Error parsing proposals:", e);
        return { "РТИ": [], "3D": [] };
    }
};

// 3. АНАЛИЗ КАМПАНИЙ
export const analyzeCampaignsImage = async (mimeType: string, base64Data: string): Promise<any[]> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `
    Извлеки таблицу рекламных кампаний.
    Верни массив JSON объектов: [{ "name": "...", "status": "...", "spend": 1000 }].
    `;

    try {
        const response = await model.generateContent([
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
        ]);
        return JSON.parse(cleanJson(response.response.text()));
    } catch (e) {
        console.error("Error parsing campaigns:", e);
        return [];
    }
};

// 4. АНАЛИЗ СЧЕТА (ДЛЯ ПЛАТЕЖЕЙ)
export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = "Проанализируй счет. Верни JSON: { serviceName, amount (число), currency, paymentPeriod, lastPaymentDate, paymentDetails, paymentMethod }.";

    try {
        const response = await model.generateContent([
            { text: prompt },
            { inlineData: { mimeType, data: base64Data } }
        ]);
        return JSON.parse(cleanJson(response.response.text()));
    } catch (e) {
        console.error("Error parsing invoice:", e);
        return {};
    }
};

// 5. АНАЛИЗ АНОМАЛИЙ (Consistency)
export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    try {
        const response = await model.generateContent({
            systemInstruction: { parts: [{ text: "Ты аналитик данных. Найди аномалии или тренды в данных JSON." }] },
            contents: [{ role: "user", parts: [{ text: `Analyze briefly: ${JSON.stringify(reports.slice(-5))}` }] }]
        });
        return response.response.text() || "Данных недостаточно для анализа.";
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
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
    
    try {
        const response = await model.generateContent({
            systemInstruction: {
                parts: [{ text: systemInstruction }]
            },
            // Для текстового чата подключаем поиск, но отключаем управление навигацией, 
            // чтобы он просто отвечал текстом
            tools: [
                { googleSearch: {} } 
            ],
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ]
        });

        const text = response.response.text();
        
        if (!text) {
             return { text: "Извините, не удалось получить ответ от сервиса.", functionCall: null };
        }

        return { text: text, functionCall: null };
        
    } catch (error: any) {
        console.error("GEMINI ERROR:", error);
        // Возвращаем читаемую ошибку, чтобы интерфейс не падал
        return { text: "Произошла ошибка при обращении к ИИ. Попробуйте позже.", functionCall: null };
    }
};
