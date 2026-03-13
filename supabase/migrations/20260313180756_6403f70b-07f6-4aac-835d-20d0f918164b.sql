
-- Milestone trigger: fires when share_count crosses 25, 50, 100, 250, 500, 1000
CREATE OR REPLACE FUNCTION public.check_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  milestone_val INT;
  creator_email TEXT;
BEGIN
  IF NEW.share_count >= 1000 AND OLD.share_count < 1000 THEN milestone_val := 1000;
  ELSIF NEW.share_count >= 500 AND OLD.share_count < 500 THEN milestone_val := 500;
  ELSIF NEW.share_count >= 250 AND OLD.share_count < 250 THEN milestone_val := 250;
  ELSIF NEW.share_count >= 100 AND OLD.share_count < 100 THEN milestone_val := 100;
  ELSIF NEW.share_count >= 50 AND OLD.share_count < 50 THEN milestone_val := 50;
  ELSIF NEW.share_count >= 25 AND OLD.share_count < 25 THEN milestone_val := 25;
  ELSE
    RETURN NEW;
  END IF;

  SELECT email INTO creator_email FROM auth.users WHERE id = NEW.started_by;
  IF creator_email IS NULL THEN RETURN NEW; END IF;

  PERFORM net.http_post(
    url := 'https://cjnukzmjenfvuopooumb.supabase.co/functions/v1/send-milestone-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
    body := jsonb_build_object(
      'chain_id', NEW.chain_id,
      'milestone', milestone_val,
      'creator_email', creator_email,
      'chain_name', NEW.chain_name,
      'share_count', NEW.share_count,
      'tier', NEW.tier
    )
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER milestone_trigger
AFTER UPDATE OF share_count ON public.ment_chains
FOR EACH ROW
EXECUTE FUNCTION public.check_milestone();

-- Chain broken trigger: fires when status changes to 'broken'
CREATE OR REPLACE FUNCTION public.on_chain_broken()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  creator_email TEXT;
  all_compliments JSONB;
BEGIN
  IF NEW.status = 'broken' AND OLD.status != 'broken' THEN
    SELECT email INTO creator_email FROM auth.users WHERE id = NEW.started_by;
    IF creator_email IS NULL THEN RETURN NEW; END IF;

    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'text', sub.sent_compliment,
        'sender_name', sub.sender_name
      ) ORDER BY sub.passed_at
    ), '[]'::jsonb) INTO all_compliments
    FROM (
      SELECT cl.sent_compliment, COALESCE(p.display_name, 'Anonymous') as sender_name, cl.passed_at
      FROM chain_links cl
      LEFT JOIN profiles p ON p.id = cl.passed_by
      WHERE cl.chain_id = NEW.chain_id
    ) sub;

    PERFORM net.http_post(
      url := 'https://cjnukzmjenfvuopooumb.supabase.co/functions/v1/send-completed-email',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)),
      body := jsonb_build_object(
        'chain_id', NEW.chain_id,
        'creator_email', creator_email,
        'chain_name', NEW.chain_name,
        'compliments', all_compliments,
        'total_shares', NEW.share_count
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER chain_broken_trigger
AFTER UPDATE OF status ON public.ment_chains
FOR EACH ROW
EXECUTE FUNCTION public.on_chain_broken();
