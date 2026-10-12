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
    surfaceContainerLow: string;
    surfaceContainerHigh: string;
    surfaceContainerHighest: string;
    onSurfaceVariant: string;
    outline: string;
    outlineVariant: string;
    inverseSurface: string;
    inverseOnSurface: string;
  }
  interface PaletteOptions {
    assignmentPending?: AssignmentStatusTokens;
    assignmentApproved?: AssignmentStatusTokens;
    assignmentDeclined?: AssignmentStatusTokens;
    surfaceContainer?: string;
    surfaceContainerLow?: string;
    surfaceContainerHigh?: string;
    surfaceContainerHighest?: string;
    onSurfaceVariant?: string;
    outline?: string;
    outlineVariant?: string;
    inverseSurface?: string;
    inverseOnSurface?: string;
  }
}

function assignmentTokens(): {
  assignmentPending: AssignmentStatusTokens;
  assignmentApproved: AssignmentStatusTokens;
  assignmentDeclined: AssignmentStatusTokens;
} {
  return {
    assignmentPending: {
      main: rsPalette.warning,
      onMain: rsPalette.black,
      container: rsPalette.warning,
      onContainer: rsPalette.black,
    },
    assignmentApproved: {
      main: rsPalette.success,
      onMain: rsPalette.white,
      container: rsPalette.success,
      onContainer: rsPalette.white,
    },
    assignmentDeclined: {
      main: rsPalette.error,
      onMain: rsPalette.white,
      container: rsPalette.error,
      onContainer: rsPalette.white,
    },
  };
}

function baseOptions(mode: PaletteMode): ThemeOptions {
  const isDark = mode === 'dark';
  const assignment = assignmentTokens();

  return {
    palette: {
      mode,
      primary: {
        main: isDark ? rsPalette.white : rsPalette.black,
        contrastText: isDark ? rsPalette.black : rsPalette.white,
      },
      secondary: {
        main: rsPalette.neutral,
        contrastText: isDark ? rsPalette.black : rsPalette.white,
      },
      error: {
        main: rsPalette.error,
        contrastText: rsPalette.white,
      },
      warning: {
        main: rsPalette.warning,
        contrastText: rsPalette.black,
      },
      success: {
        main: rsPalette.success,
        contrastText: rsPalette.white,
      },
      background: {
        default: rsPalette[isDark ? 'black' : 'white'],
        paper: rsPalette[isDark ? 'black' : 'white'],
      },
      text: {
        primary: isDark ? rsPalette.white : rsPalette.black,
        secondary: isDark ? rsPalette.white : rsPalette.black,
      },
      divider: rsPalette.neutral,
      surfaceContainerLow: rsPalette[isDark ? 'black' : 'white'],
      surfaceContainer: rsPalette[isDark ? 'black' : 'white'],
      surfaceContainerHigh: isDark
        ? rsPalette.neutralContainerDark
        : rsPalette.neutralContainer,
      surfaceContainerHighest: isDark
        ? rsPalette.neutralContainerDark
        : rsPalette.neutralContainer,
      onSurfaceVariant: isDark ? rsPalette.white : rsPalette.black,
      outline: rsPalette.neutral,
      outlineVariant: isDark
        ? rsPalette.neutralBorderDark
        : rsPalette.neutralBorder,
      inverseSurface: isDark ? rsPalette.white : rsPalette.black,
      inverseOnSurface: isDark ? rsPalette.black : rsPalette.white,
      ...assignment,
    },
    typography: {
      fontFamily: "'Roboto', system-ui, -apple-system, 'Segoe UI', sans-serif",
      h1: {
        fontSize: '1.5rem',
        fontWeight: 600,
        lineHeight: 1.25,
      },
      h2: {
        fontSize: '1.125rem',
        fontWeight: 700,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.3,
      },
      h4: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.3,
      },
      h5: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.3,
      },
      h6: {
        fontSize: '1rem',
        fontWeight: 700,
        lineHeight: 1.3,
      },
      body1: {
        fontSize: '0.9375rem',
        lineHeight: 1.45,
      },
      body2: {
        fontSize: '0.875rem',
        lineHeight: 1.4,
      },
      caption: {
        fontSize: '0.75rem',
        lineHeight: 1.35,
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        fontSize: '0.875rem',
        lineHeight: 1.25,
      },
    },
    shape: {
      borderRadius: 8,
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
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            minHeight: 48,
            minWidth: 48,
            paddingInline: 16,
            borderRadius: 8,
            boxShadow: 'none',
            whiteSpace: 'normal',
            textAlign: 'center',
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
            height: 32,
            fontWeight: 700,
            borderRadius: 8,
          },
          label: {
            paddingInline: 10,
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${
              isDark ? rsPalette.neutralBorderDark : rsPalette.neutralBorder
            }`,
            borderRadius: 12,
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
      MuiInputBase: {
        styleOverrides: {
          root: {
            minHeight: 48,
          },
          input: {
            minHeight: 48,
            boxSizing: 'border-box',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: 8,
            backgroundColor: isDark ? rsPalette.black : rsPalette.white,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: rsPalette.neutral,
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: isDark ? rsPalette.white : rsPalette.black,
            },
          },
          input: {
            minHeight: 48,
            boxSizing: 'border-box',
            padding: '12px 14px',
          },
          multiline: {
            alignItems: 'flex-start',
            padding: 0,
            minHeight: 48,
          },
        },
      },
      MuiNativeSelect: {
        styleOverrides: {
          select: {
            minHeight: 48,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            paddingTop: 12,
            paddingBottom: 12,
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          select: {
            minHeight: 48,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
          },
        },
      },
      MuiFormLabel: {
        styleOverrides: {
          root: {
            color: isDark ? rsPalette.white : rsPalette.black,
            fontSize: '0.875rem',
            fontWeight: 600,
            lineHeight: 1.3,
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            marginInline: 0,
            fontSize: '0.75rem',
            lineHeight: 1.35,
          },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: {
          root: {
            minHeight: 48,
            marginLeft: 0,
            marginRight: 0,
          },
          label: {
            fontSize: '0.9375rem',
            lineHeight: 1.4,
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: {
          root: {
            minHeight: 48,
            fontSize: '0.875rem',
            fontWeight: 600,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 48,
            borderRadius: 8,
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            border: `1px solid ${rsPalette.neutral}`,
            borderRadius: 16,
            backgroundImage: 'none',
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: {
          root: {
            padding: 16,
            fontSize: '1.125rem',
            fontWeight: 700,
            lineHeight: 1.3,
          },
        },
      },
      MuiDialogContent: {
        styleOverrides: {
          root: {
            padding: 16,
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            gap: 8,
            padding: 16,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
        },
      },
      MuiTabs: {
        styleOverrides: {
          root: {
            minHeight: 48,
          },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            minHeight: 48,
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 600,
          },
        },
      },
      MuiCssBaseline: {
        styleOverrides: {
          // Keep PatternFly / rs-* shells in control of document chrome
          body: {
            backgroundColor: 'transparent',
          },
          'a:focus-visible, button:focus-visible, [role="button"]:focus-visible': {
            outline: `2px solid ${isDark ? rsPalette.white : rsPalette.black}`,
            outlineOffset: 2,
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
