import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './supabaseClient'

function App() {
  const [page, setPage] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notifications, setNotifications] = useState([])
  const [payments, setPayments] = useState([])
  const [coaches, setCoaches] = useState([])
  const [users, setUsers] = useState([])

  useEffect(() => {
    const initApp = async () => {
      // Get current user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      // Load users
      const { data: usersData } = await supabase.from('users').select('*').limit(10)
      setUsers(usersData || [])

      // Load coach announcements
      const { data: coachesData } = await supabase.from('coach_annonces').select('*').limit(5)
      setCoaches(coachesData || [])

      // Load notifications
      const { data: notificationsData } = await supabase.from('notifications').select('*').limit(5)
      setNotifications(notificationsData || [])

      // Load payments
      const { data: paymentsData } = await supabase.from('payments').select('*').limit(5)
      setPayments(paymentsData || [])

      setLoading(false)
    }

    initApp()
  }, [])

  const Dashboard = () => (
    <div className="container">
      <nav className="navbar">
        <h1>🐴 Equishow</h1>
        {user && <span style={{marginLeft: 'auto'}}>{user.email}</span>}
      </nav>
      <div className="content">
        <h2>Bienvenue sur Equishow</h2>
        {!user && <p style={{color: '#ef4444'}}>⚠️ Non connecté - Données en lecture seule</p>}
        <div className="cards">
          <div className="card">
            <h3>📬 Notifications</h3>
            <p>{notifications.length} notifications</p>
            <button onClick={() => setPage('notifications')}>Voir →</button>
          </div>
          <div className="card">
            <h3>💳 Paiements</h3>
            <p>{payments.length} paiements</p>
            <button onClick={() => setPage('payments')}>Voir →</button>
          </div>
          <div className="card">
            <h3>👥 Coachs</h3>
            <p>{coaches.length} coachs disponibles</p>
            <button onClick={() => setPage('coaches')}>Voir →</button>
          </div>
          <div className="card">
            <h3>👤 Utilisateurs</h3>
            <p>{users.length} utilisateurs</p>
            <button onClick={() => setPage('users')}>Voir →</button>
          </div>
        </div>
        {loading && <p>Chargement des données...</p>}
      </div>
    </div>
  )

  const Notifications = () => (
    <div className="container">
      <nav className="navbar">
        <button className="back-btn" onClick={() => setPage('dashboard')}>← Equishow</button>
      </nav>
      <div className="content">
        <h2>📬 Notifications ({notifications.length})</h2>
        <div className="list">
          {notifications.length === 0 ? (
            <p style={{textAlign: 'center', color: '#666'}}>Aucune notification</p>
          ) : (
            notifications.map(n => (
              <div key={n.id} className="item">
                <h3>{n.titre || 'Notification'}</h3>
                <p>{n.message}</p>
                <small>{new Date(n.created_at).toLocaleDateString('fr-FR')}</small>
                {!n.est_lue && <span className="badge">Nouvelle</span>}
              </div>
            ))
          )}
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
        <h2>{payments.length} paiements</h2>
        <div className="list">
          {payments.length === 0 ? (
            <p style={{textAlign: 'center', color: '#666'}}>Aucun paiement</p>
          ) : (
            payments.map(p => (
              <div key={p.id} className="payment-item">
                <div>
                  <h3>{p.type || 'Paiement'}</h3>
                  <p>Montant: {(p.amount_buyer_ttc / 100).toFixed(2)}€</p>
                </div>
                <div className="amount">
                  <span className={`badge ${p.payment_status}`}>{p.payment_status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )

  const Coaches = () => (
    <div className="container">
      <nav className="navbar">
        <button className="back-btn" onClick={() => setPage('dashboard')}>← Equishow</button>
        <h3>👥 Coachs</h3>
      </nav>
      <div className="content">
        <h2>{coaches.length} annonces de coach</h2>
        <div className="list">
          {coaches.length === 0 ? (
            <p style={{textAlign: 'center', color: '#666'}}>Aucune annonce</p>
          ) : (
            coaches.map(c => (
              <div key={c.id} className="item">
                <h3>{c.titre}</h3>
                <p>Discipline: {c.discipline}</p>
                <p>Type: {c.type}</p>
                {c.prix_heure_ttc && <p>💰 {c.prix_heure_ttc}€/h TTC</p>}
                <small>{new Date(c.created_at).toLocaleDateString('fr-FR')}</small>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )

  const Users = () => (
    <div className="container">
      <nav className="navbar">
        <button className="back-btn" onClick={() => setPage('dashboard')}>← Equishow</button>
        <h3>👤 Utilisateurs</h3>
      </nav>
      <div className="content">
        <h2>{users.length} utilisateurs</h2>
        <div className="list">
          {users.length === 0 ? (
            <p style={{textAlign: 'center', color: '#666'}}>Aucun utilisateur</p>
          ) : (
            users.map(u => (
              <div key={u.id} className="item">
                <h3>{u.prenom} {u.nom}</h3>
                <p>Email: {u.email}</p>
                <p>Rôle: {u.role}</p>
                <p>Plan: {u.plan}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )

  return page === 'dashboard' ? <Dashboard /> : page === 'notifications' ? <Notifications /> : page === 'payments' ? <Payments /> : page === 'coaches' ? <Coaches /> : <Users />
}

export default App
