import { useMemo, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useApp } from '@/app/AppContext';
import {
  assignmentAlertLabel,
  resolveAssignmentAlertStatus,
  type AssignmentAlertStatus,
} from '@/domain/assignmentAlert';
import {
  formatMatchCardWeekday,
  formatMatchKickoffTime,
  orgTimeZone,
} from '@/domain/matchTime';
import { matchGameplayFormat } from '@/domain/matchGameplayFormat';
import {
  formatTeamDisplayLabel,
  matchCardEventLabel,
  matchShowsTeamConfirmation,
  matchTeamConfirmationState,
  matchTeamDisplayNames,
  type TeamConfirmationState,
} from '@/domain/matchCardFooter';
import { genderLabel, type GameRequest, type Match } from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';
import { assignmentStatusPaletteKey } from '@/theme/m3Theme';
import type { MatchCardStatusPresentation } from '@/ui/matchCardStatus';

function dayOrdinal(day: number): string {
  const j = day % 10;
  const k = day % 100;
  if (k >= 11 && k <= 13) return `${day}th`;
  if (j === 1) return `${day}st`;
  if (j === 2) return `${day}nd`;
  if (j === 3) return `${day}rd`;
  return `${day}th`;
}

function formatCardDate(
  iso: string,
  timeZone: string,
): { month: string; day: string } {
  const d = new Date(iso);
  const month = d.toLocaleDateString(undefined, {
    month: 'short',
    timeZone,
  });
  const dayNum = Number(
    d.toLocaleDateString(undefined, { day: 'numeric', timeZone }),
  );
  return { month, day: dayOrdinal(dayNum) };
}

function hasMatchScore(match: Match): boolean {
  return (
    match.homeScore != null &&
    match.awayScore != null &&
    Number.isFinite(match.homeScore) &&
    Number.isFinite(match.awayScore)
  );
}

function TeamConfirmationChip({ state }: { state: TeamConfirmationState }) {
  if (!state) return null;
  const confirmed = state === 'confirmed';
  return (
    <Chip
      size="small"
      label={confirmed ? 'Confirmed' : 'Unconfirmed'}
      sx={{
        flex: '0 0 auto',
        alignSelf: 'center',
        height: 20,
        minHeight: 20,
        bgcolor: confirmed ? 'success.main' : 'error.main',
        color: confirmed ? 'success.contrastText' : 'error.contrastText',
        border: (theme) =>
          `1px solid ${confirmed ? theme.palette.success.main : theme.palette.error.main}`,
        fontSize: '0.625rem',
        fontWeight: 800,
        '& .MuiChip-label': { px: 0.625 },
      }}
    />
  );
}

export type MatchSummaryCardProps = {
  /** Firestore-backed match from AppContext / org listeners. */
  match: Match;
  /** Current official uid — used with crew slots when `request` is absent. */
  userId?: string;
  /** Raise-hand GameRequest when showing Pending / Declined queues. */
  request?: GameRequest | null;
  /** Override resolved status (tests / special surfaces). */
  assignmentStatus?: AssignmentAlertStatus;
  /** Persona-specific status copy using the same semantic card treatment. */
  statusPresentation?: MatchCardStatusPresentation;
  /** Hide a redundant primary status label while preserving its card treatment. */
  hidePrimaryStatus?: boolean;
  /** Stronger scheduler treatment when the match still needs its MO assigned. */
  emphasizeOfficialNeeded?: boolean;
  /** Additional non-primary states displayed beside the primary status. */
  supportingStatuses?: MatchCardStatusPresentation[];
  to?: string;
  back?: BackNav;
  showTime?: boolean;
  /** Sibling outside the card link (e.g. Remove / Dismiss). */
  aside?: ReactNode;
  /** Full-width decision / raise-hand surface above the primary card row. */
  topBanner?: ReactNode;
  /** Full-width supporting content below the primary card row. */
  footer?: ReactNode;
  meta?: ReactNode;
};

/**
 * Shared Material 3 match card. Personas supply status and visibility while
 * date, metadata, teams, interaction, and footer layout remain identical.
 */
export function MatchSummaryCard({
  match,
  userId,
  request = null,
  assignmentStatus: statusOverride,
  statusPresentation,
  hidePrimaryStatus = false,
  emphasizeOfficialNeeded = false,
  supportingStatuses = [],
  to,
  back,
  showTime = true,
  aside,
  topBanner,
  footer,
  meta,
}: MatchSummaryCardProps) {
  const theme = useTheme();
  const { state } = useApp();
  const timeZone = orgTimeZone(state.org.timezone);

  const teamsById = useMemo(
    () => new Map(state.teams.map((t) => [t.id, t])),
    [state.teams],
  );
  const { home, away } = useMemo(
    () => matchTeamDisplayNames(match, teamsById),
    [match, teamsById],
  );
  const homeName = formatTeamDisplayLabel(home);
  const awayName = formatTeamDisplayLabel(away);
  const eventLabel = matchCardEventLabel(match);
  const homeConfirmation = matchTeamConfirmationState(match, 'home');
  const awayConfirmation = matchTeamConfirmationState(match, 'away');
  const homeConfirmationText = homeConfirmation
    ? `, ${homeConfirmation}`
    : '';
  const awayConfirmationText = awayConfirmation
    ? `, ${awayConfirmation}`
    : '';
  const { month, day } = formatCardDate(match.kickoffAt, timeZone);
  const weekday = formatMatchCardWeekday(match.kickoffAt, timeZone);
  const format = matchGameplayFormat(match);
  const linkState = back ? backState(back) : undefined;
  const scored = hasMatchScore(match);
  const homeScore = scored ? String(match.homeScore) : '–';
  const awayScore = scored ? String(match.awayScore) : '–';

  const status =
    statusPresentation?.tone ??
    statusOverride ??
    resolveAssignmentAlertStatus(match, userId ?? '', request);
  const statusKey = assignmentStatusPaletteKey(status);
  const statusTokens = theme.palette[statusKey];
  const statusLabel =
    statusPresentation?.label ?? assignmentAlertLabel(status);
  const redundantTeamStatus =
    matchShowsTeamConfirmation(match) &&
    ['Confirmed', 'Teams confirmed', 'Needs confirm', 'Needs team confirm'].includes(
      statusLabel,
    );
  const showPrimaryStatus =
    !hidePrimaryStatus &&
    statusLabel !== 'Crew confirmed' &&
    !redundantTeamStatus;
  const primaryStatusAria = showPrimaryStatus ? `; ${statusLabel}` : '';
  const inactiveMatch =
    match.status === 'cancelled' ||
    Boolean(match.forfeitTeamId) ||
    match.playedForfeit === true;
  const officialNeededEmphasis = emphasizeOfficialNeeded && !inactiveMatch;

  const venue =
    match.venueAddress?.trim() || match.venueName?.trim() || null;

  const content = (
    <CardContent
      sx={{
        display: 'flex',
        gap: 1.5,
        alignItems: 'stretch',
        p: 2,
        '&:last-child': { pb: 2 },
        minHeight: 88,
        color: inactiveMatch ? 'text.secondary' : 'text.primary',
        '& .MuiTypography-root': inactiveMatch
          ? { opacity: 0.72 }
          : undefined,
      }}
    >
      <Box
        aria-hidden
        sx={{
          flex: '0 0 auto',
          minWidth: 52,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 0.5,
          bgcolor: 'transparent',
          color: 'text.primary',
        }}
      >
        <Typography variant="caption" fontWeight={700} lineHeight={1.2}>
          {month}
        </Typography>
        <Typography component="span" variant="h6" fontWeight={800} lineHeight={1.1}>
          {day}
        </Typography>
        {weekday ? (
          <Typography
            variant="caption"
            color="text.secondary"
            lineHeight={1.2}
          >
            {weekday}
          </Typography>
        ) : null}
      </Box>

      <Stack spacing={0.75} sx={{ flex: 1, minWidth: 0 }}>
        <Stack
          direction="row"
          spacing={0.5}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          aria-label="Game type"
        >
          <Chip
            size="small"
            label={genderLabel(match.gender)}
            sx={{
              height: 22,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              border: (t) => `1px solid ${t.palette.primary.main}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          <Chip
            size="small"
            label={match.level}
            sx={{
              height: 22,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              border: (t) => `1px solid ${t.palette.primary.main}`,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
          {format ? (
            <Chip
              size="small"
              label={format}
              variant="outlined"
              sx={{ height: 22, '& .MuiChip-label': { px: 0.75 } }}
            />
          ) : null}
        </Stack>

        {showTime || venue ? (
          <Stack
            direction="row"
            spacing={1}
            useFlexGap
            flexWrap="wrap"
            alignItems="baseline"
          >
            {showTime ? (
              <Typography variant="body2" color="text.secondary">
                {formatMatchKickoffTime(match.kickoffAt, timeZone)}
              </Typography>
            ) : null}
            {showTime && venue ? (
              <Typography component="span" variant="body2" color="text.secondary" aria-hidden>
                |
              </Typography>
            ) : null}
            {venue ? (
              <Typography
                variant="body2"
                color="text.secondary"
                noWrap
                title={venue}
                sx={{ minWidth: 0 }}
              >
                {venue}
              </Typography>
            ) : null}
          </Stack>
        ) : null}

        {eventLabel ? (
          <Typography variant="caption" color="text.secondary">
            {eventLabel}
          </Typography>
        ) : null}

        <Stack
          spacing={0.25}
          role="group"
          aria-label={
            scored
              ? `Home ${homeName}, ${homeConfirmation ?? 'confirmation not applicable'}, score ${homeScore}; away ${awayName}, ${awayConfirmation ?? 'confirmation not applicable'}, score ${awayScore}`
              : `Home ${homeName}, ${homeConfirmation ?? 'confirmation not applicable'}; away ${awayName}, ${awayConfirmation ?? 'confirmation not applicable'}`
          }
          sx={{ m: 0 }}
        >
          <Stack direction="row" spacing={1} alignItems="baseline">
            <Typography
              variant="subtitle1"
              fontWeight={700}
              component="p"
              sx={{ m: 0, lineHeight: 1.3, flex: 1, minWidth: 0 }}
            >
              <Typography component="span" color="text.secondary" sx={{ mr: 0.5 }}>
                (H)
              </Typography>
              {homeName}
            </Typography>
            <TeamConfirmationChip state={homeConfirmation} />
            <Typography
              component="span"
              variant="subtitle1"
              fontWeight={scored ? 800 : 500}
              color={scored ? 'text.primary' : 'text.secondary'}
              sx={{ minWidth: '1.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              aria-hidden
            >
              {homeScore}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="baseline">
            <Typography
              variant="subtitle1"
              fontWeight={700}
              component="p"
              sx={{ m: 0, lineHeight: 1.3, flex: 1, minWidth: 0 }}
            >
              <Typography component="span" color="text.secondary" sx={{ mr: 0.5 }}>
                (A)
              </Typography>
              {awayName}
            </Typography>
            <TeamConfirmationChip state={awayConfirmation} />
            <Typography
              component="span"
              variant="subtitle1"
              fontWeight={scored ? 800 : 500}
              color={scored ? 'text.primary' : 'text.secondary'}
              sx={{ minWidth: '1.5rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}
              aria-hidden
            >
              {awayScore}
            </Typography>
          </Stack>
        </Stack>

        {showPrimaryStatus || supportingStatuses.length > 0 ? (
          <Stack
            direction="row"
            spacing={0.5}
            useFlexGap
            flexWrap="wrap"
            alignItems="center"
            aria-label="Assignment status"
          >
            {showPrimaryStatus ? (
              <Chip
                size="small"
                label={statusLabel}
                role="status"
                aria-label={`Match status: ${statusLabel}`}
                sx={{
                  bgcolor: statusTokens.container,
                  color: statusTokens.onContainer,
                  border: `1px solid ${statusTokens.main}`,
                  fontWeight: 800,
                  height: 22,
                  minHeight: 22,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            ) : null}
            {supportingStatuses.map((item, index) => {
              const tokens =
                theme.palette[assignmentStatusPaletteKey(item.tone)];
              return (
                <Chip
                  key={`${item.label}-${index}`}
                  size="small"
                  label={item.label}
                  role="status"
                  aria-label={`Match status: ${item.label}`}
                  sx={{
                    bgcolor: tokens.container,
                    color: tokens.onContainer,
                    border: `1px solid ${tokens.main}`,
                    fontWeight: 800,
                    height: 22,
                    minHeight: 22,
                    '& .MuiChip-label': { px: 0.75 },
                  }}
                />
              );
            })}
          </Stack>
        ) : null}

        {request?.declineReason?.trim() && status === 'declined' ? (
          <Typography
            variant="body2"
            sx={{
              color: statusTokens.onContainer,
              bgcolor: statusTokens.container,
              borderRadius: 'var(--rs-radius-chip)',
              px: 1,
              py: 0.75,
              mt: 0.25,
            }}
          >
            Declined: {request.declineReason.trim()}
          </Typography>
        ) : null}

        {meta}
      </Stack>
    </CardContent>
  );

  return (
    <Card
      className="rs-match-summary-card"
      elevation={0}
      sx={{
        bgcolor: inactiveMatch ? 'surfaceContainerHigh' : 'background.paper',
        border: (t) =>
          officialNeededEmphasis
            ? `2px solid ${t.palette.assignmentPending.main}`
            : `1px solid ${t.palette.outlineVariant}`,
        borderLeft: officialNeededEmphasis
          ? `2px solid ${theme.palette.assignmentPending.main}`
          : `4px solid ${statusTokens.main}`,
        overflow: 'hidden',
      }}
      data-assignment-status={status}
      data-card-emphasis={officialNeededEmphasis ? 'official-needed' : undefined}
      data-match-inactive={inactiveMatch ? 'true' : undefined}
    >
      {topBanner ? (
        <Box
          className="rs-list-row__top-banner"
          sx={{
            width: '100%',
            borderBottom: (t) => `1px solid ${t.palette.outlineVariant}`,
            bgcolor: (t) => t.palette.surfaceContainerHigh,
            '& > *': inactiveMatch ? { opacity: 0.72 } : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {topBanner}
        </Box>
      ) : null}
      <Box sx={{ display: 'flex', alignItems: 'stretch', width: '100%' }}>
        {to ? (
          <CardActionArea
            component={RouterLink}
            to={to}
            state={linkState}
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 88,
              alignItems: 'stretch',
            }}
            aria-label={
              scored
                ? `${homeName}${homeConfirmationText}, score ${homeScore}, versus ${awayName}${awayConfirmationText}, score ${awayScore}${primaryStatusAria}`
                : `${homeName}${homeConfirmationText} versus ${awayName}${awayConfirmationText}${primaryStatusAria}`
            }
          >
            {content}
          </CardActionArea>
        ) : (
          <Box sx={{ flex: 1, minWidth: 0 }}>{content}</Box>
        )}

        {aside ? (
          <Box
            sx={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'stretch',
              borderLeft: (t) => `1px solid ${t.palette.outlineVariant}`,
              minWidth: 72,
              '& > *': {
                minHeight: 48,
                minWidth: 72,
              },
            }}
          >
            {aside}
          </Box>
        ) : null}
      </Box>
      {footer ? (
        <Box
          className="rs-match-summary-card__footer"
          sx={{
            width: '100%',
            px: 1,
            py: 0,
            borderTop: (t) => `1px solid ${t.palette.outlineVariant}`,
            bgcolor: (t) => t.palette.surfaceContainerHigh,
            '&:has(> .rs-coverage-requesters)': {
              px: 0,
              py: 0,
            },
          }}
        >
          {footer}
        </Box>
      ) : null}
    </Card>
  );
}
