-- ─── email_events: provider webhook events ───
CREATE TABLE public.email_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_id text,
  recipient_email text NOT NULL,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.email_events TO service_role;

ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
-- No policies: no anon/authenticated access. Only service_role (edge functions)
-- writes; admin reads go through the SECURITY DEFINER report function below.

CREATE INDEX idx_email_events_type_created ON public.email_events (event_type, created_at DESC);
CREATE INDEX idx_email_events_recipient ON public.email_events (lower(recipient_email));

-- ─── Admin email-health report ───
CREATE OR REPLACE FUNCTION public.admin_get_email_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_delivered int;
  v_complained int;
  v_bounced int;
  v_sent int;
  v_dnc int;
  v_recent_complaints jsonb;
  v_recent_bounces jsonb;
  v_top_senders jsonb;
BEGIN
  IF NOT public.is_app_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT count(*) INTO v_delivered FROM email_events
    WHERE event_type = 'delivered' AND created_at >= now() - interval '7 days';
  SELECT count(*) INTO v_complained FROM email_events
    WHERE event_type = 'complained' AND created_at >= now() - interval '7 days';
  SELECT count(*) INTO v_bounced FROM email_events
    WHERE event_type = 'bounced' AND created_at >= now() - interval '7 days';
  SELECT count(*) INTO v_sent FROM email_logs
    WHERE sent_at >= now() - interval '7 days';
  SELECT count(*) INTO v_dnc FROM do_not_contact;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent_complaints
  FROM (
    SELECT e.recipient_email, e.created_at,
      EXISTS(SELECT 1 FROM do_not_contact d WHERE lower(d.email) = lower(e.recipient_email)) AS on_dnc
    FROM email_events e
    WHERE e.event_type = 'complained'
    ORDER BY e.created_at DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_recent_bounces
  FROM (
    SELECT e.recipient_email, e.created_at,
      (SELECT count(*) FROM email_events b
         WHERE b.event_type = 'bounced' AND lower(b.recipient_email) = lower(e.recipient_email)) AS bounce_count,
      EXISTS(SELECT 1 FROM do_not_contact d WHERE lower(d.email) = lower(e.recipient_email)) AS on_dnc
    FROM email_events e
    WHERE e.event_type = 'bounced'
    ORDER BY e.created_at DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_top_senders
  FROM (
    WITH recip AS (
      SELECT sender_id AS uid, sent_at AS ts FROM sent_ments WHERE sender_id IS NOT NULL
      UNION ALL
      SELECT passed_by AS uid, passed_at AS ts FROM chain_links WHERE passed_by IS NOT NULL
    ),
    actions AS (
      SELECT sender_id AS uid, sent_at AS ts FROM sent_ments WHERE sender_id IS NOT NULL
      UNION ALL
      SELECT passed_by AS uid, passed_at AS ts FROM chain_links
        WHERE passed_by IS NOT NULL AND was_forwarded = true
      UNION ALL
      SELECT passed_by AS uid, min(passed_at) AS ts FROM chain_links
        WHERE passed_by IS NOT NULL AND was_forwarded = false
        GROUP BY passed_by, chain_id
    ),
    recip_agg AS (
      SELECT uid, count(*) FILTER (WHERE ts >= now() - interval '7 days') AS recipients_week
      FROM recip GROUP BY uid
    ),
    act_agg AS (
      SELECT uid,
        count(*) FILTER (WHERE ts >= date_trunc('day', now())) AS sends_today,
        count(*) FILTER (WHERE ts >= now() - interval '7 days') AS sends_week
      FROM actions GROUP BY uid
    ),
    active AS (
      SELECT DISTINCT uid FROM actions WHERE ts >= now() - interval '7 days'
    )
    SELECT
      u.email::text AS email,
      COALESCE(aa.sends_today, 0) AS sends_today,
      COALESCE(aa.sends_week, 0) AS sends_week,
      COALESCE(ra.recipients_week, 0) AS recipients_week,
      GREATEST(0, EXTRACT(DAY FROM now() - u.created_at)::int) AS account_age_days,
      EXISTS(
        SELECT 1 FROM ment_reports r
        LEFT JOIN sent_ments sm ON sm.id = r.reported_ment_id
        WHERE COALESCE(r.reported_user_id, sm.sender_id) = active.uid
      ) AS has_reports
    FROM active
    LEFT JOIN act_agg aa ON aa.uid = active.uid
    LEFT JOIN recip_agg ra ON ra.uid = active.uid
    LEFT JOIN auth.users u ON u.id = active.uid
    ORDER BY COALESCE(aa.sends_week, 0) DESC, COALESCE(ra.recipients_week, 0) DESC
    LIMIT 10
  ) t;

  RETURN jsonb_build_object(
    'delivered_7d', v_delivered,
    'complained_7d', v_complained,
    'bounced_7d', v_bounced,
    'sent_7d', v_sent,
    'do_not_contact_count', v_dnc,
    'recent_complaints', v_recent_complaints,
    'recent_bounces', v_recent_bounces,
    'top_senders', v_top_senders
  );
END;
$$;