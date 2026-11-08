import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/auth";

export async function GET(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const businessId = url.searchParams.get("businessId");
  const businesses = await prisma.business.findMany({ where: { ownerId: userId }, select: { id: true } });
  const ids = businesses.map((b) => b.id);
  const bookings = await prisma.booking.findMany({
    where: {
      businessId: businessId ? businessId : { in: ids },
      business: { ownerId: userId },
    },
    include: { business: true, service: true },
    orderBy: { startTime: "asc" },
  });
  return NextResponse.json({ bookings });
}
