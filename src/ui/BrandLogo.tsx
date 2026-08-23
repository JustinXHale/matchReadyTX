type Props = {
  className?: string;
  width?: number;
  height?: number;
  alt?: string;
};

/**
 * Theme-aware logo — single white asset; light scheme uses brightness(0) in CSS.
 * (matchReadyLogo.png is not a usable masthead icon.)
 */
export function BrandLogo({
  className,
  width = 32,
  height = 32,
  alt = '',
}: Props) {
  const classes = ['rs-brand-logo', className].filter(Boolean).join(' ');
  const isMastheadSize = width === 32 && height === 32;
  return (
    <span
      className={
        isMastheadSize ? 'rs-brand-logo-wrap' : 'rs-brand-logo-wrap rs-brand-logo-wrap--fluid'
      }
      style={
        isMastheadSize
          ? undefined
          : { width, maxWidth: '72vw', aspectRatio: '1' }
      }
    >
      <img
        className={classes}
        src="/matchReadyLogoWHITE.png"
        alt={alt}
        width={width}
        height={height}
        decoding="async"
        style={isMastheadSize ? undefined : { width: '100%', height: 'auto' }}
      />
    </span>
  );
}
