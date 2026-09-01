import { useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  MenuContainer,
  MenuToggle,
  Panel,
  PanelMain,
  PanelMainBody,
  Title,
  TreeView,
  type TreeViewDataItem,
} from '@patternfly/react-core';
import {
  isConferencePickerNodeId,
  MAX_TEAM_ADMIN_CLUB_REQUEST_BATCH,
} from '@/domain/teamLinkRequests';

export type ConferenceTeamOption = {
  id: string;
  name: string;
  conference: string;
};

function flattenTree(items: TreeViewDataItem[]): TreeViewDataItem[] {
  let out: TreeViewDataItem[] = [];
  for (const item of items) {
    out.push(item);
    if (item.children) out = out.concat(flattenTree(item.children));
  }
  return out;
}

function cloneTree(items: TreeViewDataItem[]): TreeViewDataItem[] {
  return items.map((item) => ({
    ...item,
    checkProps: item.checkProps ? { ...item.checkProps } : undefined,
    children: item.children ? cloneTree(item.children) : undefined,
  }));
}

function filterTreeById(
  item: TreeViewDataItem,
  needle: TreeViewDataItem,
): boolean {
  if (item.id === needle.id) return true;
  if (!item.children) return false;
  item.children = item.children
    .map((child) => ({ ...child }))
    .filter((child) => filterTreeById(child, needle));
  return item.children.length > 0;
}

export function ConferenceTeamPicker({
  options,
  selectedIds,
  onChange,
  ariaLabel = 'Select teams',
  maxSelection = MAX_TEAM_ADMIN_CLUB_REQUEST_BATCH,
  limitMessage,
}: {
  options: ConferenceTeamOption[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  ariaLabel?: string;
  maxSelection?: number;
  limitMessage?: string | null;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const treeData = useMemo<TreeViewDataItem[]>(() => {
    const grouped = new Map<string, ConferenceTeamOption[]>();
    for (const option of options) {
      const key = option.conference;
      const list = grouped.get(key) ?? [];
      list.push(option);
      grouped.set(key, list);
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([conference, teams]) => ({
        id: `conf:${conference}`,
        name: conference,
        defaultExpanded: false,
        customBadgeContent: teams.length,
        checkProps: { checked: false, disabled: true },
        children: teams
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((team) => ({
            id: team.id,
            name: team.name,
            checkProps: { checked: false },
          })),
      }));
  }, [options]);

  const isChecked = (item: TreeViewDataItem): boolean =>
    typeof item.id === 'string' && selectedSet.has(item.id);

  const allDescendantsChecked = (item: TreeViewDataItem): boolean =>
    item.children
      ? item.children.every((child) => allDescendantsChecked(child))
      : isChecked(item);

  const someDescendantsChecked = (item: TreeViewDataItem): boolean =>
    item.children
      ? item.children.some((child) => someDescendantsChecked(child))
      : isChecked(item);

  const mapped = useMemo(() => {
    const mapOne = (item: TreeViewDataItem): TreeViewDataItem => {
      const next: TreeViewDataItem = {
        ...item,
        checkProps: { ...(item.checkProps ?? {}), checked: false },
      };
      if (allDescendantsChecked(item)) {
        next.checkProps = { ...next.checkProps, checked: true };
      } else if (someDescendantsChecked(item)) {
        next.checkProps = { ...next.checkProps, checked: null };
      }
      if (item.children) next.children = item.children.map(mapOne);
      return next;
    };
    return treeData.map(mapOne);
  }, [treeData, selectedSet]);

  const toggleLabel =
    selectedIds.length > 0
      ? `${selectedIds.length} team${selectedIds.length === 1 ? '' : 's'} selected`
      : 'Select teams';

  const onCheck = (event: ChangeEvent, item: TreeViewDataItem) => {
    if (typeof item.id !== 'string' || isConferencePickerNodeId(item.id)) {
      return;
    }
    const checked = (event.target as HTMLInputElement).checked;
    const branch = cloneTree(treeData).filter((root) => filterTreeById(root, item));
    const leafIds = flattenTree(branch)
      .filter(
        (node) =>
          typeof node.id === 'string' &&
          !isConferencePickerNodeId(node.id) &&
          (!node.children || node.children.length === 0),
      )
      .map((node) => String(node.id));
    const next = new Set(selectedIds);
    if (checked) {
      for (const id of leafIds) {
        if (maxSelection > 0 && next.size >= maxSelection) break;
        next.add(id);
      }
    } else {
      for (const id of leafIds) next.delete(id);
    }
    onChange([...next]);
  };

  const menu = (
    <Panel ref={menuRef} variant="raised" style={{ width: '320px' }}>
      <PanelMain>
        <PanelMainBody style={{ paddingBottom: 0 }}>
          <Title headingLevel="h3" size="md">
            Conferences
          </Title>
        </PanelMainBody>
        <PanelMainBody style={{ paddingTop: 0 }}>
          <TreeView
            data={mapped}
            hasBadges
            hasCheckboxes
            aria-label={ariaLabel}
            onCheck={onCheck}
          />
        </PanelMainBody>
      </PanelMain>
    </Panel>
  );

  return (
    <>
      <MenuContainer
        isOpen={isOpen}
        onOpenChange={(open) => setIsOpen(open)}
        onOpenChangeKeys={['Escape']}
        menu={menu}
        menuRef={menuRef}
        toggle={
          <MenuToggle
            ref={toggleRef}
            onClick={() => setIsOpen((v) => !v)}
            isExpanded={isOpen}
          >
            {toggleLabel}
          </MenuToggle>
        }
        toggleRef={toggleRef}
      />
      {limitMessage ? (
        <p className="rs-signin__note" role="status">
          {limitMessage}
        </p>
      ) : null}
    </>
  );
}
