import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: 'La carga de documentos de remisiones está deshabilitada temporalmente.',
    },
    { status: 410 }
  );
}
