import BottomNav from './BottomNav'

export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-background">
      {children}
      <BottomNav />
    </div>
  )
}
