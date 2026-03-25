import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { full_name } = body;

    if (typeof full_name !== 'string' || full_name.length > 100) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const { error } = await supabase
      .from('profiles')
      .update({ full_name: full_name.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) {
      console.error('[Profile] Update error:', error);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('[Profile] Error:', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
