import { createTheme, type ThemeOptions, type PaletteMode } from '@mui/material/styles';
import type { AssignmentAlertStatus } from '@/domain/assignmentAlert';
import { rsPalette } from '@/theme/paletteLiterals';

/**
 * Assignment alert roles for field scheduling (raise-hand + crew accept).
 * Maps to M3 tonal containers — status is never color-only (Chip label + role).
 */
export type AssignmentStatusTokens = {
  main: string;
  onMain: string;
  container: string;
  onContainer: string;
};

declare module '@mui/material/styles' {
  interface Palette {
    assignmentPending: AssignmentStatusTokens;
    assignmentApproved: AssignmentStatusTokens;
    assignmentDeclined: AssignmentStatusTokens;
    surfaceContainer: string;
    surfaceContainerHigh: string;
    onSurfaceVariant: string;
    outlineVariant: string;
  }
  interface PaletteOptions {
    assignmentPending?: AssignmentStatusTokens;
    assignmentApproved?: AssignmentStatusTokens;
    assignmentDeclined?: AssignmentStatusTokens;
    surfaceContainer?: string;
    surfaceContainerHigh?: string;
    onSurfaceVariant?: string;
    outlineVariant?: string;
  }
}

function lightAssignmentTokens(): {
  assignmentPending: AssignmentStatusTokens;
  assignmentApproved: AssignmentStatusTokens;
  assignmentDeclined: AssignmentStatusTokens;
} {
  return {
    // Warn tonal — awaiting assigner / accept
    assignmentPending: {
      main: rsPalette.yellowWarn,
      onMain: rsPalette.black,
      container: '#FEF3C7',
      onContainer: '#713F12',
    },
    // Success tonal — confirmed / approved
    assignmentApproved: {
      main: rsPalette.greenOk,
      onMain: rsPalette.white,
      container: '#DCFCE7',
      onContainer: '#14532D',
    },
    // Error tonal — declined / released
    assignmentDeclined: {
      main: rsPalette.redUrgent,
      onMain: rsPalette.white,
      container: '#FEE2E2',
      onContainer: '#7F1D1D',
    },
  };
}

function darkAssignmentTokens(): {
  assignmentPending: AssignmentStatusTokens;
  assignmentApproved: AssignmentStatusTokens;
  assignmentDeclined: AssignmentStatusTokens;
} {
  return {
    assignmentPending: {
      main: rsPalette.yellowWarnVivid,
      onMain: rsPalette.black,
      container: '#422006',
      onContainer: '#FDE68A',
    },
    assignmentApproved: {
      main: '#4ADE80',
      onMain: rsPalette.black,
      container: '#14532D',
      onContainer: '#BBF7D0',
    },
    assignmentDeclined: {
      main: '#F87171',
      onMain: rsPalette.black,
      container: '#7F1D1D',
      onContainer: '#FECACA',
    },
  };
}

function baseOptions(mode: PaletteMode): ThemeOptions {
  const isDark = mode === 'dark';
  const assignment = isDark ? darkAssignmentTokens() : lightAssignmentTokens();

  return {
    palette: {
      mode,
      primary: {
        main: isDark ? rsPalette.white : rsPalette.black,
        contrastText: isDark ? rsPalette.black : rsPalette.white,
      },
      secondary: {
        main: isDark ? rsPalette.grayMuted : rsPalette.gray700,
        contrastText: isDark ? rsPalette.black : rsPalette.white,
      },
      error: {
        main: isDark ? '#F87171' : rsPalette.redUrgent,
        contrastText: isDark ? rsPalette.black : rsPalette.white,
      },
      warning: {
        main: isDark ? rsPalette.yellowWarnVivid : rsPalette.yellowWarn,
        contrastText: rsPalette.black,
      },
      success: {
        main: isDark ? '#4ADE80' : rsPalette.greenOk,
        contrastText: isDark ? rsPalette.black : rsPalette.white,
      },
      background: {
        default: isDark ? rsPalette.black : rsPalette.gray50,
        paper: isDark ? rsPalette.gray950 : rsPalette.white,
      },
      text: {
        primary: isDark ? rsPalette.white : rsPalette.black,
        secondary: isDark ? rsPalette.grayMuted : rsPalette.gray600,
      },
      divider: isDark ? rsPalette.grayBorder : rsPalette.gray200,
      surfaceContainer: isDark ? rsPalette.gray950 : rsPalette.white,
      surfaceContainerHigh: isDark ? '#1C1C1C' : rsPalette.gray100,
      onSurfaceVariant: isDark ? rsPalette.grayEnded : rsPalette.gray500,
      outlineVariant: isDark ? rsPalette.grayBorder : rsPalette.gray200,
      ...assignment,
    },
    typography: {
      fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', sans-serif",
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    shape: {
      borderRadius: 12,
    },
    // Touch-first: 48px minimum interactive height for referee field use
    components: {
      MuiButtonBase: {
        defaultProps: {
          disableRipple: false,
        },
        styleOverrides: {
          root: {
            minHeight: 48,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 48,
            minWidth: 48,
            paddingInline: 16,
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            width: 48,
            height: 48,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            minHeight: 32,
            fontWeight: 700,
          },
          label: {
            paddingInline: 10,
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 1,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiCardActionArea: {
        styleOverrides: {
          root: {
            minHeight: 48,
            alignItems: 'stretch',
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          // Keep PatternFly / rs-* shells in control of document chrome
          body: {
            backgroundColor: 'transparent',
          },
        },
      },
    },
  };
}

/** Accessible Material 3 theme for MatchReadyTX (light or dark). */
export function createMatchReadyTheme(mode: PaletteMode = 'light') {
  return createTheme(baseOptions(mode));
}

export function assignmentStatusPaletteKey(
  status: AssignmentAlertStatus,
): 'assignmentPending' | 'assignmentApproved' | 'assignmentDeclined' {
  if (status === 'pending') return 'assignmentPending';
  if (status === 'approved') return 'assignmentApproved';
  return 'assignmentDeclined';
}
