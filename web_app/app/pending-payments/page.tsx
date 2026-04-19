'use client';

import Link from 'next/link';

export default function PendingPayments() {
  const payments = [
    { id: 1, title: 'Cours de dressage', seller: 'Prof. Jean Martin', amount: 150 },
    { id: 2, title: 'Transport Paris → Lyon', seller: 'Sophie Transport', amount: 85 },
    { id: 3, title: 'Box au Haras des Pins', seller: 'Stables SARL', amount: 250 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600">← Equishow</Link>
          <h1 className="text-xl font-bold">💳 Paiements</h1>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8">{payments.length} paiements en attente</h2>

        <div className="space-y-6">
          {payments.map((payment) => (
            <div key={payment.id} className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-bold">{payment.title}</h3>
                  <p className="text-gray-600 mt-2">Vendeur: {payment.seller}</p>
                </div>
                <div className="flex flex-col justify-between">
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600">{payment.amount}€</div>
                    <span className="inline-block mt-2 bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-bold">✓ Validé</span>
                  </div>
                  <button className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded w-full">
                    💳 Payer maintenant
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
