/**
 * One program: its time, its name in bold, and its short description in
 * smaller, muted text. Used by both the weekly table and the phone view.
 */
export default function Program({
  timeLabel,
  showName,
  description,
  large = false,
}: {
  timeLabel: string;
  showName: string;
  description: string;
  large?: boolean;
}) {
  return (
    <div>
      <p className="m-0 text-xs font-semibold tabular-nums text-gold">{timeLabel}</p>
      <p className={`m-0 font-bold leading-snug text-ink ${large ? "text-base" : "text-sm"}`}>{showName}</p>
      {description ? (
        <p className={`m-0 mt-0.5 leading-snug text-ink-soft ${large ? "text-sm" : "text-xs"}`}>{description}</p>
      ) : null}
    </div>
  );
}
