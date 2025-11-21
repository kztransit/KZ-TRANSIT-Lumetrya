import { GoogleGenAI, Type, Modality, FunctionDeclaration } from "@google/genai";
import { CommercialProposal, AdCampaign, Report, Payment } from '../types';

// Assume API_key is set in the environment variables
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

if (!API_KEY) {
  console.warn("Gemini API key not found. AI Assistant will not work.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY! });

export const navigationFunctionDeclaration: FunctionDeclaration = {
  name: 'navigateToPage',
  description: 'Переходит на указанную страницу в приложении.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      page: {
        type: Type.STRING,
        description: 'Путь к странице. Например: /dashboard, /reports, /proposals, /settings.',
        enum: [
            '/dashboard', 
            '/reports', 
            '/other-reports',
            '/proposals', 
            '/compare', 
            '/conversions', 
            '/net-conversions', 
            '/campaigns', 
            '/unit-economics', 
            '/payments', 
            '/storage', 
            '/settings'
        ],
      },
    },
    required: ['page'],
  },
};

export const createOtherReportFunctionDeclaration: FunctionDeclaration = {
    name: 'createOtherReport',
    description: 'Создает новый "другой отчет" (например, по складу, HR).',
    parameters: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: 'Название отчета.' },
            date: { type: Type.STRING, description: 'Дата отчета в формате YYYY-MM-DD. Если не указана, использовать сегодняшнюю.' },
            category: { type: Type.STRING, description: 'Категория отчета (Склад, Логистика, HR, Производство, Другое).' },
            kpis: {
                type: Type.ARRAY,
                description: 'Список ключевых показателей.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'Название KPI.' },
                        value: { type: Type.STRING, description: 'Значение KPI.' },
                    },
                    required: ['name', 'value'],
                },
            },
        },
        required: ['name', 'category', 'kpis'],
    },
};

export const updateOtherReportKpiFunctionDeclaration: FunctionDeclaration = {
    name: 'updateOtherReportKpi',
    description: 'Обновляет значение KPI в существующем "другом отчете".',
    parameters: {
        type: Type.OBJECT,
        properties: {
            reportName: { type: Type.STRING, description: 'Название отчета, который нужно обновить.' },
            kpiName: { type: Type.STRING, description: 'Название KPI, которое нужно обновить.' },
            newValue: { type: Type.STRING, description: 'Новое значение для KPI.' },
        },
        required: ['reportName', 'kpiName', 'newValue'],
    },
};

export const createCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'createCommercialProposal',
    description: 'Создает новое коммерческое предложение (КП).',
    parameters: {
        type: Type.OBJECT,
        properties: {
            company: { type: Type.STRING, description: 'Название компании клиента.' },
            item: { type: Type.STRING, description: 'Наименование товара/услуги.' },
            amount: { type: Type.NUMBER, description: 'Сумма КП.' },
            direction: { type: Type.STRING, description: 'Направление (РТИ или 3D).', enum: ['РТИ', '3D'] },
            date: { type: Type.STRING, description: 'Дата КП в формате YYYY-MM-DD. Если не указана, использовать сегодняшнюю.' },
        },
        required: ['company', 'item', 'amount', 'direction'],
    },
};

export const updateCommercialProposalFunctionDeclaration: FunctionDeclaration = {
    name: 'updateCommercialProposal',
    description: 'Обновляет существующее коммерческое предложение (КП).',
    parameters: {
        type: Type.OBJECT,
        properties: {
            company: { type: Type.STRING, description: 'Название компании клиента, чье КП нужно обновить.' },
            fieldToUpdate: { type: Type.STRING, description: 'Поле для обновления.', enum: ['status', 'amount', 'paymentDate'] },
            newValue: { type: Type.STRING, description: 'Новое значение для поля. Для статуса: Оплачено, Ожидание, Отменено. Для даты: YYYY-MM-DD.' },
        },
        required: ['company', 'fieldToUpdate', 'newValue'],
    },
};

export const getAIAssistantResponse = async (
    query: string, 
    contextData: any, 
    systemInstruction: string
): Promise<{ text: string; functionCall: { name: string; args: any } | null }> => {
    if (!API_KEY) {
        return { text: "Ошибка: Ключ API для Gemini не настроен. AI-помощник не может работать.", functionCall: null };
    }

    const model = "gemini-2.5-flash";
    const contextString = JSON.stringify({
      proposals: contextData.proposals.slice(0, 20),
      otherReports: contextData.otherReports.slice(0, 20),
      reports: contextData.reports.slice(0, 5).map((r: Report) => ({name: r.name, metrics: r.metrics})),
    }, null, 2);


    const fullPrompt = `
      ${systemInstruction}

      **Контекст (данные из системы для анализа):**
      \`\`\`json
      ${contextString}
      \`\`\`

      **Запрос пользователя:**
      "${query}"
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
            config: {
                tools: [{functionDeclarations: [
                    navigationFunctionDeclaration,
                    createOtherReportFunctionDeclaration,
                    updateOtherReportKpiFunctionDeclaration,
                    createCommercialProposalFunctionDeclaration,
                    updateCommercialProposalFunctionDeclaration,
                ]}],
            }
        });
        
        const functionCall = response.functionCalls?.[0] || null;
        const text = response.text.replace(/```/g, '').trim();

        if (functionCall) {
            return {
                text: text || `Выполняю команду...`, // Provide fallback text
                functionCall: {
                    name: functionCall.name,
                    args: functionCall.args as any
                }
            };
        }

        return { text, functionCall: null };

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        let errorMessage = "Произошла неизвестная ошибка при обращении к AI.";
        if (error instanceof Error) {
            errorMessage = `Произошла ошибка при обращении к AI: ${error.message}`;
        }
        return { text: errorMessage, functionCall: null };
    }
};

export const analyzeReportImage = async (mimeType: string, base64Data: string): Promise<string> => {
    if (!API_KEY) {
        throw new Error("Ошибка: Ключ API для Gemini не настроен.");
    }

    const model = "gemini-2.5-flash";
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };
    
    const textPart = {
      text: `
        Проанализируй это изображение отчета по маркетингу. На изображении могут быть данные для двух направлений: "РТИ" и "3D".
        **Важно: извлекай данные только из колонки с названием текущего месяца (например, 'Январь'). Полностью игнорируй колонки "Прошлый месяц", "Цена" и "Цена за прошлый месяц".**

        Извлеки следующие числовые значения для каждого направления:
        - Бюджет (budget)
        - Клики (clicks)
        - Лиды (leads)
        - КП (proposals)
        - Счета (invoices)
        - Реализованные (deals)
        - Сумма / Выручка (sales)

        Верни ответ ИСКЛЮЧИТЕЛЬНО в формате JSON-объекта, который соответствует предоставленной схеме. Объект должен содержать ключи "РТИ" и "3D". Если какое-то направление отсутствует на картинке или для него нет данных, верни для него пустой объект со значениями по умолчанию (0).
        Если какое-то значение не найдено, установи его в 0.
      `,
    };

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        "РТИ": {
                            type: Type.OBJECT,
                            properties: {
                                budget: { type: Type.NUMBER },
                                clicks: { type: Type.NUMBER },
                                leads: { type: Type.NUMBER },
                                proposals: { type: Type.NUMBER },
                                invoices: { type: Type.NUMBER },
                                deals: { type: Type.NUMBER },
                                sales: { type: Type.NUMBER },
                            }
                        },
                        "3D": {
                            type: Type.OBJECT,
                            properties: {
                                budget: { type: Type.NUMBER },
                                clicks: { type: Type.NUMBER },
                                leads: { type: Type.NUMBER },
                                proposals: { type: Type.NUMBER },
                                invoices: { type: Type.NUMBER },
                                deals: { type: Type.NUMBER },
                                sales: { type: Type.NUMBER },
                            }
                        }
                    },
                    required: ["РТИ", "3D"],
                }
            }
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini Vision API:", error);
        if (error instanceof Error) {
            throw new Error(`Произошла ошибка при анализе изображения: ${error.message}`);
        }
        throw new Error("Произошла неизвестная ошибка при анализе изображения.");
    }
};

export const analyzeProposalsImage = async (
    mimeType: string, 
    base64Data: string, 
    direction?: 'РТИ' | '3D'
): Promise<{
    "РТИ": Partial<CommercialProposal>[],
    "3D": Partial<CommercialProposal>[]
}> => {
    if (!API_KEY) {
        throw new Error("Ошибка: Ключ API для Gemini не настроен.");
    }
    const model = "gemini-2.5-flash";

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    let promptText: string;

    if (direction) {
        promptText = `
        Проанализируй это изображение с таблицей коммерческих предложений (КП) или счетов.
        Все предложения в этой таблице относятся к направлению "${direction}". Если ты не видишь явного разделения на секции "РТИ" или "3D", считай, что все найденные строки принадлежат к "${direction}".

        Твоя задача - извлечь данные для каждой строки.

        Поля для извлечения для каждого КП:
        - date: Дата документа (YYYY-MM-DD)
        - item: Наименование товара/услуги
        - company: Название компании клиента
        - amount: Сумма (только число)
        - invoiceNumber: Номер счета
        - invoiceDate: Дата счета (YYYY-MM-DD)
        - paymentDate: Дата оплаты (YYYY-MM-DD)

        Верни ответ ИСКЛЮЧИТЕЛЬНО в формате JSON-объекта с двумя ключами: "РТИ" и "3D".
        Ключ "${direction}" должен содержать массив объектов, где каждый объект представляет одно КП.
        Другой ключ ("${direction === 'РТИ' ? '3D' : 'РТИ'}") должен содержать пустой массив.
        Если какое-то значение не найдено в строке, установи его в null.
        Если в таблице нет данных, верни пустые массивы для обоих ключей.
        Пример, если direction="3D":
        {
          "РТИ": [],
          "3D": [
            { "date": "2023-01-20", "item": "Печать модели", "company": "ИП Петров", "amount": 25000, "invoiceNumber": "124" }
          ]
        }
      `;
    } else {
        promptText = `
        Проанализируй это изображение с таблицей или таблицами коммерческих предложений (КП) или счетов.
        На изображении могут быть два отдельных раздела: "РТИ" и "3D".
        Твоя задача - извлечь данные для каждой строки из каждого раздела.

        Поля для извлечения для каждого КП:
        - date: Дата документа (YYYY-MM-DD)
        - item: Наименование товара/услуги
        - company: Название компании клиента
        - amount: Сумма (только число)
        - invoiceNumber: Номер счета
        - invoiceDate: Дата счета (YYYY-MM-DD)
        - paymentDate: Дата оплаты (YYYY-MM-DD)

        Верни ответ ИСКЛЮЧИТЕЛЬНО в формате JSON-объекта с двумя ключами: "РТИ" и "3D".
        Каждый ключ должен содержать массив объектов, где каждый объект представляет одно КП из соответствующего раздела.
        Если какой-то раздел отсутствует на картинке, верни для него пустой массив.
        Если какое-то значение не найдено в строке, установи его в null.
        Пример:
        {
          "РТИ": [
            { "date": "2023-01-15", "item": "Прокладка резиновая", "company": "ООО Ромашка", "amount": 15000, "invoiceNumber": "123" }
          ],
          "3D": [
            { "date": "2023-01-20", "item": "Печать модели", "company": "ИП Петров", "amount": 25000, "invoiceNumber": "124" }
          ]
        }
      `;
    }

    const textPart = { text: promptText };
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        "РТИ": {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    date: { type: Type.STRING, description: 'Дата документа в формате YYYY-MM-DD' },
                                    item: { type: Type.STRING },
                                    company: { type: Type.STRING, nullable: true },
                                    amount: { type: Type.NUMBER },
                                    invoiceNumber: { type: Type.STRING, nullable: true },
                                    invoiceDate: { type: Type.STRING, nullable: true, description: 'Дата счета в формате YYYY-MM-DD' },
                                    paymentDate: { type: Type.STRING, nullable: true, description: 'Дата оплаты в формате YYYY-MM-DD' },
                                }
                            }
                        },
                        "3D": {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    date: { type: Type.STRING, description: 'Дата документа в формате YYYY-MM-DD' },
                                    item: { type: Type.STRING },
                                    company: { type: Type.STRING, nullable: true },
                                    amount: { type: Type.NUMBER },
                                    invoiceNumber: { type: Type.STRING, nullable: true },
                                    invoiceDate: { type: Type.STRING, nullable: true, description: 'Дата счета в формате YYYY-MM-DD' },
                                    paymentDate: { type: Type.STRING, nullable: true, description: 'Дата оплаты в формате YYYY-MM-DD' },
                                }
                            }
                        }
                    },
                    required: ["РТИ", "3D"],
                }
            }
        });
        
        const jsonStr = response.text.trim();
        const parsedData = JSON.parse(jsonStr);
        
        return {
            "РТИ": Array.isArray(parsedData["РТИ"]) ? parsedData["РТИ"] : [],
            "3D": Array.isArray(parsedData["3D"]) ? parsedData["3D"] : []
        };

    } catch (error) {
        console.error("Error calling Gemini Vision API for proposals:", error);
        if (error instanceof Error) {
            throw new Error(`Произошла ошибка при анализе изображения: ${error.message}`);
        }
        throw new Error("Произошла неизвестная ошибка при анализе изображения.");
    }
};

export const analyzeCampaignsImage = async (mimeType: string, base64Data: string): Promise<Partial<AdCampaign>[]> => {
    if (!API_KEY) {
        throw new Error("Ошибка: Ключ API для Gemini не настроен.");
    }
    const model = "gemini-2.5-flash";

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };

    const textPart = {
        text: `
        Проанализируй это изображение или PDF-документ с таблицей из Google Ads. Извлеки данные для каждой строки кампании.
        Поля для извлечения:
        - name: Название кампании
        - status: Статус (например, 'Включено', 'Приостановлено')
        - type: Тип кампании. Определи его как 'Поиск' или 'Максимальная эффективность'. Если тип не указан явно, попробуй определить его по названию или другим признакам.
        - budget: Бюджет (только число)
        - impressions: Показы
        - clicks: Клики
        - ctr: CTR (в процентах, только число)
        - spend: Расходы
        - conversions: Конверсии
        - cpc: Цена за клик (СРС)

        Верни ответ ИСКЛЮЧИТЕЛЬНО в формате JSON-массива объектов. Каждый объект представляет одну кампанию.
        Если числовое значение не найдено, установи его в 0. Если текстовое - в 'N/A'.
      `,
    };
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            status: { type: Type.STRING },
                            type: { type: Type.STRING },
                            budget: { type: Type.NUMBER },
                            impressions: { type: Type.NUMBER },
                            clicks: { type: Type.NUMBER },
                            ctr: { type: Type.NUMBER },
                            spend: { type: Type.NUMBER },
                            conversions: { type: Type.NUMBER },
                            cpc: { type: Type.NUMBER },
                        }
                    }
                }
            }
        });
        
        const jsonStr = response.text.trim();
        const parsedData = JSON.parse(jsonStr);
        return Array.isArray(parsedData) ? parsedData : [];

    } catch (error) {
        console.error("Error calling Gemini Vision API for campaigns:", error);
        if (error instanceof Error) {
            throw new Error(`Произошла ошибка при анализе изображения: ${error.message}`);
        }
        throw new Error("Произошла неизвестная ошибка при анализе изображения.");
    }
};

export const analyzePaymentInvoice = async (mimeType: string, base64Data: string): Promise<Partial<Payment>> => {
    if (!API_KEY) {
        throw new Error("Ошибка: Ключ API для Gemini не настроен.");
    }
    const model = "gemini-2.5-flash";

    const imagePart = {
        inlineData: { mimeType, data: base64Data },
    };

    const textPart = {
        text: `
        Проанализируй этот инвойс или чек на оплату сервиса.
        Извлеки следующие данные:
        - serviceName: Название сервиса или поставщика.
        - lastPaymentDate: Дата инвойса или платежа (в формате YYYY-MM-DD).
        - amount: Итоговая сумма платежа (только число).
        - currency: Валюта платежа (KZT, USD, или RUB).
        - paymentPeriod: Период оплаты ('monthly' или 'yearly'). Если не указан, используй 'onetime'.

        Верни ответ ИСКЛЮЧИТЕЛЬНО в формате JSON-объекта. Если какое-то значение не найдено, установи для него null (для строк) или 0 (для чисел).
      `,
    };
    
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: { parts: [imagePart, textPart] },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        serviceName: { type: Type.STRING, nullable: true },
                        lastPaymentDate: { type: Type.STRING, nullable: true },
                        amount: { type: Type.NUMBER, nullable: true },
                        currency: { type: Type.STRING, nullable: true },
                        paymentPeriod: { type: Type.STRING, nullable: true },
                    },
                }
            }
        });
        
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr) as Partial<Payment>;

    } catch (error) {
        console.error("Error calling Gemini Vision API for payment invoice:", error);
        if (error instanceof Error) {
            throw new Error(`Произошла ошибка при анализе инвойса: ${error.message}`);
        }
        throw new Error("Произошла неизвестная ошибка при анализе инвойса.");
    }
};


export const analyzeDataConsistency = async (reports: Report[]): Promise<string> => {
    if (!API_KEY) {
        return "Ошибка: Ключ API для Gemini не настроен.";
    }
    if (reports.length === 0) {
        return "Нет данных для анализа. Пожалуйста, выберите период, содержащий отчеты.";
    }

    const model = "gemini-2.5-flash";
    const contextString = JSON.stringify(reports.map(r => ({name: r.name, metrics: r.metrics, directions: r.directions})), null, 2);

    const fullPrompt = `
      Ты — AI-ассистент-аналитик для платформы "Lumetrya". Твоя задача — проанализировать JSON-массив данных по маркетинговым отчетам и выявить потенциальные проблемы, ошибки или аномалии.

      **Данные для анализа:**
      \`\`\`json
      ${contextString}
      \`\`\`

      **Строгие правила вывода:**
      1.  **Формат:** Ответ должен быть представлен в виде чистого, структурированного текста.
      2.  **Без Markdown:** **ЗАПРЕЩЕНО** использовать любое markdown-форматирование (например, \`*\`, \`-\`, \`###\`, \`**\`, \`\`\`).
      3.  **Структура:** Группируй найденные проблемы по категориям (например, "Логические аномалии:", "Математические несостыковки:"). Каждое отдельное наблюдение должно начинаться с новой строки.
      4.  **Четкость и краткость:** Формулируй выводы максимально четко, по существу, без лишних слов и "воды".
      5.  **Надежность:** Анализ должен основываться **ИСКЛЮЧИТЕЛЬНО** на предоставленных данных. Не делай предположений и не придумывай информацию.
      6.  **Язык:** Ответ должен быть только на русском языке.
      7.  **Нет проблем:** Если анализ завершен и критических проблем не обнаружено, выведи только одну фразу: "Анализ завершен, критических проблем не обнаружено."

      **План анализа:**
      1.  **Математические несостыковки:** Проверь логику воронки продаж (например, сделок > лидов, лидов > кликов).
      2.  **Логические аномалии:**
          *   Найди отчеты за разные периоды с абсолютно идентичными ненулевыми показателями (укажи, какие отчеты и данные совпадают).
          *   Обрати внимание на странные соотношения (например, большой бюджет и 0 кликов, много кликов и 0 лидов).
      3.  **Значительные отклонения:** Сравни последовательные периоды и укажи на резкие скачки или падения ключевых метрик.
    `;

    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: fullPrompt,
        });
        return response.text.trim();
    } catch (error) {
        console.error("Error calling Gemini API for data analysis:", error);
        return "Произошла ошибка при анализе данных.";
    }
};
