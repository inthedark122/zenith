interface BrandLogoProps {
  className?: string
  compact?: boolean
  alt?: string
}

export default function BrandLogo({
  className = '',
  compact = false,
  alt = 'Zenith',
}: BrandLogoProps) {
  const src = compact ? '/brand/zenith-icon-192.png' : '/brand/zenith-logo.png'

  return <img src={src} alt={alt} className={className} />
}
