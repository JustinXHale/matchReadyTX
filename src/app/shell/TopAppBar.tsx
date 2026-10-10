import {
  Button,
  FormSelect,
  FormSelectOption,
} from '@patternfly/react-core';
import { ROLE_VIEW_LABELS, type RoleView } from '@/app/AppContext';
import { appBuildLabel } from '@/app/appBuild';
import { BrandLogo } from '@/ui/BrandLogo';
import { ThemeToggle } from '@/ui/ThemeToggle';
import { OfficialQuickLookPicker } from '@/features/scheduler/officialQuickLookContext';

type Props = {
  clockLabel: string;
  todayIso: string;
  inDemoTree: boolean;
  hasFirebaseSession: boolean;
  canSwitchRoleView: boolean;
  availableLenses: RoleView[];
  roleView: RoleView;
  isAssignerView: boolean;
  hasAssignerRole: boolean;
  onEnterLive: () => void;
  onSignIn: () => void;
  onSwitchView: (next: RoleView) => void;
};

/**
 * Material 3 Top app bar — brand, contextual actions (demo/live, role lens).
 * PatternFly FormSelect/Button retained for existing role-switch styles.
 */
export function TopAppBar({
  clockLabel,
  todayIso,
  inDemoTree,
  hasFirebaseSession,
  canSwitchRoleView,
  availableLenses,
  roleView,
  isAssignerView,
  hasAssignerRole,
  onEnterLive,
  onSignIn,
  onSwitchView,
}: Props) {
  return (
    <header className="rs-top-app-bar rs-masthead">
      <div className="rs-top-app-bar__main rs-masthead__main">
        <div className="rs-top-app-bar__brand rs-masthead__brand">
          <span className="rs-brand-block">
            <span className="rs-brand-row">
              <BrandLogo width={32} height={32} />
              <span className="rs-brand">MatchReadyTX</span>
              <ThemeToggle />
              {inDemoTree && (
                <span
                  className="rs-demo-badge"
                  title="Seed showcase — not your live org"
                >
                  Demo
                </span>
              )}
            </span>
            <time className="rs-brand-date" dateTime={todayIso}>
              {clockLabel}
            </time>
            <span className="rs-brand-build">{appBuildLabel()}</span>
          </span>
        </div>
      </div>
      <div className="rs-top-app-bar__actions rs-masthead__content">
        {inDemoTree && hasFirebaseSession && (
          <Button variant="link" className="rs-demo-live" onClick={onEnterLive}>
            Back to live
          </Button>
        )}
        {inDemoTree && !hasFirebaseSession && (
          <Button variant="link" className="rs-demo-signin" onClick={onSignIn}>
            Sign in
          </Button>
        )}
        {canSwitchRoleView && (
          <div className="rs-role-switch">
            <FormSelect
              className="rs-role-switch__select"
              value={roleView}
              onChange={(_, v) => onSwitchView(v as RoleView)}
              aria-label="Role"
              ouiaId="RoleViewSwitch"
            >
              {availableLenses.map((lens) => (
                <FormSelectOption
                  key={lens}
                  value={lens}
                  label={ROLE_VIEW_LABELS[lens]}
                />
              ))}
            </FormSelect>
          </div>
        )}
        {isAssignerView && hasAssignerRole && <OfficialQuickLookPicker />}
      </div>
    </header>
  );
}
