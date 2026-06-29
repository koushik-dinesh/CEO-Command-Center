import { Link } from 'react-router-dom';
import { navHref } from '../../config/navigation';

interface NavBackButtonProps {
  to: string;
  label: string;
  snapshotKey?: string;
}

export default function NavBackButton({
  to,
  label,
  snapshotKey,
}: NavBackButtonProps) {
  return (
    <Link
      to={navHref(to, snapshotKey)}
      className="exec-nav-back-btn"
      title={label}
      aria-label={label}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M10 3.5 5.5 8 10 12.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
