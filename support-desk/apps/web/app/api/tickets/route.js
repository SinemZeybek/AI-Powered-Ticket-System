import { NextResponse } from 'next/server';
import { submitSupportTicket } from '@/lib/agentTools';

export async function POST(req) {
  try {
    const { subject, message, userId } = await req.json();

    const result = await submitSupportTicket({ subject, message }, userId);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      jobId: result.jobId,
      message: "Ticket submitted. AI assistant is analyzing...",
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}