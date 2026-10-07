import { NextRequest, NextResponse } from 'next/server';
import { processNextMagentoSyncJob } from '@/lib/server/magento-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try { return NextResponse.json({ job: await processNextMagentoSyncJob() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Magento sync worker failed.' }, { status: 500 }); }
}
