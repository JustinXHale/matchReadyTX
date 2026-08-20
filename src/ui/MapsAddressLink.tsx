/** Opens the venue in Maps — same treatment as match info “Where”. */
export function MapsAddressLink({
  href,
  children,
}: {
  href: string | null;
  children: string;
}) {
  if (!href || !children.trim() || children === '—') {
    return <>{children}</>;
  }
  return (
    <a
      className="rs-detail-meta__maps"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  );
}
