import { chatQueue } from './bullmq';

export const KNOWLEDGE_BASE = [
  {
    topic: 'auth',
    text: 'Users sign up, log in, and log out via Supabase Auth. Sessions are protected by middleware, and there is a forgot-password / update-password flow.',
  },
  {
    topic: 'roles',
    text: 'There are two roles: "user" (standard permissions, can only see their own data) and "super_admin" (can see all users and their todo counts in an admin panel).',
  },
  {
    topic: 'todos',
    text: 'Regular users can create, read, update, delete, and toggle completion on their own todos. Users cannot see or edit other users\' todos.',
  },
  {
    topic: 'tickets',
    text: 'Users can submit a support ticket with a subject and message. The ticket is queued for asynchronous AI processing, which drafts a suggested response. You can check a submitted ticket\'s status if you have its job ID.',
  },
  {
    topic: 'chat',
    text: 'This chat assistant can answer questions about the app, search its own knowledge base, submit a support ticket on the user\'s behalf, and check the status of a previously submitted ticket.',
  },
];

export function searchKnowledgeBase(query) {
  const q = String(query || '').toLowerCase();
  const matches = KNOWLEDGE_BASE.filter(
    (entry) => entry.topic.toLowerCase().includes(q) || entry.text.toLowerCase().includes(q)
  );
  return {
    results: matches.length > 0 ? matches.map((m) => m.text) : ['No matching knowledge base entry found.'],
  };
}

export async function submitSupportTicket({ subject, message }, userId) {
  if (!subject || !message) {
    return { error: 'Both subject and message are required to submit a ticket.' };
  }

  const job = await chatQueue.add(
    'process-ai-response',
    { subject, message, userId, source: 'chat-agent' },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: false,
      removeOnFail: false,
    }
  );

  return { jobId: job.id, status: 'queued' };
}

export async function checkTicketStatus(jobId) {
  if (!jobId) {
    return { error: 'A job ID is required to check ticket status.' };
  }

  const job = await chatQueue.getJob(jobId);
  if (!job) {
    return { error: 'Job not found' };
  }

  const state = await job.getState();
  return {
    id: job.id,
    status: state,
    data: state === 'completed' ? job.returnvalue : null,
  };
}

export const agentToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description:
        'Search the app knowledge base for information about how the app works (auth, roles, todos, tickets, chat).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keywords to search for, e.g. "roles" or "how do tickets work".' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'submit_support_ticket',
      description:
        'File a support ticket on the user\'s behalf so it can be processed asynchronously. Use this when the user describes a problem or bug rather than asking a general question.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'A short summary of the issue.' },
          message: { type: 'string', description: 'The full description of the issue.' },
        },
        required: ['subject', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_ticket_status',
      description: 'Check the processing status of a previously submitted ticket by its job ID.',
      parameters: {
        type: 'object',
        properties: {
          jobId: { type: 'string', description: 'The job ID returned when the ticket was submitted.' },
        },
        required: ['jobId'],
      },
    },
  },
];

export async function executeAgentTool(name, args, context) {
  switch (name) {
    case 'search_knowledge_base':
      return searchKnowledgeBase(args.query);
    case 'submit_support_ticket':
      return submitSupportTicket({ subject: args.subject, message: args.message }, context?.userId);
    case 'check_ticket_status':
      return checkTicketStatus(args.jobId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
