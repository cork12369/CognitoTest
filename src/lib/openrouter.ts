export type ChatMessage = { role: "system" | "user"; content: string };

const DEFAULT_BASE_URL = "https://174.138.16.223/openrouter/v1";
const DEFAULT_CHAT_MODEL = "openai/gpt-4o-mini";
const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";

function config() {
    const apiKey = process.env.CLASSGW_KEY || process.env.AI_GATEWAY_API_KEY;
    const baseUrl = process.env.CLASSGW_BASE_URL || process.env.AI_GATEWAY_BASE_URL || DEFAULT_BASE_URL;
    return {
        apiKey: apiKey?.startsWith("YOUR_") ? undefined : apiKey,
        baseUrl: baseUrl.replace(/\/$/, ""),
        chatModel: process.env.AI_MODEL || DEFAULT_CHAT_MODEL,
        embeddingModel: process.env.AI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
    };
}

async function request<T>(path: string, body: Record<string, unknown>) {
    const { apiKey, baseUrl } = config();
    if (!apiKey) return null;
    const response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`OpenRouter request failed with ${response.status}`);
    return response.json() as Promise<T>;
}

export async function requestChat(messages: ChatMessage[]) {
    const { chatModel } = config();
    const payload = await request<{ choices?: Array<{ message?: { content?: string } }> }>("/chat/completions", {
        model: chatModel,
        messages,
        temperature: 0.15,
        response_format: { type: "json_object" },
    });
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
}

export async function requestEmbeddings(inputs: string[]) {
    const { embeddingModel } = config();
    const payload = await request<{ data?: Array<{ embedding?: number[]; index?: number }> }>("/embeddings", {
        model: embeddingModel,
        input: inputs,
    });
    if (!payload?.data) return null;
    const vectors = [...payload.data]
        .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
        .map((item) => item.embedding);
    return vectors.every((vector): vector is number[] => Array.isArray(vector) && vector.length > 0) ? vectors : null;
}