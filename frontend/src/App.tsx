import { type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import Layout from './components/Layout'
import AdminStrategies from './pages/AdminStrategies'
import Exchanges from './pages/Exchanges'
import Home from './pages/Home'
import Login from './pages/Login'
import Referral from './pages/Referral'
import Register from './pages/Register'
import Subscriptions from './pages/Subscriptions'
import Trading from './pages/Trading'
import UserCenter from './pages/UserCenter'
import Wallets from './pages/Wallets'
import useAuthStore from './store/authStore'

function PrivateRoute({ children }: { children: ReactNode }) {
  const token = useAuthStore((s) => s.token)
  return token ? children : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user)
  return user?.is_admin ? children : <Navigate to="/home" replace />
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
      <Route
        path="/admin/strategies"
        element={
          <PrivateRoute>
            <AdminRoute>
              <Layout>
                <AdminStrategies />
              </Layout>
            </AdminRoute>
          </PrivateRoute>
        }
      />
    </Routes>
  )
}
