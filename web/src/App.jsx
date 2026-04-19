import { useState } from 'react'
import './App.css'

function App() {
  const [page, setPage] = useState('dashboard')

  const Dashboard = () => (
    <div className="container">
      <nav className="navbar">
        <h1>🐴 Equishow</h1>
      </nav>
      <div className="content">
        <h2>Bienvenue sur Equishow</h2>
        <div className="cards">
          <div className="card">
            <h3>📬 Notifications</h3>
            <p>Voir vos demandes</p>
            <button onClick={() => setPage('notifications')}>Voir →</button>
          </div>
          <div className="card">
            <h3>💳 Paiements</h3>
            <p>En attente de paiement</p>
            <button onClick={() => setPage('payments')}>Voir →</button>
          </div>
          <div className="card">
            <h3>⚙️ Paramètres</h3>
            <p>Gérer votre profil</p>
            <button>Voir →</button>
          </div>
        </div>
      </div>
    </div>
  )

  const Notifications = () => (
    <div className="container">
      <nav className="navbar">
        <button className="back-btn" onClick={() => setPage('dashboard')}>← Equishow</button>
      </nav>
      <div className="content">
        <h2>📬 Notifications</h2>
        <div className="list">
          {[
            { id: 1, title: '📚 Nouvelle demande de cours', msg: 'Jean Dupont a demandé un cours', time: '2h ago' },
            { id: 2, title: '🏠 Réservation de box', msg: 'Marie Martin a réservé votre box', time: '4h ago' },
            { id: 3, title: '💳 Paiement reçu', msg: 'Paiement de 150€ reçu', time: '1j ago' },
          ].map(n => (
            <div key={n.id} className="item">
              <h3>{n.title}</h3>
              <p>{n.msg}</p>
              <small>{n.time}</small>
              <div className="buttons">
                <button className="accept">✓ Accepter</button>
                <button className="refuse">✕ Refuser</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const Payments = () => (
    <div className="container">
      <nav className="navbar">
        <button className="back-btn" onClick={() => setPage('dashboard')}>← Equishow</button>
        <h3>💳 Paiements</h3>
      </nav>
      <div className="content">
        <h2>3 paiements en attente</h2>
        <div className="list">
          {[
            { id: 1, title: 'Cours de dressage', seller: 'Prof. Jean Martin', amount: 150 },
            { id: 2, title: 'Transport Paris → Lyon', seller: 'Sophie Transport', amount: 85 },
            { id: 3, title: 'Box au Haras des Pins', seller: 'Stables SARL', amount: 250 },
          ].map(p => (
            <div key={p.id} className="payment-item">
              <div>
                <h3>{p.title}</h3>
                <p>Vendeur: {p.seller}</p>
              </div>
              <div className="amount">
                <div className="price">{p.amount}€</div>
                <span className="badge">✓ Validé</span>
                <button className="pay-btn">💳 Payer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  return page === 'dashboard' ? <Dashboard /> : page === 'notifications' ? <Notifications /> : <Payments />
}

export default App
