-- Demo leads table for landing page gated demo
CREATE TABLE IF NOT EXISTS demo_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  turnstile_passed BOOLEAN DEFAULT true,
  converted_to_signup BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_demo_leads_email ON demo_leads(email);
CREATE INDEX IF NOT EXISTS idx_demo_leads_created_at ON demo_leads(created_at);
