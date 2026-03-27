// Face Status API — Simple DB read (admin manages status manually)
// GET /api/agents/[id]/face/status

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAgent } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const agent = await getAgent(id);
  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  if (agent.user_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  return NextResponse.json({
    status: agent.custom_face_status,
    customFaceId: agent.custom_face_id,
    imageUrl: agent.custom_face_image_url,
    uploadedAt: agent.face_consent_at,
  });
}
