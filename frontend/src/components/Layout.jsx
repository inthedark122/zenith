import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      {children}
      <BottomNav />
    </div>
  )
}
