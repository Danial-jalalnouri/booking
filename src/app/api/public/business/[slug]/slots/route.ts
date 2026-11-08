import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSlots } from "@/lib/availability";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const dateStr = url.searchParams.get("date");
  if (!dateStr) return NextResponse.json({ error: "date required" }, { status: 400 });
  const business = await prisma.business.findUnique({
    where: { slug },
    include: { hours: true },
  });
  if (!business) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const date = new Date(dateStr + "T00:00:00.000Z");
  const dayStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600 * 1000);
  const bookings = await prisma.booking.findMany({
    where: { businessId: business.id, startTime: { gte: dayStart, lt: dayEnd } },
  });
  const slots = generateSlots(date, business.hours, business.slotDuration, bookings);
  return NextResponse.json({ slots: slots.map((s) => ({ start: s.start.toISOString(), end: s.end.toISOString() })) });
}
