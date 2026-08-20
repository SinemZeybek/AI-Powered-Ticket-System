const mockAdd = jest.fn();
const mockGetJob = jest.fn();

jest.mock('./bullmq', () => ({
  chatQueue: {
    add: (...args) => mockAdd(...args),
    getJob: (...args) => mockGetJob(...args),
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
    const { results } = searchKnowledgeBase('roles');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].toLowerCase()).toContain('role');
  });

  it('returns a fallback message when nothing matches', () => {
    const { results } = searchKnowledgeBase('quantum physics');
    expect(results).toEqual(['No matching knowledge base entry found.']);
  });
});

describe('submitSupportTicket', () => {
  beforeEach(() => {
    mockAdd.mockReset();
  });

  it('queues a job on the shared chatQueue with the expected shape', async () => {
    mockAdd.mockResolvedValue({ id: 'job-42' });

    const result = await submitSupportTicket(
      { subject: 'Login issue', message: 'Cannot log in' },
      'user-1'
    );

    expect(mockAdd).toHaveBeenCalledWith(
      'process-ai-response',
      expect.objectContaining({
        subject: 'Login issue',
        message: 'Cannot log in',
        userId: 'user-1',
        source: 'chat-agent',
      }),
      expect.any(Object)
    );
    expect(result).toEqual({ jobId: 'job-42', status: 'queued' });
  });

  it('returns an error when subject or message is missing', async () => {
    const result = await submitSupportTicket({ subject: '', message: 'x' }, 'user-1');
    expect(result.error).toBeDefined();
    expect(mockAdd).not.toHaveBeenCalled();
  });
});

describe('checkTicketStatus', () => {
  beforeEach(() => {
    mockGetJob.mockReset();
  });

  it('returns not found when the job does not exist', async () => {
    mockGetJob.mockResolvedValue(null);
    const result = await checkTicketStatus('missing-job');
    expect(result).toEqual({ error: 'Job not found' });
  });

  it('returns status and data for a completed job', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-42',
      getState: jest.fn().mockResolvedValue('completed'),
      returnvalue: 'AI drafted response',
    });

    const result = await checkTicketStatus('job-42');
    expect(result).toEqual({ id: 'job-42', status: 'completed', data: 'AI drafted response' });
  });
});

describe('executeAgentTool', () => {
  it('dispatches to the right function by tool name', async () => {
    mockAdd.mockResolvedValue({ id: 'job-7' });

    const result = await executeAgentTool(
      'submit_support_ticket',
      { subject: 'Bug', message: 'Something broke' },
      { userId: 'user-9' }
    );

    expect(result).toEqual({ jobId: 'job-7', status: 'queued' });
  });

  it('returns an error for an unknown tool name', async () => {
    const result = await executeAgentTool('not_a_real_tool', {}, {});
    expect(result.error).toMatch(/Unknown tool/);
  });
});
