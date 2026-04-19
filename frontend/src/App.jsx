import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Login from './pages/Login'
import Register from './pages/Register'
import Home from './pages/Home'
import Wallets from './pages/Wallets'
import UserCenter from './pages/UserCenter'
import Referral from './pages/Referral'
import Trading from './pages/Trading'
import Exchanges from './pages/Exchanges'
import Subscriptions from './pages/Subscriptions'
import Layout from './components/Layout'

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/home"
        element={
          <PrivateRoute>
            <Layout>
              <Home />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/wallets"
        element={
          <PrivateRoute>
            <Layout>
              <Wallets />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/user"
        element={
          <PrivateRoute>
            <Layout>
              <UserCenter />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/referral"
        element={
          <PrivateRoute>
            <Layout>
              <Referral />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/trading"
        element={
          <PrivateRoute>
            <Layout>
              <Trading />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/exchanges"
        element={
          <PrivateRoute>
            <Layout>
              <Exchanges />
            </Layout>
          </PrivateRoute>
        }
      />
      <Route
        path="/subscriptions"
        element={
          <PrivateRoute>
            <Layout>
              <Subscriptions />
            </Layout>
          </PrivateRoute>
        }
      />
    </Routes>
  )
}
