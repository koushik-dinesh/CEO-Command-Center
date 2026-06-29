import { Link } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import { navHref } from '../../config/navigation';

interface DrilldownBackLinkProps {
  to?: string;
  label?: string;
}

export default function DrilldownBackLink({
  to = '/',
  label = 'Back to Command Center',
}: DrilldownBackLinkProps) {
  const [searchParams] = useSearchParams();
  const snapshotKey = searchParams.get('snapshot') ?? undefined;

  return (
    <Link to={navHref(to, snapshotKey)} className="cc-back-link mb-4 inline-flex items-center gap-1.5">
      <span aria-hidden="true">←</span>
      {label}
    </Link>
  );
}
