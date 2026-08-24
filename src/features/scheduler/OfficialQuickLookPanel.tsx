import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp, useAppHref } from '@/app/AppContext';
import {
  formatMemberCityState,
  memberListName,
  officialEffectiveLevel,
} from '@/domain/members';
import type { UserProfile } from '@/domain/types';
import { AvailabilityMonthCalendar } from '@/features/availability/AvailabilityMonthCalendar';
import { OfficialInsightsPanel } from '@/features/scheduler/OfficialInsightsPanel';
import { UserAvatar } from '@/ui/UserAvatar';

type QuickLookTab = 'profile' | 'insights';

function levelLabel(user: UserProfile): string {
  const n = officialEffectiveLevel(user);
  return n != null ? String(n) : '—';
}

function formatBegan(value: string | undefined): string {
  if (!value?.trim()) return '—';
  const y = value.trim().slice(0, 4);
  return /^\d{4}$/.test(y) ? y : '—';
}

/** Profile + insights tabs for scheduler quick look. */
export function OfficialQuickLookPanel({ user }: { user: UserProfile }) {
  const { state } = useApp();
  const membersHref = useAppHref('/about/members');
  const memberHref = useAppHref(`/about/members/${user.uid}`);
  const timeZone = state.org.timezone || 'America/Chicago';
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<QuickLookTab>('profile');

  const ranges = useMemo(
    () => state.availability.filter((r) => r.userId === user.uid),
    [state.availability, user.uid],
  );
  const cityState = formatMemberCityState(user);

  return (
    <div className="rs-official-quicklook">
      <nav className="rs-inline-tabs" aria-label="Official quick look">
        <button
          type="button"
          className={
            tab === 'profile'
              ? 'rs-inline-tabs__tab active'
              : 'rs-inline-tabs__tab'
          }
          aria-current={tab === 'profile' ? 'page' : undefined}
          onClick={() => setTab('profile')}
        >
          Profile
        </button>
        <button
          type="button"
          className={
            tab === 'insights'
              ? 'rs-inline-tabs__tab active'
              : 'rs-inline-tabs__tab'
          }
          aria-current={tab === 'insights' ? 'page' : undefined}
          onClick={() => setTab('insights')}
        >
          Insights
        </button>
      </nav>

      {tab === 'profile' ? (
        <>
          <div className="rs-official-quicklook__profile">
            <div className="rs-official-quicklook__identity">
              <UserAvatar user={user} />
              <div>
                <p className="rs-official-quicklook__name">
                  {memberListName(user)}
                </p>
                {user.email && (
                  <p className="rs-match-card__meta">{user.email}</p>
                )}
              </div>
            </div>
            <dl className="rs-ref-profile__facts">
              <div>
                <dt>Level</dt>
                <dd>{levelLabel(user)}</dd>
              </div>
              <div>
                <dt>Started refereeing</dt>
                <dd>{formatBegan(user.refereeingSince)}</dd>
              </div>
              {cityState && (
                <div>
                  <dt>Location</dt>
                  <dd>{cityState}</dd>
                </div>
              )}
              {user.phone?.trim() && (
                <div>
                  <dt>Phone</dt>
                  <dd>{user.phone.trim()}</dd>
                </div>
              )}
            </dl>
            <Link className="rs-official-quicklook__link" to={memberHref}>
              Open full profile
            </Link>
            <Link className="rs-official-quicklook__link" to={membersHref}>
              Members directory
            </Link>
          </div>

          <section aria-labelledby="official-quicklook-availability">
            <h3
              id="official-quicklook-availability"
              className="rs-detail-section__label"
            >
              Availability
            </h3>
            <p className="rs-match-card__meta pf-v6-u-mb-sm">
              Month view — green available, red blocked, gray not set (
              {timeZone.replace(/_/g, ' ')}).
            </p>
            <AvailabilityMonthCalendar
              ranges={ranges}
              userId={user.uid}
              timeZone={timeZone}
              year={year}
              month={month}
              onMonthChange={(y, m) => {
                setYear(y);
                setMonth(m);
              }}
              readOnly
              showLegend
            />
          </section>
        </>
      ) : (
        <OfficialInsightsPanel userId={user.uid} compact />
      )}
    </div>
  );
}
