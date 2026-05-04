
-- Blocked words table
CREATE TABLE public.blocked_words (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.blocked_words ENABLE ROW LEVEL SECURITY;

-- Public can read (needed for client-side validation)
CREATE POLICY "Anyone can view blocked words"
ON public.blocked_words FOR SELECT
USING (true);

-- Only service role can mutate (admin-managed)
CREATE POLICY "Service role can manage blocked words"
ON public.blocked_words FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_blocked_words_word ON public.blocked_words (word);

-- Server-side validator
CREATE OR REPLACE FUNCTION public.contains_blocked_word(_text TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized TEXT;
  found BOOLEAN;
BEGIN
  normalized := ' ' || lower(regexp_replace(coalesce(_text, ''), '[^a-zA-Z0-9 ]', ' ', 'g')) || ' ';
  SELECT EXISTS(
    SELECT 1 FROM public.blocked_words
    WHERE position(' ' || lower(word) || ' ' IN normalized) > 0
  ) INTO found;
  RETURN found;
END;
$$;

-- Top 5 most-sent compliments (across all users)
CREATE OR REPLACE FUNCTION public.get_popular_compliments(_limit INT DEFAULT 5)
RETURNS TABLE(compliment_text TEXT, sent_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT compliment_text, COUNT(*)::BIGINT AS sent_count
  FROM public.sent_ments
  GROUP BY compliment_text
  ORDER BY sent_count DESC
  LIMIT _limit;
$$;

-- Seed 200+ blocked terms
INSERT INTO public.blocked_words (word, category) VALUES
-- Profanity
('fuck','profanity'),('fucking','profanity'),('fucker','profanity'),('motherfucker','profanity'),('shit','profanity'),('shitty','profanity'),('bullshit','profanity'),('bitch','profanity'),('bitches','profanity'),('asshole','profanity'),('assholes','profanity'),('bastard','profanity'),('damn','profanity'),('goddamn','profanity'),('crap','profanity'),('piss','profanity'),('pissed','profanity'),('cock','profanity'),('dick','profanity'),('dickhead','profanity'),('prick','profanity'),('pussy','profanity'),('cunt','profanity'),('twat','profanity'),('wanker','profanity'),('bollocks','profanity'),('bugger','profanity'),('arse','profanity'),('arsehole','profanity'),('jackass','profanity'),('dumbass','profanity'),('dipshit','profanity'),('horseshit','profanity'),('shithead','profanity'),('fuckface','profanity'),('fuckwit','profanity'),('fucktard','profanity'),('shitface','profanity'),('cockhead','profanity'),('dickface','profanity'),
-- Slurs (common; redacted enough but blocked)
('nigger','slur'),('nigga','slur'),('chink','slur'),('gook','slur'),('spic','slur'),('wetback','slur'),('kike','slur'),('faggot','slur'),('fag','slur'),('dyke','slur'),('tranny','slur'),('retard','slur'),('retarded','slur'),('cripple','slur'),('midget','slur'),('paki','slur'),('coon','slur'),('jap','slur'),('raghead','slur'),('towelhead','slur'),('beaner','slur'),('cracker','slur'),('honkey','slur'),('honky','slur'),('zipperhead','slur'),('halfbreed','slur'),('mongoloid','slur'),('sambo','slur'),
-- Insults
('idiot','insult'),('idiotic','insult'),('moron','insult'),('moronic','insult'),('stupid','insult'),('dumb','insult'),('dummy','insult'),('imbecile','insult'),('loser','insult'),('losers','insult'),('pathetic','insult'),('worthless','insult'),('useless','insult'),('ugly','insult'),('fat','insult'),('fatso','insult'),('fatty','insult'),('hideous','insult'),('disgusting','insult'),('gross','insult'),('repulsive','insult'),('freak','insult'),('weirdo','insult'),('creep','insult'),('creepy','insult'),('scumbag','insult'),('lowlife','insult'),('garbage','insult'),('trash','insult'),('nobody','insult'),('failure','insult'),('reject','insult'),('parasite','insult'),('leech','insult'),('vermin','insult'),('pig','insult'),('slob','insult'),('hag','insult'),('crone','insult'),('skank','insult'),('slut','insult'),('whore','insult'),('hooker','insult'),('hoe','insult'),('thot','insult'),('simp','insult'),('incel','insult'),('karen','insult'),
-- Threats / violence
('kill you','threat'),('kill yourself','threat'),('kys','threat'),('kms','threat'),('die','threat'),('death','threat'),('murder','threat'),('rape','threat'),('rapist','threat'),('molest','threat'),('molester','threat'),('beat you','threat'),('punch you','threat'),('hurt you','threat'),('shoot you','threat'),('stab','threat'),('strangle','threat'),('choke you','threat'),('lynch','threat'),('hang yourself','threat'),('drown yourself','threat'),('burn in hell','threat'),('rot in hell','threat'),('go die','threat'),('drop dead','threat'),('end your life','threat'),
-- Sexual content
('sex','sexual'),('sexy','sexual'),('porn','sexual'),('porno','sexual'),('xxx','sexual'),('nude','sexual'),('nudes','sexual'),('naked','sexual'),('boobs','sexual'),('boobies','sexual'),('tits','sexual'),('titties','sexual'),('nipple','sexual'),('nipples','sexual'),('penis','sexual'),('vagina','sexual'),('clit','sexual'),('clitoris','sexual'),('orgasm','sexual'),('cum','sexual'),('cumming','sexual'),('jizz','sexual'),('blowjob','sexual'),('handjob','sexual'),('rimjob','sexual'),('anal','sexual'),('butthole','sexual'),('asshat','sexual'),('horny','sexual'),('masturbate','sexual'),('jerk off','sexual'),('jack off','sexual'),('milf','sexual'),('dilf','sexual'),('hentai','sexual'),('bdsm','sexual'),('bondage','sexual'),('fetish','sexual'),('erotic','sexual'),('escort','sexual'),('camgirl','sexual'),('onlyfans','sexual'),('pedophile','sexual'),('pedo','sexual'),('child porn','sexual'),('cp','sexual'),
-- Self-harm
('suicide','selfharm'),('suicidal','selfharm'),('cutting','selfharm'),('cut yourself','selfharm'),('self harm','selfharm'),('self-harm','selfharm'),('selfharm','selfharm'),('overdose','selfharm'),('hang myself','selfharm'),('want to die','selfharm'),('end it all','selfharm'),('no reason to live','selfharm'),
-- Bullying
('hate you','bullying'),('hate u','bullying'),('nobody loves you','bullying'),('nobody likes you','bullying'),('shut up','bullying'),('shut the fuck up','bullying'),('stfu','bullying'),('gtfo','bullying'),('go away','bullying'),('leave forever','bullying'),('youre nothing','bullying'),('you are nothing','bullying'),('you suck','bullying'),('you re trash','bullying'),('you are trash','bullying'),('you re worthless','bullying'),('go cry','bullying'),('cry baby','bullying'),('crybaby','bullying'),('snowflake','bullying'),('triggered','bullying'),('cope','bullying'),('seethe','bullying'),('mald','bullying'),('ratio','bullying'),('cringe','bullying'),('mid','bullying'),('npc','bullying'),
-- Hate / extremist
('hitler','hate'),('nazi','hate'),('nazis','hate'),('kkk','hate'),('isis','hate'),('terrorist','hate'),('jihad','hate'),('genocide','hate'),('ethnic cleansing','hate'),('white power','hate'),('heil','hate'),('sieg heil','hate'),('14 88','hate'),('1488','hate'),
-- Drugs (mild filter)
('cocaine','drugs'),('heroin','drugs'),('meth','drugs'),('crack','drugs'),('crackhead','drugs'),('junkie','drugs'),('addict','drugs');
