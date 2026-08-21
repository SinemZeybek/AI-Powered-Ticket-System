const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelectAfterInsert = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelectAfterInsert }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ insert: mockInsert, select: mockSelect }));

jest.mock('./supabaseAdminClient', () => ({
  supabaseAdmin: {
    from: (...args) => mockFrom(...args),
  },
}));

const {
  searchKnowledgeBase,
  submitSupportTicket,
  checkTicketStatus,
  executeAgentTool,
} = require('./agentTools');

describe('searchKnowledgeBase', () => {
  it('returns matching entries for a known topic', () => {
    const { results } = searchKnowledgeBase('practice areas');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].toLowerCase()).toContain('hukuku');
  });

  it('matches on individual keywords, not the whole phrase verbatim', () => {
    const { results } = searchKnowledgeBase('office phone');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].toLowerCase()).toContain('phone');
  });

  it('returns a fallback message when nothing matches', () => {
    const { results } = searchKnowledgeBase('quantum physics');
    expect(results).toEqual(['No matching knowledge base entry found.']);
  });
});

describe('submitSupportTicket', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockInsert.mockClear();
    mockSingle.mockReset();
  });

  it('inserts a ticket row with the expected shape', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'ticket-42' }, error: null });

    const result = await submitSupportTicket(
      { subject: 'Consultation question', message: 'How do I book one?' },
      'session-1'
    );

    expect(mockFrom).toHaveBeenCalledWith('tickets');
    expect(mockInsert).toHaveBeenCalledWith([
      { subject: 'Consultation question', message: 'How do I book one?', session_id: 'session-1' },
    ]);
    expect(result).toEqual({ ticketId: 'ticket-42', status: 'open' });
  });

  it('returns an error when subject or message is missing', async () => {
    const result = await submitSupportTicket({ subject: '', message: 'x' }, 'session-1');
    expect(result.error).toBeDefined();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('returns an error when the insert fails', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'db down' } });

    const result = await submitSupportTicket({ subject: 'x', message: 'y' }, 'session-1');
    expect(result.error).toBeDefined();
  });
});

describe('checkTicketStatus', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    mockSingle.mockReset();
  });

  it('returns not found when the ticket does not exist', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });
    const result = await checkTicketStatus('missing-ticket');
    expect(result).toEqual({ error: 'Ticket not found' });
  });

  it('returns status for an existing ticket', async () => {
    mockSingle.mockResolvedValue({
      data: { id: 'ticket-42', status: 'resolved', created_at: '2026-08-21T00:00:00Z' },
      error: null,
    });

    const result = await checkTicketStatus('ticket-42');
    expect(result).toEqual({ id: 'ticket-42', status: 'resolved', createdAt: '2026-08-21T00:00:00Z' });
  });
});

describe('executeAgentTool', () => {
  it('dispatches to the right function by tool name', async () => {
    mockSingle.mockResolvedValue({ data: { id: 'ticket-7' }, error: null });

    const result = await executeAgentTool(
      'submit_support_ticket',
      { subject: 'Bug', message: 'Something broke' },
      { sessionId: 'session-9' }
    );

    expect(result).toEqual({ ticketId: 'ticket-7', status: 'open' });
  });

  it('returns an error for an unknown tool name', async () => {
    const result = await executeAgentTool('not_a_real_tool', {}, {});
    expect(result.error).toMatch(/Unknown tool/);
  });
});
