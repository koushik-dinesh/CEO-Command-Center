import { useCommandCenterContext } from '../../context/CommandCenterContext';

export default function SnapshotAvailabilityBanner() {
  const { data } = useCommandCenterContext();
  const availability = data?.snapshotAvailability;
  if (!availability?.message) return null;
  if (availability.latestSnapshotDate >= availability.expectedDate) return null;

  return (
    <div className="status-note mb-5 rounded-xl px-4 py-3 text-sm" role="status">
      {availability.message}
    </div>
  );
}
