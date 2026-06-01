UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'bdhp1971+unclaimed@gmail.com'
  AND email_confirmed_at IS NULL;