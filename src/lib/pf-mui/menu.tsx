import {
  Button,
  Menu,
  MenuItem,
  Popover,
  type ButtonProps,
} from '@mui/material';
import {
  createContext,
  forwardRef,
  useContext,
  useState,
  type ReactNode,
  type Ref,
} from 'react';

type MenuToggleProps = {
  children?: ReactNode;
  variant?: 'default' | 'plain' | 'primary' | 'secondary';
  isExpanded?: boolean;
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
  id?: string;
};

export const MenuToggle = forwardRef<HTMLButtonElement, MenuToggleProps>(
  function MenuToggle(
    {
      children,
      variant = 'default',
      isExpanded,
      onClick,
      className,
      'aria-label': ariaLabel,
      id,
    },
    ref,
  ) {
    const mapped: ButtonProps['variant'] =
      variant === 'plain'
        ? 'text'
        : variant === 'primary'
          ? 'contained'
          : 'outlined';
    return (
      <Button
        ref={ref}
        id={id}
        className={className}
        variant={mapped}
        aria-label={ariaLabel}
        aria-expanded={isExpanded}
        onClick={onClick}
        sx={{ minHeight: 48, minWidth: variant === 'plain' ? 48 : undefined }}
      >
        {children}
      </Button>
    );
  },
);

type DropdownCtx = {
  close: () => void;
};

const DropdownContext = createContext<DropdownCtx>({ close: () => undefined });

export function Dropdown({
  isOpen,
  onOpenChange,
  toggle,
  children,
  className,
}: {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  toggle?: {
    toggleRef?: Ref<HTMLButtonElement>;
    toggleNode?: ReactNode;
  };
  children?: ReactNode;
  className?: string;
  popperProps?: { placement?: string };
}) {
  const open = Boolean(isOpen);
  const anchor =
    toggle?.toggleRef && typeof toggle.toggleRef !== 'function'
      ? (toggle.toggleRef as { current: HTMLElement | null }).current
      : null;

  return (
    <DropdownContext.Provider
      value={{ close: () => onOpenChange?.(false) }}
    >
      {toggle?.toggleNode}
      <Menu
        className={className}
        open={open}
        onClose={() => onOpenChange?.(false)}
        anchorEl={anchor}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {children}
      </Menu>
    </DropdownContext.Provider>
  );
}

export function DropdownList({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function DropdownItem({
  children,
  onClick,
  isDisabled,
  className,
}: {
  children?: ReactNode;
  onClick?: () => void;
  isDisabled?: boolean;
  className?: string;
}) {
  const { close } = useContext(DropdownContext);
  return (
    <MenuItem
      className={className}
      disabled={isDisabled}
      onClick={() => {
        onClick?.();
        close();
      }}
      sx={{ minHeight: 48 }}
    >
      {children}
    </MenuItem>
  );
}

export function MenuContainer({
  isOpen,
  onOpenChange,
  toggle,
  menu,
  menuRef,
  toggleRef,
}: {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenChangeKeys?: string[];
  toggle?: ReactNode | (() => ReactNode);
  menu?: ReactNode | (() => ReactNode);
  menuRef?: Ref<HTMLDivElement>;
  toggleRef?: Ref<HTMLButtonElement>;
  scrollable?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const toggleNode = typeof toggle === 'function' ? toggle() : toggle;
  const menuNode = typeof menu === 'function' ? menu() : menu;
  void toggleRef;

  return (
    <>
      <span
        ref={(node) => {
          if (node) setAnchor(node);
        }}
        style={{ display: 'inline-flex', width: '100%' }}
      >
        {toggleNode}
      </span>
      <Popover
        open={Boolean(isOpen)}
        anchorEl={anchor}
        onClose={() => onOpenChange?.(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        slotProps={{
          paper: {
            ref: menuRef as never,
            sx: { maxWidth: 360, width: 'min(100vw - 24px, 360px)' },
          },
        }}
      >
        {menuNode}
      </Popover>
    </>
  );
}

