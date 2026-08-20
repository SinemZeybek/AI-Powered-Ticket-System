const jsonMock = jest.fn((body, init = {}) => ({
  json: async () => body,
  status: init.status ?? 200,
}));

jest.mock('next/server', () => ({
  NextResponse: { json: jsonMock },
}));

const mockSubmitSupportTicket = jest.fn().mockResolvedValue({
  jobId: 'job-123',
  status: 'queued',
});

jest.mock('@/lib/agentTools', () => ({
  submitSupportTicket: (...args) => mockSubmitSupportTicket(...args),
}));

const { POST } = require('@/app/api/tickets/route');

function mockRequest(body) {
  return {
    json: async () => body,
  };
}

describe('POST /api/tickets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSubmitSupportTicket.mockResolvedValue({ jobId: 'job-123', status: 'queued' });
  });

  it('creates a ticket and returns job id', async () => {
    const ticketData = {
      subject: 'Login Issue',
      message: 'Cannot log in',
      userId: 'user-1',
    };

    await POST(mockRequest(ticketData));

    expect(mockSubmitSupportTicket).toHaveBeenCalledWith(
      { subject: 'Login Issue', message: 'Cannot log in' },
      'user-1'
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        jobId: 'job-123',
      })
    );
  });

  it('returns 400 when the ticket tool reports a validation error', async () => {
    mockSubmitSupportTicket.mockResolvedValueOnce({ error: 'Both subject and message are required to submit a ticket.' });

    await POST(mockRequest({ subject: '', message: '', userId: '1' }));

    expect(jsonMock).toHaveBeenCalledWith(
      { error: 'Both subject and message are required to submit a ticket.' },
      { status: 400 }
    );
  });

  it('returns 500 when queue fails', async () => {
    mockSubmitSupportTicket.mockRejectedValueOnce(new Error('Redis down'));

    await POST(mockRequest({ subject: 'Test', message: 'Test', userId: '1' }));

    expect(jsonMock).toHaveBeenCalledWith(
      { error: 'Failed to create ticket' },
      { status: 500 }
    );
  });
});
