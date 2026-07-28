import { Title } from '@patternfly/react-core';
import { useApp } from '@/app/AppContext';

export function AboutPage() {
  const { state } = useApp();

  return (
    <div className="rs-stack">
      <Title headingLevel="h2">About</Title>
      <p>
        <strong>MatchReadyTX</strong> helps referees, CMOs, assigners, and team
        admins manage match appointments, availability, and requests. Fees
        shown in-app are informational only — the app never processes payments.
      </p>
      <p className="rs-match-card__meta">
        Organization: {state.org.name}. This page is informational — use the
        bottom navigation for scheduling tools. Switch role in the header when
        you wear more than one hat (Referee/CMO, Team Admin, or Scheduler).
      </p>
      <ul className="rs-about-list">
        <li>
          <strong>Referee/CMO</strong> — shared lens for officials and coaching
          match officials: appointments, game requests, and reports (badges when
          accepts or reports are due)
        </li>
        <li>
          <strong>Team Admin</strong> — club contact for your team: confirm
          games, propose changes, T-72
        </li>
        <li>
          <strong>Scheduler</strong> — assigner control center: Queues (action
          inbox), Schedule (all matches), Org (Sheet template, sync, release,
          fees)
        </li>
        <li>
          <strong>Global</strong> — society schedule, standings, and teams
        </li>
        <li>
          <strong>Availability</strong> — when you can work (Referee/CMO lens)
        </li>
        <li>
          <strong>Profile</strong> — contact details
        </li>
      </ul>
      <p className="rs-match-card__meta">
        Under Reports: <strong>Match Reports</strong> are filled by referees;
        <strong> Coaching Reports</strong> are filled in the CMO coaching
        context. Appointments and Request (Pending / Global) are the same for
        both.
      </p>
    </div>
  );
}
