// Shared helper to log backend errors to public.error_log.
// All edge functions should use this instead of swallowing errors.

interface LogErrorParams {
  source: string;
  errorType: string;
  message: string;
  severity?: 'warn' | 'error' | 'critical';
  recipientEmail?: string | null;
  chainId?: string | null;
  mentId?: string | null;
  context?: Record<string, unknown> | null;
}

export async function logError(params: LogErrorParams): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    await fetch(`${supabaseUrl}/rest/v1/error_log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        source: params.source,
        error_type: params.errorType,
        severity: params.severity ?? 'error',
        recipient_email: params.recipientEmail ?? null,
        chain_id: params.chainId ?? null,
        ment_id: params.mentId ?? null,
        message: params.message.slice(0, 4000),
        context: params.context ?? null,
      }),
    });
  } catch (e) {
    // Never let logging failure break the caller.
    console.error('[error-log] Failed to write error_log row:', e);
  }
}
