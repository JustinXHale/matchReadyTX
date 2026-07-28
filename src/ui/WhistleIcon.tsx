/**
 * Referee whistle — Font Awesome Classic Solid “whistle” silhouette.
 * @see https://fontawesome.com/icons/classic/solid/whistle
 *
 * FA ships this icon in Pro only; path inlined to match that mark for the nav.
 */
export function WhistleIcon({
  className,
  size = 20,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 576 512"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      role="img"
    >
      <path
        fill="currentColor"
        d="M384 64c0-17.7 14.3-32 32-32h32c70.7 0 128 57.3 128 128v32c0 70.7-57.3 128-128 128H352v96c0 17.7-14.3 32-32 32H256c-17.7 0-32-14.3-32-32V320H160c-17.7 0-32-14.3-32-32V224c0-53 43-96 96-96h128V64zm0 64v96h96c35.3 0 64-28.7 64-64v-32c0-35.3-28.7-64-64-64H416c-17.7 0-32 14.3-32 32zM192 160c-17.7 0-32 14.3-32 32v64h64V160H192zm64 256v-96H224v96h32z"
      />
    </svg>
  );
}
