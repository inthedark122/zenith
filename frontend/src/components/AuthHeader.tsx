import BrandLogo from './BrandLogo'

interface AuthHeaderProps {
  title: string
  subtitle?: string
}

export default function AuthHeader({ title, subtitle }: AuthHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-[36px] font-bold leading-tight tracking-tight text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <BrandLogo className="w-20 h-auto flex-shrink-0 mt-1" />
    </div>
  )
}
