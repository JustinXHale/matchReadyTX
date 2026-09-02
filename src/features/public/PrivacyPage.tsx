import { Button } from '@patternfly/react-core';
import { useNavigate } from 'react-router-dom';
import {
  PRIVACY_POLICY_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
} from '@/features/public/privacyPolicyContent';
import { PublicFooter } from '@/features/public/PublicFooter';
import './public.css';

function PolicyBlock({
  paragraphs,
  bullets,
}: {
  paragraphs?: string[];
  bullets?: string[];
}) {
  return (
    <>
      {paragraphs?.map((text) => (
        <p key={text.slice(0, 48)}>{text}</p>
      ))}
      {bullets && bullets.length > 0 && (
        <ul>
          {bullets.map((item) => (
            <li key={item.slice(0, 48)}>{item}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <article className="rs-public-policy">
      <header className="rs-public-policy__header">
        <Button
          variant="link"
          className="rs-public-policy__back"
          onClick={() => navigate('/')}
        >
          ← Back to home
        </Button>
        <h1>Privacy Policy</h1>
        <p className="rs-public-policy__updated">
          Last updated: {PRIVACY_POLICY_LAST_UPDATED}
        </p>
      </header>

      {PRIVACY_POLICY_SECTIONS.map((section) => (
        <section
          key={section.title}
          id={section.id}
          aria-labelledby={`privacy-${section.title}`}
        >
          <h2 id={`privacy-${section.title}`}>{section.title}</h2>
          <PolicyBlock
            paragraphs={section.paragraphs}
            bullets={section.bullets}
          />
          {section.subsections?.map((sub) => (
            <div key={sub.title}>
              <h3>{sub.title}</h3>
              <PolicyBlock paragraphs={sub.paragraphs} bullets={sub.bullets} />
            </div>
          ))}
        </section>
      ))}

      <PublicFooter />
    </article>
  );
}
