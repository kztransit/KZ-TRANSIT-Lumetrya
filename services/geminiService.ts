import { GoogleGenAI, FunctionDeclaration, SchemaType } from "@google/genai";
import { UserData } from "../types";

// --- ОПРЕДЕЛЕНИЕ ФУНКЦИЙ (ИНСТРУМЕНТОВ) ---

export const navigationFunctionDeclaration: FunctionDeclaration = {
    name: 'navigateToPage',
    description: 'Переходит на указанную страницу в приложении (навигация).',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            page: {
                type: SchemaType.STRING,
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
        type: SchemaType.OBJECT,
        properties: {
            company: { type: SchemaType.STRING, description: 'Название компании клиента' },
            item: { type: SchemaType.STRING, description: 'Товар или услуга' },
            amount: { type: SchemaType.NUMBER, description: 'Сумма в тенге' },
            direction: { type: SchemaType.STRING, description: 'Направление: РТИ или 3D', enum: ['РТИ', '3D'] },
            date: { type: SchemaType.STRING, description: 'Дата создания (YYYY-MM-DD)' }
        },
        required: ['company', 'item', 'amount']
    }
};

export const createOtherReportFunctionDeclaration: FunctionDeclaration = {
    name: 'createOtherReport',
    description: 'Создает прочий/нестандартный отчет с KPI.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            name: { type: SchemaType.STRING, description: 'Название отчета' },
            category: { type: SchemaType.STRING, description: 'Категория' },
            date: { type: SchemaType.STRING, description: 'Дата' },
            kpis: {
                type: SchemaType.ARRAY,
                items: {
                    type: SchemaType.OBJECT,
                    properties: {
                        name: { type: SchemaType.STRING },
                        value: { type: SchemaType.STRING }
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
        type: SchemaType.OBJECT,
        properties: {
            reportName: { type: SchemaType.STRING },
            kpiName: { type: SchemaType.STRING },
            newValue: { type: SchemaType.STRING }
        },
        required: ['reportName', 'kpiName', 'newValue']
    }
};

export const updateCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'updateCommercialProposal',
    description: 'Обновляет поле в существующем КП.',
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            company: { type: SchemaType.STRING, description: 'Название компании' },
            fieldToUpdate: { type: SchemaType.STRING, enum: ['status', 'amount', 'item'] },
            newValue: { type: SchemaType.STRING } // Для упрощения передаем как строку, конвертируем на месте
        },
        required: ['company', 'fieldToUpdate', 'newValue']
    }
};

// --- ФУНКЦИИ АНАЛИЗА ФАЙЛОВ (Оставляем как есть) ---
export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const genAI = new GoogleGenAI({ apiKey });
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: "Ты аналитик данных. Твоя задача — извлечь данные из изображения маркетингового отчета и вернуть их СТРОГО в формате JSON. Структура JSON должна быть: { 'РТИ': { budget, clicks, leads, proposals, invoices, deals, sales }, '3D': { ...те же поля... } }. Если каких-то данных нет, ставь 0. Не пиши ничего кроме JSON."
    });

    const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Data } },
        { text: "Извлеки данные из этого отчета." }
    ]);
    
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return text;
};

export const analyzeProposalsImage = async (mimeType: string, base64Data: string, context?: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const genAI = new GoogleGenAI({ apiKey });
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: "Извлеки данные о коммерческих предложениях из изображения. Верни JSON объект с ключами 'РТИ' и '3D', внутри массивы объектов: { date, company, item, amount, invoiceNumber, invoiceDate, paymentDate }. Даты в формате YYYY-MM-DD. Если направление не понятно, определи по контексту или помести в 'РТИ'."
    });

    const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Data } },
        { text: "Извлеки список КП." }
    ]);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
};

export const analyzeCampaignsImage = async (mimeType: string, base64Data: string): Promise<any[]> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const genAI = new GoogleGenAI({ apiKey });
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: "Извлеки данные рекламных кампаний. Верни массив JSON: [{ name, status, type, budget, impressions, clicks, ctr, spend, conversions, cpc }]. Status: Включено/Приостановлено. Type: Поиск/Максимальная эффективность."
    });

    const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Data } },
        { text: "Извлеки таблицу кампаний." }
    ]);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
};

export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<any> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const genAI = new GoogleGenAI({ apiKey });
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: "Проанализируй счет на оплату/инвойс. Верни JSON: { serviceName, amount, currency (KZT/USD/RUB), paymentPeriod (monthly/yearly), lastPaymentDate (YYYY-MM-DD), paymentDetails, paymentMethod (Карта/Безнал) }."
    });

    const result = await model.generateContent([
        { inlineData: { mimeType, data: base64Data } },
        { text: "Извлеки данные платежа." }
    ]);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(text);
};

export const analyzeDataConsistency = async (reports: any[]): Promise<string> => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    const genAI = new GoogleGenAI({ apiKey });
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

    const prompt = `Проанализируй эти маркетинговые отчеты на предмет аномалий, ошибок и трендов. Дай краткое резюме на русском языке. Данные: ${JSON.stringify(reports.slice(-5))}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
};

// --- ГЛАВНАЯ ФУНКЦИЯ ТЕКСТОВОГО ЧАТА ---
// Теперь она поддерживает интернет и инструменты!
export const getAIAssistantResponse = async (prompt: string, userData: UserData, systemInstruction: string) => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    
    const genAI = new GoogleGenAI({ apiKey });
    
    // Используем ту же мощную модель
    const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: systemInstruction, // Сюда придет "Умный контекст" из страницы
        tools: [
            { googleSearch: {} }, // ВКЛЮЧАЕМ ИНТЕРНЕТ
            { functionDeclarations: [
                navigationFunctionDeclaration,
                createOtherReportFunctionDeclaration,
                updateOtherReportKpiFunctionDeclaration,
                createCommercialProposalFunctionDeclaration,
                updateCommercialProposalFunctionDeclaration
            ]}
        ]
    });

    // Отправляем историю и промпт
    const chat = model.startChat({
        history: [], // В будущем можно добавить историю переписки
    });

    const result = await chat.sendMessage(prompt);
    const response = result.response;
    
    // Обработка вызова функций
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
        return { text: null, functionCall: functionCalls[0] }; // Возвращаем первый вызов функции
    }

    return { text: response.text(), functionCall: null };
};
