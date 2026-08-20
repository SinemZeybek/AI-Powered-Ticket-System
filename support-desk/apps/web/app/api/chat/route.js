import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { getRedisClient } from '@/lib/redisClient';
import { supabase } from '@/lib/supabaseClient';
import { agentToolDefinitions, executeAgentTool } from '@/lib/agentTools';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'gpt-4o-mini';
const CHAT_HISTORY_LIMIT = Number(process.env.CHAT_HISTORY_LIMIT) || 50;
const MAX_TOOL_ITERATIONS = 4;

function getChatHistoryKey(userId) {
  return `chat:messages:${userId}`;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const userMessage = body?.message;

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Authenticate user so chat history is per-user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const chatHistoryKey = getChatHistoryKey(user.id);
    const redis = await getRedisClient();

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
          'You are an AI assistant inside a Next.js + Supabase todo/support application. Be concise and helpful. ' +
          'Use the search_knowledge_base tool to answer questions about how the app works instead of guessing. ' +
          'Use submit_support_ticket when the user describes a problem or bug. ' +
          'Use check_ticket_status when the user asks about a ticket they already submitted and gives you a job ID.',
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

          const result = await executeAgentTool(toolCall.function.name, args, { userId: user.id });

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
