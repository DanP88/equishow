'use client';

import Link from 'next/link';

export default function Notifications() {
  const notifications = [
    { id: 1, title: '📚 Nouvelle demande de cours', message: 'Jean Dupont a demandé un cours', time: '2h ago' },
    { id: 2, title: '🏠 Réservation de box', message: 'Marie Martin a réservé votre box', time: '4h ago' },
    { id: 3, title: '💳 Paiement reçu', message: 'Paiement de 150€ reçu', time: '1j ago' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600">← Equishow</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold mb-8">📬 Notifications</h1>

        <div className="space-y-4">
          {notifications.map((notif) => (
            <div key={notif.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold">{notif.title}</h3>
              <p className="text-gray-600 mt-2">{notif.message}</p>
              <p className="text-sm text-gray-500 mt-3">{notif.time}</p>
              <div className="mt-4 flex gap-2">
                <button className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded">✓ Accepter</button>
                <button className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">✕ Refuser</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
