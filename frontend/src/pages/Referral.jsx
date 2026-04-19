import { useNavigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'
import { useCommunity } from '../hooks/useReferral'

export default function Referral() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const { data: community } = useCommunity()

  const referralLink = `${window.location.origin}/register?ref=${user?.referral_code}`
  const copyCode = () => navigator.clipboard.writeText(user?.referral_code || '').catch(() => {})
  const copyLink = () => navigator.clipboard.writeText(referralLink).catch(() => {})

  return (
    <div className="min-h-screen bg-[#0a0a0a] pb-20">
      <div className="flex items-center gap-3 px-5 pt-6 pb-2">
        <button className="bg-none border-none text-white text-2xl cursor-pointer" onClick={() => navigate(-1)}>←</button>
        <div className="text-white text-xl font-bold">Invite &amp; Earn</div>
      </div>

      <div className="flex flex-col items-center px-5 py-6">
        <div className="text-8xl mb-3">🎁</div>
        <div className="text-white text-xl font-bold mb-1.5">Earn with Every Referral</div>
        <div className="text-[#888] text-sm text-center leading-relaxed">
          Level 1: 50% • Level 2: 30% • Level 3: 20%<br />
          Earn from every subscription your network makes!
        </div>
      </div>

      <div className="flex gap-3 mx-5 mb-4">
        <div className="flex-1 bg-[#141414] rounded-xl p-4 border border-[#222] text-center">
          <div className="text-[#a78bfa] text-2xl font-extrabold">{community?.members?.length ?? 0}</div>
          <div className="text-[#888] text-xs mt-1">Total Referrals</div>
        </div>
        <div className="flex-1 bg-[#141414] rounded-xl p-4 border border-[#222] text-center">
          <div className="text-[#a78bfa] text-2xl font-extrabold">${Number(community?.total_commission ?? 0).toFixed(2)}</div>
          <div className="text-[#888] text-xs mt-1">Total Earned</div>
        </div>
      </div>

      <div className="mx-5 mb-4 bg-[#141414] rounded-[14px] p-5 border border-[#333]">
        <div className="text-[#888] text-xs mb-2">Your Referral Code</div>
        <div className="flex justify-between items-center">
          <div className="text-[#a78bfa] text-2xl font-extrabold tracking-widest">{user?.referral_code}</div>
          <button className="bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] border-none rounded-lg text-white px-5 py-2.5 font-semibold cursor-pointer" onClick={copyCode}>Copy</button>
        </div>
      </div>

      <div className="mx-5 mb-5 bg-[#141414] rounded-[14px] p-5 border border-[#222] flex flex-col items-center">
        <div className="w-36 h-36 bg-[#1e1e1e] rounded-xl flex items-center justify-center text-sm text-[#555] mb-2.5">QR Code</div>
        <div className="text-[#888] text-xs">Scan to join with your referral</div>
      </div>

      <button
        className="mx-5 w-[calc(100%-40px)] bg-gradient-to-br from-[#6c47ff] to-[#a78bfa] border-none rounded-xl text-white py-4 text-base font-semibold cursor-pointer"
        onClick={copyLink}
      >
        📋 Copy Referral Link
      </button>
    </div>
  )
}
