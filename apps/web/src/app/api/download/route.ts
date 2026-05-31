import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  const filename = sanitizeFilename(
    request.nextUrl.searchParams.get('filename') ?? 'image.png',
  );

  if (!url) {
    return NextResponse.json({ message: 'Missing url' }, { status: 400 });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return NextResponse.json({ message: 'Invalid url' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return NextResponse.json({ message: 'Unsupported url' }, { status: 400 });
  }

  const response = await fetch(parsedUrl.toString(), { cache: 'no-store' });
  if (!response.ok || !response.body) {
    return NextResponse.json({ message: 'Download failed' }, { status: 502 });
  }

  return new NextResponse(response.body, {
    headers: {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type':
        response.headers.get('content-type') ?? 'application/octet-stream',
    },
  });
}

function sanitizeFilename(filename: string) {
  return filename.replace(/[\\/:*?"<>|]/g, '-').slice(0, 120) || 'image.png';
}
