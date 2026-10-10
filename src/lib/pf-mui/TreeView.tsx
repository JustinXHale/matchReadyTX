import {
  Box,
  Checkbox,
  Collapse,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import { useState, type ChangeEvent, type ReactNode } from 'react';

export type TreeViewDataItem = {
  id?: string;
  name?: ReactNode;
  children?: TreeViewDataItem[];
  defaultExpanded?: boolean;
  customBadgeContent?: ReactNode;
  checkProps?: {
    checked?: boolean | null;
    disabled?: boolean;
  };
};

type Props = {
  data: TreeViewDataItem[];
  hasCheckboxes?: boolean;
  hasBadges?: boolean;
  onCheck?: (
    event: ChangeEvent<HTMLInputElement>,
    treeViewItem: TreeViewDataItem,
    checkedItems?: TreeViewDataItem[],
    checkedItem?: TreeViewDataItem,
  ) => void;
  className?: string;
  'aria-label'?: string;
};

function TreeNode({
  item,
  hasCheckboxes,
  onCheck,
  depth,
}: {
  item: TreeViewDataItem;
  hasCheckboxes?: boolean;
  onCheck?: Props['onCheck'];
  depth: number;
}) {
  const [open, setOpen] = useState(Boolean(item.defaultExpanded));
  const hasChildren = Boolean(item.children?.length);
  const checked = item.checkProps?.checked === true;
  const indeterminate = item.checkProps?.checked === null;

  return (
    <>
      <ListItemButton
        sx={{ pl: 1 + depth * 2, minHeight: 48, alignItems: 'center' }}
        onClick={() => {
          if (hasChildren) setOpen((v) => !v);
        }}
      >
        {hasChildren ? (
          <IconButton
            size="small"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            sx={{ mr: 0.5 }}
          >
            {open ? '▾' : '▸'}
          </IconButton>
        ) : (
          <Box sx={{ width: 32 }} />
        )}
        {hasCheckboxes ? (
          <ListItemIcon sx={{ minWidth: 48 }}>
            <Checkbox
              edge="start"
              checked={checked}
              indeterminate={indeterminate}
              disabled={item.checkProps?.disabled}
              tabIndex={-1}
              disableRipple
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onCheck?.(e, item)}
              inputProps={{
                'aria-label':
                  typeof item.name === 'string' ? item.name : 'Select',
              }}
            />
          </ListItemIcon>
        ) : null}
        <ListItemText
          primary={item.name}
          primaryTypographyProps={{ fontWeight: hasChildren ? 700 : 500 }}
        />
        {item.customBadgeContent != null ? (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {item.customBadgeContent}
          </Typography>
        ) : null}
      </ListItemButton>
      {hasChildren ? (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding>
            {item.children!.map((child) => (
              <TreeNode
                key={child.id ?? String(child.name)}
                item={child}
                hasCheckboxes={hasCheckboxes}
                onCheck={onCheck}
                depth={depth + 1}
              />
            ))}
          </List>
        </Collapse>
      ) : null}
    </>
  );
}

export function TreeView({
  data,
  hasCheckboxes,
  hasBadges,
  onCheck,
  className,
  'aria-label': ariaLabel,
}: Props) {
  void hasBadges;
  return (
    <List
      dense
      className={className}
      aria-label={ariaLabel}
      sx={{ width: '100%', py: 0 }}
    >
      {data.map((item) => (
        <TreeNode
          key={item.id ?? String(item.name)}
          item={item}
          hasCheckboxes={hasCheckboxes}
          onCheck={onCheck}
          depth={0}
        />
      ))}
    </List>
  );
}
