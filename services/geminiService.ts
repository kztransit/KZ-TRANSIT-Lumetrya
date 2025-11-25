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

const assistantSystemInstruction = `
Ты — Lumi, быстрый и дружелюбный ассистент. Твои ответы краткие, но живые и полезные: не более 5-7 предложений, структурируй текст пунктами, если это ускоряет чтение. Всегда предлагай следующий шаг или варианты решения.

Ключевые навыки:
- Помогаешь с продажами: формируешь офферы, УТП, письма, скрипты, рекламные тексты и идеи.
- Умеешь делать расчеты (маркетинг, unit economics, воронка), приводишь формулы и итоговые числа.
- Анализируешь загруженные данные и контекст пользователя, быстро находишь нужные значения.
- Сохраняешь и используешь историю диалога: опирайся на предыдущее общение и новые данные в каждом ответе.

Интернет-поиск:
- Используй googleSearch, если не хватает актуальных фактов или нужна свежая информация. Всегда кратко излагай найденное и указывай, что искал.

Тон общения: дружелюбный, деловой, проактивный; избегай «воду», отвечай по делу.`;

const buildAssistantInstruction = (systemInstruction: string, userData: UserData): string => {
    const serializedUserData = JSON.stringify(userData || {});
    return `${assistantSystemInstruction}\n\nБизнес-контекст пользователя (делись коротко в ответах): ${systemInstruction}\n\nДанные системы для анализа: ${serializedUserData}`;
};

// --- АНАЛИЗ ФАЙЛОВ И ДАННЫХ ---

export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");

    const client = new GoogleGenAI({ apiKey });

    // УСИЛЕННЫЙ ПРОМПТ: Четко различаем деньги (sales) и количество (deals)
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
                    { text: "Извлеки данные из этого отчета." }
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

// Функция для произвольного анализа документа (без JSON формата)
export const analyzeGeneralDocument = async (mimeType: string, base64Data: string, prompt: string = "Проанализируй этот документ"): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const client = new GoogleGenAI({ apiKey });

    const response = await client.models.generateContent({
        model: "models/gemini-2.0-flash-exp",
        config: {
            // Инструкция на чистый текст и анализ
            systemInstruction: "Ты — профессиональный ассистент. Проанализируй документ. Отвечай на русском. Не используй Markdown символы. Будь краток и полезен."
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
    history: Array<{ role: string, parts: any[] }> = [] // Поддержка истории
) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");

    const client = new GoogleGenAI({ apiKey });

    try {
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

        // Формируем историю для контекста
        const contents = [
            ...history,
            { role: "user", parts: currentParts }
        ];

        const combinedSystemInstruction = buildAssistantInstruction(systemInstruction, userData);

        const response = await client.models.generateContent({
            model: "models/gemini-2.0-flash-exp",
            config: {
                systemInstruction: { parts: [{ text: combinedSystemInstruction }] },
                // Подключаем поиск в интернете
                tools: [{ googleSearch: {} }],
                generationConfig: {
                    maxOutputTokens: 4000, // Больше токенов для длинных ответов (письма, статьи)
                    temperature: 0.7 // Интересный собеседник
                }
            },
            contents: contents
        });

        const text = getSafeText(response);
        if (!text) return { text: "Нет ответа от сервиса.", functionCall: null };
        return { text: text, functionCall: null };

    } catch (error: any) {
        console.error("GEMINI ERROR:", error);
        return { text: "Произошла ошибка при обращении к ИИ.", functionCall: null };
    }
};
