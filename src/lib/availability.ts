type Hour = { dayOfWeek: number; startTime: string; endTime: string };

export function generateSlots(
  date: Date,
  hours: Hour[],
  slotDuration: number,
  bookings: { startTime: Date; endTime: Date }[]
) {
  const now = new Date();
  const slots: { start: Date; end: Date }[] = [];
  const windows = hours.filter((h) => h.dayOfWeek === date.getUTCDay());
  for (const w of windows) {
    const [sh, sm] = w.startTime.split(":").map(Number);
    const [eh, em] = w.endTime.split(":").map(Number);
    const baseY = date.getUTCFullYear();
    const baseM = date.getUTCMonth();
    const baseD = date.getUTCDate();
    let cursor = new Date(Date.UTC(baseY, baseM, baseD, sh, sm, 0));
    const windowEnd = new Date(Date.UTC(baseY, baseM, baseD, eh, em, 0));
    while (cursor.getTime() + slotDuration * 60000 <= windowEnd.getTime()) {
      const slotEnd = new Date(cursor.getTime() + slotDuration * 60000);
      if (cursor > now) {
        const conflict = bookings.some(
          (b) => !(slotEnd <= new Date(b.startTime) || cursor >= new Date(b.endTime))
        );
        if (!conflict) slots.push({ start: new Date(cursor), end: slotEnd });
      }
      cursor = new Date(cursor.getTime() + slotDuration * 60000);
    }
  }
  return slots;
}
