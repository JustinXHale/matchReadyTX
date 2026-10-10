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
  matchTeamDisplayNames,
} from '@/domain/matchCardFooter';
import { genderLabel, type GameRequest, type Match } from '@/domain/types';
import { backState, type BackNav } from '@/nav/backNav';
import { assignmentStatusPaletteKey } from '@/theme/m3Theme';

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

export type RefereeCardProps = {
  /** Firestore-backed match from AppContext / org listeners. */
  match: Match;
  /** Current official uid — used with crew slots when `request` is absent. */
  userId: string;
  /** Raise-hand GameRequest when showing Pending / Declined queues. */
  request?: GameRequest | null;
  /** Override resolved status (tests / special surfaces). */
  assignmentStatus?: AssignmentAlertStatus;
  to?: string;
  back?: BackNav;
  showTime?: boolean;
  /** Sibling outside the card link (e.g. Remove / Dismiss). */
  aside?: ReactNode;
  meta?: ReactNode;
};

/**
 * Material 3 elevated Card for mobile referees.
 * Same Match / GameRequest fields as MatchListRow — Firebase bindings unchanged.
 */
export function RefereeCard({
  match,
  userId,
  request = null,
  assignmentStatus: statusOverride,
  to,
  back,
  showTime = true,
  aside,
  meta,
}: RefereeCardProps) {
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
  const { month, day } = formatCardDate(match.kickoffAt, timeZone);
  const weekday = formatMatchCardWeekday(match.kickoffAt, timeZone);
  const format = matchGameplayFormat(match);
  const linkState = back ? backState(back) : undefined;

  const status =
    statusOverride ??
    resolveAssignmentAlertStatus(match, userId, request);
  const statusKey = assignmentStatusPaletteKey(status);
  const statusTokens = theme.palette[statusKey];
  const statusLabel = assignmentAlertLabel(status);

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
          borderRadius: 2,
          bgcolor: (t) => t.palette.surfaceContainerHigh,
          color: 'text.primary',
        }}
      >
        <Typography variant="caption" fontWeight={700} lineHeight={1.2}>
          {month}
        </Typography>
        <Typography variant="h6" fontWeight={800} lineHeight={1.1}>
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
          spacing={0.75}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          aria-label="Game type and assignment status"
        >
          <Chip
            size="small"
            label={statusLabel}
            role="status"
            aria-label={`Assignment ${statusLabel}`}
            sx={{
              bgcolor: statusTokens.container,
              color: statusTokens.onContainer,
              border: `1px solid ${statusTokens.main}`,
              fontWeight: 800,
              minHeight: 32,
            }}
          />
          <Chip size="small" label={genderLabel(match.gender)} variant="outlined" />
          <Chip size="small" label={match.level} variant="outlined" />
          {format ? (
            <Chip size="small" label={format} variant="outlined" />
          ) : null}
        </Stack>

        {venue ? (
          <Typography
            variant="body2"
            color="text.secondary"
            noWrap
            title={venue}
          >
            {venue}
          </Typography>
        ) : null}

        <Typography
          variant="subtitle1"
          fontWeight={700}
          component="p"
          sx={{ m: 0, lineHeight: 1.3 }}
          aria-label={`Home ${homeName}, away ${awayName}`}
        >
          {homeName}
          <Typography
            component="span"
            color="text.secondary"
            sx={{ mx: 0.75 }}
          >
            vs
          </Typography>
          {awayName}
        </Typography>

        {showTime ? (
          <Typography variant="body2" color="text.secondary">
            {formatMatchKickoffTime(match.kickoffAt, timeZone)}
          </Typography>
        ) : null}

        {eventLabel ? (
          <Typography variant="caption" color="text.secondary">
            {eventLabel}
          </Typography>
        ) : null}

        {request?.declineReason?.trim() && status === 'declined' ? (
          <Typography
            variant="body2"
            sx={{
              color: statusTokens.onContainer,
              bgcolor: statusTokens.container,
              borderRadius: 1,
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
      elevation={1}
      sx={{
        bgcolor: 'background.paper',
        border: (t) => `1px solid ${t.palette.outlineVariant}`,
        borderLeft: `4px solid ${statusTokens.main}`,
        overflow: 'hidden',
      }}
      data-assignment-status={status}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'stretch',
          width: '100%',
        }}
      >
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
            aria-label={`${homeName} versus ${awayName}, ${statusLabel}`}
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
    </Card>
  );
}
