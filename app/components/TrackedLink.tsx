"use client";

import { trackClick } from "@/lib/analytics/client";

/**
 * A normal link that also counts the click (which sermon / which prayer point).
 * Only the item's id is sent; the server looks up the title itself.
 */
export default function TrackedLink({
  kind,
  itemId,
  children,
  ...anchorProps
}: {
  kind: "sermon" | "prayer";
  itemId: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "onClick" | "onAuxClick">) {
  return (
    <a
      {...anchorProps}
      onClick={() => trackClick(kind, itemId)}
      // Middle-click (open in a new tab) doesn't send a normal click.
      onAuxClick={(event) => {
        if (event.button === 1) trackClick(kind, itemId);
      }}
    >
      {children}
    </a>
  );
}
