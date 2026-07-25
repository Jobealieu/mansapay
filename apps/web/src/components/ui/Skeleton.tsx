interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return <div className={`animate-pulse rounded-control bg-surface-2 ${className}`} aria-hidden="true" />;
}
