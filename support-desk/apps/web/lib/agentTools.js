import { supabaseAdmin } from './supabaseAdminClient';

// Real facts about Zeybek Hukuk Bürosu, pulled from zeybekhukuk.com. The
// site is primarily Turkish but also available in English, so practice
// areas are kept in Turkish (as they really appear) with an English gloss —
// the model responds in whichever language the visitor writes in.
export const KNOWLEDGE_BASE = [
  {
    topic: 'contact',
    text: 'Contact: phone 0262 322 21 66, email av.kerem@zeybekhukuk.com. Address: Yenişehir Mah. Demokrasi Cad. No:27 Balcıoğlu İş Merkezi K:2 D:7, İzmit/Kocaeli.',
  },
  {
    topic: 'hours',
    text: 'Office hours: Monday-Friday (Pazartesi-Cuma), 09:00-18:00.',
  },
  {
    topic: 'practice areas',
    text: 'Practice areas: İş Hukuku (Labor Law), Gayrimenkul Hukuku (Real Estate Law), Tıp Hukuku (Medical Law), İcra-İflas Hukuku (Enforcement/Bankruptcy Law), Tazminat Hukuku (Compensation Law), Ticaret Hukuku (Commercial Law), Ceza Hukuku (Criminal Law), Aile Hukuku (Family Law).',
  },
  {
    topic: 'firm history',
    text: 'Founded in 1979, 47 years of experience, 15 specialists on staff. Currently led by Av. Kerem Zeybek (second generation), combining traditional legal methodology with AI-supported tools and digital process management.',
  },
  {
    topic: 'consultation',
    text: 'To book a consultation, contact the firm by phone, email, or the website contact form. There is no public pricing list — cost is discussed during the initial consultation.',
  },
  {
    topic: 'languages',
    text: 'The firm primarily operates in Turkish; English is also available.',
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

export async function submitSupportTicket({ subject, message }, sessionId) {
  if (!subject || !message) {
    return { error: 'Both subject and message are required to submit a ticket.' };
  }

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .insert([{ subject, message, session_id: sessionId || 'unknown' }])
    .select('id')
    .single();

  if (error) {
    return { error: 'Could not submit the ticket right now. Please try again.' };
  }

  return { ticketId: data.id, status: 'open' };
}

export async function checkTicketStatus(ticketId) {
  if (!ticketId) {
    return { error: 'A ticket ID is required to check status.' };
  }

  const { data, error } = await supabaseAdmin
    .from('tickets')
    .select('id, status, created_at')
    .eq('id', ticketId)
    .single();

  if (error || !data) {
    return { error: 'Ticket not found' };
  }

  return { id: data.id, status: data.status, createdAt: data.created_at };
}

export const agentToolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description:
        "Search Zeybek Hukuk Bürosu's knowledge base for real facts (practice areas, contact info, hours, consultation process, firm history) before answering a visitor's question.",
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Keywords to search for, e.g. "practice areas" or "office hours".' },
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
        "Escalate to a human when the knowledge base doesn't confidently answer the visitor's question — e.g. case-specific legal questions, pricing for their situation, or anything requiring a lawyer's judgment.",
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: "A short summary of the visitor's question." },
          message: { type: 'string', description: "The visitor's full question, in their own words." },
        },
        required: ['subject', 'message'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_ticket_status',
      description: 'Check whether a previously submitted ticket has been resolved, given its ticket ID.',
      parameters: {
        type: 'object',
        properties: {
          ticketId: { type: 'string', description: 'The ticket ID returned when the ticket was submitted.' },
        },
        required: ['ticketId'],
      },
    },
  },
];

export async function executeAgentTool(name, args, context) {
  switch (name) {
    case 'search_knowledge_base':
      return searchKnowledgeBase(args.query);
    case 'submit_support_ticket':
      return submitSupportTicket({ subject: args.subject, message: args.message }, context?.sessionId);
    case 'check_ticket_status':
      return checkTicketStatus(args.ticketId);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
