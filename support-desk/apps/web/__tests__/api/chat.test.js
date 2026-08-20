/**
 * Chat endpoint unit test (mocked OpenAI + mocked Redis + mocked NextResponse + mocked Supabase)
 *
 * We mock:
 * - next/server (NextResponse.json)
 * - Redis client (now async)
 * - OpenAI SDK
 * - Supabase client (for auth)
 *
 * This way, the test does not depend on real network, Redis,
 * or the real Next.js server runtime.
 */

// Mock NextResponse from next/server
const jsonMock = jest.fn((body, init = {}) => ({
  json: async () => body,
  status: init.status ?? 200,
}));

jest.mock("next/server", () => {
  return {
    NextResponse: {
      json: jsonMock,
    },
  };
});

// Mock Redis client (getRedisClient is now async)
const mockRedisClient = {
  lRange: jest.fn().mockResolvedValue([]),
  rPush: jest.fn().mockResolvedValue(true),
  lTrim: jest.fn().mockResolvedValue(true),
};

jest.mock("@/lib/redisClient", () => ({
  getRedisClient: jest.fn().mockResolvedValue(mockRedisClient),
}));

// Mock Supabase client (for user auth in chat route)
jest.mock("@/lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: "test-user-123" } },
        error: null,
      }),
    },
  },
}));

// Mock OpenAI SDK
const createMock = jest.fn().mockResolvedValue({
  choices: [{ message: { content: "Mock AI reply" } }],
});

jest.mock("openai", () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: (...args) => createMock(...args),
      },
    },
  }));
});

// Mock the agent tools module
const executeAgentToolMock = jest.fn();
jest.mock("@/lib/agentTools", () => ({
  agentToolDefinitions: [{ type: "function", function: { name: "search_knowledge_base" } }],
  executeAgentTool: (...args) => executeAgentToolMock(...args),
}));

// Import the handler AFTER all mocks are defined
const { POST } = require("@/app/api/chat/route");

// Request mock with headers (handler uses request.headers.get)
function mockRequest(body) {
  return {
    json: async () => body,
    headers: new Map([["x-request-id", "test-req-1"]]),
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    jsonMock.mockClear();
    mockRedisClient.lRange.mockClear();
    mockRedisClient.rPush.mockClear();
    mockRedisClient.lTrim.mockClear();
    executeAgentToolMock.mockClear();
    createMock.mockClear();
    createMock.mockResolvedValue({
      choices: [{ message: { content: "Mock AI reply" } }],
    });
  });

  it("returns assistant reply when a valid message is sent", async () => {
    const req = mockRequest({ message: "Hello" });
    const res = await POST(req);
    const json = await res.json();

    expect(json.reply).toBe("Mock AI reply");
    expect(jsonMock).toHaveBeenCalled();
  });

  it("returns 400 error when message is missing", async () => {
    const req = mockRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe("Message is required");
  });

  it("stores chat messages in Redis with per-user key", async () => {
    const req = mockRequest({ message: "Hello" });
    await POST(req);

    // Verify Redis writes use the user-specific key
    expect(mockRedisClient.rPush).toHaveBeenCalledWith(
      "chat:messages:test-user-123",
      expect.any(String)
    );
  });

  it("returns 401 when user is not authenticated", async () => {
    const { supabase } = require("@/lib/supabaseClient");
    supabase.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "Not authenticated" },
    });

    const req = mockRequest({ message: "Hello" });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("executes a tool call and feeds the result back before returning a final reply", async () => {
    executeAgentToolMock.mockResolvedValueOnce({ results: ["Roles: user and super_admin."] });

    createMock
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: "assistant",
              content: null,
              tool_calls: [
                {
                  id: "call-1",
                  function: { name: "search_knowledge_base", arguments: JSON.stringify({ query: "roles" }) },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "There are two roles: user and super_admin." } }],
      });

    const req = mockRequest({ message: "What roles exist?" });
    const res = await POST(req);
    const json = await res.json();

    expect(executeAgentToolMock).toHaveBeenCalledWith(
      "search_knowledge_base",
      { query: "roles" },
      { userId: "test-user-123" }
    );
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(json.reply).toBe("There are two roles: user and super_admin.");
  });

  it("falls back to a generic reply if tool calls never resolve within the iteration cap", async () => {
    executeAgentToolMock.mockResolvedValue({ results: ["some result"] });

    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call-loop",
                function: { name: "search_knowledge_base", arguments: JSON.stringify({ query: "x" }) },
              },
            ],
          },
        },
      ],
    });

    const req = mockRequest({ message: "Keep looping" });
    const res = await POST(req);
    const json = await res.json();

    expect(json.reply).toMatch(/still working on that/i);
    expect(createMock.mock.calls.length).toBeLessThanOrEqual(4);
  });
});
