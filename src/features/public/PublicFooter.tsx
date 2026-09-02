import { Link } from 'react-router-dom';
import {
  PUBLIC_CONTACT_EMAIL,
  publicContactMailto,
} from '@/features/public/publicContact';

export function PublicFooter({ className }: { className?: string }) {
  return (
    <footer
      className={['rs-public-footer', className].filter(Boolean).join(' ')}
    >
      <Link to="/privacy">Privacy Policy</Link>
      <span className="rs-public-footer__sep" aria-hidden>
        ·
      </span>
      <a href={publicContactMailto()}>{PUBLIC_CONTACT_EMAIL}</a>
    </footer>
  );
}
