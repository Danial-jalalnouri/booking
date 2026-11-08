import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

const schema = z.array(z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
}));

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const b = await prisma.business.findUnique({ where: { id } });
  if (!b || b.ownerId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  await prisma.businessHour.deleteMany({ where: { businessId: id } });
  await prisma.businessHour.createMany({
    data: parsed.data.map((h) => ({ ...h, businessId: id })),
  });
  const hours = await prisma.businessHour.findMany({ where: { businessId: id } });
  return NextResponse.json({ hours });
}
