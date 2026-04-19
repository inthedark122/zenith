import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Copy, Link } from 'lucide-react'
import useAuthStore from '../store/authStore'
import { useCommunity } from '../hooks/useReferral'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function Referral() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: community } = useCommunity()

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`
  const copyCode = () => navigator.clipboard.writeText(user?.referral_code || '').catch(() => {})
  const copyLink = () => navigator.clipboard.writeText(referralLink).catch(() => {})

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="flex items-center gap-3 px-5 pt-6 pb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-foreground text-xl font-bold">Invite & Earn</h1>
      </div>

      <div className="flex flex-col items-center px-5 py-6">
        <div className="text-8xl mb-3">🎁</div>
        <h2 className="text-foreground text-xl font-bold mb-1.5">Earn with Every Referral</h2>
        <p className="text-muted-foreground text-sm text-center leading-relaxed">
          Level 1: 50% • Level 2: 30% • Level 3: 20%<br />
          Earn from every subscription your network makes!
        </p>
      </div>

      <div className="flex gap-3 mx-5 mb-4">
        <Card className="flex-1 p-4 text-center">
          <div className="text-[#a78bfa] text-2xl font-extrabold">{community?.members?.length ?? 0}</div>
          <div className="text-muted-foreground text-xs mt-1">Total Referrals</div>
        </Card>
        <Card className="flex-1 p-4 text-center">
          <div className="text-[#a78bfa] text-2xl font-extrabold">
            ${Number(community?.total_commission ?? 0).toFixed(2)}
          </div>
          <div className="text-muted-foreground text-xs mt-1">Total Earned</div>
        </Card>
      </div>

      <Card className="mx-5 mb-4 p-5">
        <p className="text-muted-foreground text-xs mb-2">Your Referral Code</p>
        <div className="flex justify-between items-center">
          <div className="text-[#a78bfa] text-2xl font-extrabold tracking-widest">{user?.referral_code}</div>
          <Button onClick={copyCode} className="gap-1.5">
            <Copy size={14} />
            Copy
          </Button>
        </div>
      </Card>

      <Card className="mx-5 mb-5 p-5 flex flex-col items-center">
        <div className="w-36 h-36 bg-input rounded-xl flex items-center justify-center text-sm text-muted-foreground mb-2.5">
          QR Code
        </div>
        <p className="text-muted-foreground text-xs">Scan to join with your referral</p>
      </Card>

      <Button
        size="lg"
        className="mx-5 w-[calc(100%-40px)] gap-2"
        onClick={copyLink}
      >
        <Link size={16} />
        Copy Referral Link
      </Button>
    </div>
  )
}
