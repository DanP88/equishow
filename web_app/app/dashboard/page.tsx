'use client';

import Link from 'next/link';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-blue-600">🐴 Equishow</h1>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-3xl font-bold mb-8">Bienvenue sur Equishow</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-4xl mb-4">📬</div>
            <h3 className="text-lg font-bold">Notifications</h3>
            <p className="text-gray-600 mt-2">Voir vos demandes</p>
            <Link href="/notifications">
              <button className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded w-full">
                Voir →
              </button>
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-4xl mb-4">💳</div>
            <h3 className="text-lg font-bold">Paiements</h3>
            <p className="text-gray-600 mt-2">En attente de paiement</p>
            <Link href="/pending-payments">
              <button className="mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded w-full">
                Voir →
              </button>
            </Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-4xl mb-4">⚙️</div>
            <h3 className="text-lg font-bold">Paramètres</h3>
            <p className="text-gray-600 mt-2">Gérer votre profil</p>
            <button className="mt-4 bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded w-full">
              Voir →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
