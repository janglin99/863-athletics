interface PageHeaderProps {
  title: string
  description?: string
  action?: React.ReactNode
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-8">
      <div>
        <h1 className="text-3xl font-bold font-display uppercase tracking-wide text-text-primary">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  )
}
