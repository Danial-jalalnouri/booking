export default function Home() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold mb-4">Bookly</h1>
      <p className="text-lg text-gray-600 mb-8">
        Appointment booking for any business. Create your business, define services
        and available time slots, share your booking link, and manage appointments
        from your dashboard.
      </p>
      <div className="flex gap-4">
        <a href="/signup" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium">Get started</a>
        <a href="/login" className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium">Log in</a>
      </div>
    </main>
  );
}
