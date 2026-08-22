import { useEffect, useRef, useState } from 'react';
import { Title } from '@patternfly/react-core';
import { PwaInstallCard } from '@/ui/PwaInstallCard';

const TOC = [
  { id: 'about-why', label: 'Why MatchReadyTX exists' },
  { id: 'about-confirmation', label: 'A different approach to match confirmation' },
  { id: 'about-does', label: 'What the app does' },
  { id: 'about-roles', label: 'Roles in the app' },
  { id: 'about-creator', label: 'Creator' },
] as const;

type TocId = (typeof TOC)[number]['id'];

export function AboutPage() {
  const [activeId, setActiveId] = useState<TocId>(TOC[0].id);
  const suppressSync = useRef(false);

  useEffect(() => {
    const nodes = TOC.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el != null,
    );
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (suppressSync.current) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id as TocId | undefined;
        if (top) setActiveId(top);
      },
      { rootMargin: '-20% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: TocId) => {
    const el = document.getElementById(id);
    if (!el) return;
    suppressSync.current = true;
    setActiveId(id);
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      suppressSync.current = false;
    }, 450);
  };

  return (
    <div className="rs-stack rs-about">
      <header className="rs-about-hero">
        <Title headingLevel="h1">About MatchReadyTX</Title>
        <p>
          MatchReadyTX is a scheduling and match-management app for rugby
          referee organizations.
        </p>
        <p>
          Assigners can keep managing schedules in familiar tools like Google
          Sheets. Referees, coaching match officials, and team administrators
          get a clearer, mobile-friendly way to handle everything around the
          match.
        </p>
        <p>
          Part passion project, part working tool—built for real weekly use and
          open source so other referee organizations can adapt it. First testing
          is with the Lone Star Group in Texas. The “TX” marks where the project
          began; another organization can use the same foundation and make it
          its own.
        </p>
      </header>

      <PwaInstallCard />

      <nav className="rs-about-toc" aria-label="On this page">
        <p className="rs-about-toc__label">On this page</p>
        <div className="rs-about-toc__chips" role="list">
          {TOC.map((item) => {
            const active = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                role="listitem"
                className={`rs-pill rs-about-toc__chip${
                  active ? ' rs-about-toc__chip--active' : ''
                }`}
                aria-current={active ? 'true' : undefined}
                onClick={() => scrollToSection(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <section id="about-why" className="rs-about-section">
        <Title headingLevel="h3" size="md">
          Why MatchReadyTX exists
        </Title>
        <p>
          Rugby organizations have developed many different ways to manage
          scheduling. Referees may receive appointments through one platform,
          teams may use another, and administrators may still maintain the
          actual schedule somewhere else. These systems rarely communicate with
          one another.
        </p>
        <p>
          At the center of it all is often a spreadsheet…probably Google Sheets
          as it is familiar and easy to share—especially for volunteer
          administrators who do not need another complicated system to learn.
        </p>
        <p className="rs-about-lead">
          MatchReadyTX bridges the gap for modern UI with a familiar
          spreadsheet.
        </p>
        <p>
          Assigners keep working in tools they already understand. Referees and
          team contacts get a simpler view of what they need to do next. The
          goal is not to replace every existing process. It is to connect those
          processes and make the day-to-day easier for everyone.
        </p>
      </section>

      <section id="about-confirmation" className="rs-about-section">
        <Title headingLevel="h3" size="md">
          A different approach to match confirmation
        </Title>
        <p>
          Too much of the responsibility for confirming a match often falls on
          the referee.
        </p>
        <p>
          Officials may have to contact both teams, verify that the match is
          still being played, confirm the kickoff time, locate the field, and
          send repeated follow-up messages when nobody responds. In some cases,
          a referee can send four or five emails without receiving an answer.
        </p>
        <p className="rs-about-lead">
          MatchReadyTX puts that responsibility back where it belongs: with the
          teams playing the match.
        </p>
        <p>
          The home and away teams confirm that the match is still being played
          and agree on its date, time, and location. Once those details are in
          place, the assigner can finalize the officiating crew.
        </p>
        <p>
          If the teams do not confirm their match, they are not guaranteed a
          referee. This gives clubs ownership of their responsibilities and
          allows officials to focus on preparing for the match instead of
          chasing information.
        </p>
      </section>

      <section id="about-does" className="rs-about-section">
        <Title headingLevel="h3" size="md">
          What MatchReadyTX does
        </Title>
        <div className="rs-about-features">
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Familiar scheduling</h4>
            <p>
              The organization’s Google Sheet remains the schedule’s source of
              truth. Assigners keep working the way they already do; the app
              shows that information in a clearer format.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Team confirmation</h4>
            <p>
              Home and away administrators confirm that the match is going
              forward and verify the date, kickoff time, and venue before crew
              assignment is finished.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Assignment management</h4>
            <p>
              Officials can view appointments, accept assignments, and request
              available matches. Assigners work those requests and other open
              items in Queues.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Controlled crew visibility</h4>
            <p>
              Teams see officiating details only when the assignment is ready.
              The crew becomes visible after the Match Official has confirmed.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Timely reminders</h4>
            <p>
              As kickoff approaches, reminders help teams and officials catch
              details that may have slipped during a busy week.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Post-match reporting</h4>
            <p>
              Referees and coaching match officials can file their reports in
              the same place they manage the appointment.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Match and travel information</h4>
            <p>
              Schedulers can view match fees and flight/housing flags when
              assigning. Referees, team admins, and fans see kickoff, venue, and
              crew visibility rules only — not pay rates. MatchReadyTX does not
              collect or distribute payments.
            </p>
          </article>
        </div>
      </section>

      <section id="about-roles" className="rs-about-section">
        <Title headingLevel="h3" size="md">
          Roles in the app
        </Title>
        <div className="rs-about-features">
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Referee / CMO</h4>
            <p>
              Shared view for referees and coaching match officials. Manage
              appointments, request matches, submit reports, and see when an
              acceptance or report needs attention.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Team Admin</h4>
            <p>
              For club contacts. Confirm fixtures, verify match details,
              propose changes, and respond to open requests as kickoff
              approaches.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Scheduler</h4>
            <p>
              The assigner’s control center: Queues, Schedule, and Org. Assign
              crews, sync the Google Sheet, release schedules, and maintain fee
              information.
            </p>
          </article>
          <article className="rs-about-feature">
            <h4 className="rs-about-feature__title">Fan</h4>
            <p>
              Browse the schedule, standings, and teams. Official names stay
              hidden until a Match Official has confirmed — same rule as for
              club contacts. The member directory is not shown to fans.
            </p>
          </article>
        </div>
      </section>

      <section id="about-creator" className="rs-about-section">
        <Title headingLevel="h3" size="md">
          Creator
        </Title>
        <div className="rs-about-maker">
          <div className="rs-about-maker__avatar" aria-hidden>
            JH
          </div>
          <div className="rs-about-maker__body">
            <p className="rs-about-maker__name">Justin X. Hale</p>
            <p className="rs-about-maker__role">
              Designer &amp; developer
            </p>
            <p>
              Rugby player since 2008, referee since 2017. Justin X. Hale has
              worked Major League Rugby, RugbyTown 7s, Coral Coast 7s in Fiji,
              and USA Rugby National Championships. By day a product designer —
              MatchReadyTX is where officiating, assigning, and design met.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
