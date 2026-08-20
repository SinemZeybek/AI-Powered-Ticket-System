/**
 * Chat endpoint unit test (mocked OpenAI + mocked Redis + mocked NextResponse)
 *
 * We mock:
 * - next/server (NextResponse.json)
 * - Redis client (now async)
 * - OpenAI SDK
 * - agentTools (the tool loop is exercised, individual tool bodies are unit-tested separately)
 *
 * This way, the test does not depend on real network, Redis, or the real
 * Next.js server runtime. The endpoint is a public widget (no auth) — the
 * visitor is identified by a client-generated session id instead.
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
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(true),
};

jest.mock("@/lib/redisClient", () => ({
  getRedisClient: jest.fn().mockResolvedValue(mockRedisClient),
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
function mockRequest(body, { sessionId = "session-123" } = {}) {
  const headers = new Map([["x-request-id", "test-req-1"]]);
  if (sessionId) headers.set("x-session-id", sessionId);
  return {
    json: async () => body,
    headers,
  };
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    jsonMock.mockClear();
    mockRedisClient.lRange.mockClear();
    mockRedisClient.rPush.mockClear();
    mockRedisClient.lTrim.mockClear();
    mockRedisClient.incr.mockReset().mockResolvedValue(1);
    mockRedisClient.expire.mockClear();
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

  it("returns 400 when no session id is sent", async () => {
    const req = mockRequest({ message: "Hello" }, { sessionId: null });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("stores chat messages in Redis keyed by session id", async () => {
    const req = mockRequest({ message: "Hello" });
    await POST(req);

    expect(mockRedisClient.rPush).toHaveBeenCalledWith(
      "chat:messages:session-123",
      expect.any(String)
    );
  });

  it("returns 429 once the per-session rate limit is exceeded", async () => {
    mockRedisClient.incr.mockResolvedValue(16);

    const req = mockRequest({ message: "Hello" });
    const res = await POST(req);

    expect(res.status).toBe(429);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("executes a tool call and feeds the result back before returning a final reply", async () => {
    executeAgentToolMock.mockResolvedValueOnce({ results: ["Hours: Mon-Fri 09:00-18:00."] });

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
                  function: { name: "search_knowledge_base", arguments: JSON.stringify({ query: "hours" }) },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: "We're open Monday-Friday, 09:00-18:00." } }],
      });

    const req = mockRequest({ message: "What are your hours?" });
    const res = await POST(req);
    const json = await res.json();

    expect(executeAgentToolMock).toHaveBeenCalledWith(
      "search_knowledge_base",
      { query: "hours" },
      { sessionId: "session-123" }
    );
    expect(createMock).toHaveBeenCalledTimes(2);
    expect(json.reply).toBe("We're open Monday-Friday, 09:00-18:00.");
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
