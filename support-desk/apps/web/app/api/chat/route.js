import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getRedisClient } from '@/lib/redisClient';
import { agentToolDefinitions, executeAgentTool } from '@/lib/agentTools';

// Groq's API is OpenAI-compatible, so the OpenAI SDK works unchanged
// against it — just a different base URL, key, and model. Using Groq's
// free tier here instead of a paid OpenAI key.
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const CHAT_MODEL = process.env.CHAT_MODEL || 'openai/gpt-oss-120b';
const CHAT_HISTORY_LIMIT = Number(process.env.CHAT_HISTORY_LIMIT) || 50;
const MAX_TOOL_ITERATIONS = 4;
const RATE_LIMIT_MAX = 15;
const RATE_LIMIT_WINDOW_SECONDS = 600;

function getChatHistoryKey(sessionId) {
  return `chat:messages:${sessionId}`;
}

function getRateLimitKey(sessionId) {
  return `ratelimit:chat:${sessionId}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const userMessage = body?.message;

    // Public widget — visitors have no account. The chat page generates a
    // random id per browser (kept in localStorage) so history/rate-limits
    // are per-visitor without requiring a login.
    const sessionId = request.headers.get('x-session-id');

    if (!sessionId) {
      return NextResponse.json({ error: 'Missing session id' }, { status: 400 });
    }

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const chatHistoryKey = getChatHistoryKey(sessionId);
    const redis = await getRedisClient();

    // Cheap protection on a now-public endpoint sitting in front of a paid API key.
    try {
      const rateLimitKey = getRateLimitKey(sessionId);
      const count = await redis.incr(rateLimitKey);
      if (count === 1) {
        await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW_SECONDS);
      }
      if (count > RATE_LIMIT_MAX) {
        return NextResponse.json(
          { error: 'Too many messages — please wait a few minutes and try again.' },
          { status: 429 }
        );
      }
    } catch (err) {
      console.error('Rate limit check failed:', err);
    }

    let history = [];
    try {
      const rawMessages = await redis.lRange(chatHistoryKey, -10, -1);
      history = rawMessages
        .map((m) => { try { return JSON.parse(m); } catch { return null; } })
        .filter(Boolean);
    } catch (err) {
      console.error('Failed to read chat history from Redis:', err);
    }

    const historyMessages = history.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const messages = [
      {
        role: 'system',
        content:
          'You are the AI assistant for Zeybek Hukuk Bürosu, a law firm in İzmit, Turkey. Be concise and helpful.\n\n' +
          'LANGUAGE RULE (follow this exactly): Always reply in the same language the visitor just wrote their message in. ' +
          'If they write in English, your ENTIRE reply must be in English — do not switch to Turkish, even though the knowledge base ' +
          'and legal terms (e.g. "İş Hukuku") are written in Turkish. Translate any Turkish terms into English yourself when replying ' +
          'to an English-speaking visitor. The firm\'s content is bilingual; match the visitor, not the source material.\n\n' +
          'Always use search_knowledge_base before answering a factual question about the firm — never guess at facts like contact info, hours, or practice areas. ' +
          "If the knowledge base doesn't confidently answer the visitor's question (e.g. case-specific legal advice, pricing for their situation), " +
          'use submit_support_ticket to hand off to a human, and tell the visitor someone will follow up. ' +
          'Use check_ticket_status if the visitor asks about a ticket they already submitted and gives you a ticket ID.',
      },
      ...historyMessages,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    let assistantMessage;

    try {
      for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
        const completion = await openai.chat.completions.create({
          model: CHAT_MODEL,
          messages,
          tools: agentToolDefinitions,
          tool_choice: 'auto',
        });

        const responseMessage = completion.choices[0]?.message;
        const toolCalls = responseMessage?.tool_calls;

        if (!toolCalls || toolCalls.length === 0) {
          assistantMessage =
            responseMessage?.content || "I'm having trouble generating a proper response right now.";
          break;
        }

        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
          let args = {};
          try {
            args = JSON.parse(toolCall.function.arguments || '{}');
          } catch {
            args = {};
          }

          const result = await executeAgentTool(toolCall.function.name, args, { sessionId });

          messages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          });
        }

        if (iteration === MAX_TOOL_ITERATIONS - 1) {
          assistantMessage = "I'm still working on that — could you try asking again in a moment?";
        }
      }
    } catch (err) {
      const requestId = request.headers.get("x-request-id") || "unknown";
      console.error(`[OpenAI error] id=${requestId}:`, err);

      if (err?.status === 429 || err?.code === "insufficient_quota") {
        assistantMessage =
          "The AI service has reached its current quota, so this is a simulated response. " +
          "In a real production environment, this message would come from the OpenAI API.";
      } else {
        assistantMessage =
          "Something went wrong while contacting the AI service. This is a fallback response.";
      }
    }

    const toStore = [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantMessage },
    ];

    try {
      for (const msg of toStore) {
        await redis.rPush(chatHistoryKey, JSON.stringify(msg));
      }
      await redis.lTrim(chatHistoryKey, -CHAT_HISTORY_LIMIT, -1);
    } catch (err) {
      console.error('Failed to write chat history to Redis:', err);
    }

    return NextResponse.json({
      reply: assistantMessage,
    });
  } catch (error) {
    const requestId = request.headers.get("x-request-id") || "unknown";
    console.error(`[Error] id=${requestId} in /api/chat:`, error);

    return NextResponse.json(
      { error: "Internal server error", requestId },
      { status: 500 }
    );
  }
}
