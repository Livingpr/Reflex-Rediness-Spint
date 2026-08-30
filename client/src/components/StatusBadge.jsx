const LABELS = { Requested: "Requested", Assigned: "Assigned", PickedUp: "Picked Up", Delivered: "Delivered" };

export default function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{LABELS[status] || status}</span>;
}
