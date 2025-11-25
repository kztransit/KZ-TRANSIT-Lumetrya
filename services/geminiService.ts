import { GoogleGenAI } from "@google/genai";
import { UserData } from "../types";

// --- ИНСТРУМЕНТЫ (Экспортируем их для Voice Assistant, но в текстовом чате отключаем) ---
// Определяем как обычные объекты JS, чтобы избежать конфликтов типов при билде

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

const getSafeText = (response: any): string => {
    // В новой SDK текст часто лежит глубоко или возвращается методом text()
    if (response?.text && typeof response.text === 'function') {
        try { return response.text(); } catch (e) {}
    }
    // Проверка структуры candidates (fallback)
    return response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// --- АНАЛИЗ ФАЙЛОВ И ДАННЫХ (Для страниц импорта) ---

export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });

    // ИСПОЛЬЗУЕМ УСИЛЕННЫЙ ПРОМПТ ДЛЯ ДЕНЕГ
    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: {
            systemInstruction: `Ты — аналитик данных. Извлеки цифры из скриншота отчета.
            
            ВАЖНО ПРО "sales" (Выручка):
            - Ищи колонки "Сумма", "Выручка", "Оборот", "Revenue", "Total".
            - ЭТО ДОЛЖНЫ БЫТЬ ДЕНЬГИ (например: 372289 или 5 000 000), А НЕ КОЛИЧЕСТВО (например: 3 или 21).
            - Если видишь две колонки "Продажи" (шт) и "Продажи" (деньги) — в поле 'sales' пиши ДЕНЬГИ.
            
            Верни JSON объект строго с ключами "РТИ" и "3D".
            Внутри каждого ключа: 
            - budget (бюджет)
            - clicks (клики)
            - leads (лиды)
            - proposals (выставленные КП)
            - invoices (выставленные счета)
            - deals (сделки)
            - sales (ДЕНЕЖНАЯ ВЫРУЧКА)

            Все значения — ЧИСЛА (0 если нет данных).`
        },
        contents: [
            {
                role: "user",
                parts: [
                    { inlineData: { mimeType, data: base64Data } },
                    { text: "Извлеки данные из этого отчета. Внимание на поле sales - это деньги." }
                ]
            }
        ]
    });

    return cleanJson(getSafeText(response));
};

export const analyzeProposalsImage = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: {
            systemInstruction: `Распознай список КП. Верни JSON объект с ключами "РТИ" и "3D" (массивы).
            Для каждого КП: date (YYYY-MM-DD), company, item, amount (число), status.`
        },
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
        config: { systemInstruction: "Извлеки таблицу кампаний. Верни массив JSON объектов: [{ name, status, spend }]." },
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
        config: { systemInstruction: "Проанализируй счет. Верни JSON: { serviceName, amount (число), currency, paymentPeriod, lastPaymentDate, paymentDetails, paymentMethod }." },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64Data } }, { text: "Данные платежа" }] }]
    });

    return JSON.parse(cleanJson(getSafeText(response)));
};

export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });
    
    try {
        const response = await client.models.generateContent({
            model: "models/gemini-2.0-flash-exp",
            config: { systemInstruction: "Ты аналитик данных. Найди аномалии или тренды в данных JSON." },
            contents: [{ role: "user", parts: [{ text: `Analyze briefly: ${JSON.stringify(reports.slice(-5))}` }] }]
        });
        return getSafeText(response) || "Данных недостаточно для анализа.";
    } catch (e) {
        console.error("Error analyzing consistency:", e);
        return "Не удалось провести анализ данных.";
    }
};

// --- ГЛАВНАЯ ФУНКЦИЯ ТЕКСТОВОГО ЧАТА ---
export const getAIAssistantResponse = async (
    prompt: string, 
    userData: UserData, 
    systemInstruction: string,
    fileData?: { mimeType: string, base64: string }, // Опциональный файл
    history: Array<{ role: string, parts: any[] }> = [] // Добавлена поддержка истории чата!
) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const client = new GoogleGenAI({ apiKey });
    
    try {
        // Собираем текущий запрос (текст + возможный файл)
        const currentParts: any[] = [];
        
        if (fileData) {
            currentParts.push({
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.base64
                }
            });
        }
        
        currentParts.push({ text: prompt });

        // Формируем полный контент запроса с учетом истории
        // Мы берем историю (если есть) и добавляем в конец текущее сообщение
        const contents = [
            ...history, 
            { role: "user", parts: currentParts }
        ];

        const response = await client.models.generateContent({
            model: "models/gemini-2.0-flash-exp",
            config: {
                systemInstruction: { parts: [{ text: systemInstruction }] },
                tools: [{ googleSearch: {} }], // Поиск в интернете
                generationConfig: {
                    maxOutputTokens: 4000, // Увеличили для длинных текстов (статьи, письма)
                    temperature: 0.7 // Оптимально для "интересного собеседника" и креатива
                }
            },
            contents: contents
        });

        const text = getSafeText(response);
        if (!text) return { text: "Извините, не удалось получить ответ от сервиса.", functionCall: null };
        return { text: text, functionCall: null };
        
    } catch (error: any) {
        console.error("GEMINI ERROR:", error);
        return { text: "Произошла ошибка при обращении к ИИ.", functionCall: null };
    }
};
