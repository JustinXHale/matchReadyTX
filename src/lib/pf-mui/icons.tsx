import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEllipsisV } from '@fortawesome/free-solid-svg-icons';

/** PatternFly EllipsisVIcon stand-in. */
export function EllipsisVIcon(props: { 'aria-hidden'?: boolean | 'true' }) {
  return (
    <FontAwesomeIcon
      icon={faEllipsisV}
      aria-hidden={props['aria-hidden'] !== false}
    />
  );
}
