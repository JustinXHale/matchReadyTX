import {
  Alert,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { useAppFeedback } from '@/app/feedback/feedbackContext';
import { PromoBanner } from './PromoBanner';
import {
  derivePublishedItems,
  duplicatePromotionDraft,
  importPublishedPromotions,
  loadPromotionsManagerData,
  newPromotionDraft,
  publishPromotionsFeed,
  removePromotionDraft,
  saveDraftOrder,
  savePromotionDraft,
  signInPromotionsAdmin,
  signOutPromotionsAdmin,
  subscribePromotionsAdminAuth,
  type PromotionDraft,
} from './promotionsAdmin';
import {
  isPromotionsConfigured,
  parsePromotionsFeed,
  promotionsFeedAppId,
  type PromotionItem,
} from './promotionsFeed';
import './promotions-manager.css';

function errorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  if (code.includes('permission-denied')) {
    return 'This Google account is not in settings/admins for the promotions project.';
  }
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function validateDraft(draft: PromotionDraft): string | null {
  if (!draft.title.trim()) return 'Enter a title.';
  try {
    const url = new URL(draft.destinationUrl);
    if (url.protocol !== 'https:') return 'Destination URL must start with https://.';
  } catch {
    return 'Enter a valid destination URL.';
  }
  if (draft.imageUrl) {
    try {
      const url = new URL(draft.imageUrl);
      if (url.protocol !== 'https:') return 'Image URL must start with https://.';
    } catch {
      return 'Enter a valid image URL or leave it blank.';
    }
  }
  const colors = [
    draft.backgroundColor,
    draft.primaryTextColor,
    draft.secondaryTextColor,
    draft.accentColor,
  ];
  if (colors.some((color) => !/^#[0-9A-Fa-f]{6}$/.test(color))) {
    return 'Colors must use six-digit hex values such as #CEAA6F.';
  }
  if (draft.targetMode === 'apps' && draft.targetAppIds.length === 0) {
    return 'Choose at least one target app ID.';
  }
  return null;
}

function updateDraftInList(
  drafts: PromotionDraft[],
  updated: PromotionDraft,
): PromotionDraft[] {
  const exists = drafts.some((draft) => draft.id === updated.id);
  const next = exists
    ? drafts.map((draft) => (draft.id === updated.id ? updated : draft))
    : [...drafts, updated];
  return next.sort((first, second) => first.sortOrder - second.sortOrder);
}

function previewItem(draft: PromotionDraft | null): PromotionItem | null {
  if (!draft) return null;
  const feed = parsePromotionsFeed({ items: [draft] });
  return feed?.items[0] || null;
}

export function PromotionsManagerPage() {
  const { confirm, notify } = useAppFeedback();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<PromotionDraft[]>([]);
  const [publishedItems, setPublishedItems] = useState<PromotionItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PromotionDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rotationMs, setRotationMs] = useState(7000);

  useEffect(() => {
    if (!isPromotionsConfigured) {
      setAuthReady(true);
      return;
    }
    return subscribePromotionsAdminAuth((nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setDrafts([]);
      setEditing(null);
      setSelectedId(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void loadPromotionsManagerData()
      .then((data) => {
        if (!active) return;
        setDrafts(data.drafts);
        setPublishedItems(data.publishedItems);
        setPaused(data.paused);
        setRotationMs(data.rotationMs);
        const first = data.drafts[0] || null;
        setEditing(first);
        setSelectedId(first?.id || null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const preview = useMemo(() => previewItem(editing), [editing]);
  const publishedCount = useMemo(
    () => derivePublishedItems(drafts, promotionsFeedAppId).length,
    [drafts],
  );

  const change = <K extends keyof PromotionDraft>(
    field: K,
    value: PromotionDraft[K],
  ) => {
    setEditing((current) => (current ? { ...current, [field]: value } : current));
    setDirty(true);
  };

  const chooseDraft = async (draft: PromotionDraft) => {
    if (dirty) {
      const discard = await confirm({
        title: 'Discard unsaved changes?',
        message: 'Your changes to the current promotion have not been saved.',
        confirmLabel: 'Discard',
        destructive: true,
      });
      if (!discard) return;
    }
    setSelectedId(draft.id);
    setEditing(draft);
    setDirty(false);
    setError(null);
  };

  const persistEditing = async (): Promise<PromotionDraft[] | null> => {
    if (!editing) return drafts;
    const validationError = validateDraft(editing);
    if (validationError) {
      setError(validationError);
      return null;
    }
    await savePromotionDraft(editing);
    const next = updateDraftInList(drafts, editing);
    setDrafts(next);
    setDirty(false);
    setError(null);
    return next;
  };

  const handleSave = async (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    try {
      const saved = await persistEditing();
      if (saved) notify('Promotion saved as a draft.', 'success');
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (dirty) {
      const discard = await confirm({
        title: 'Discard unsaved changes?',
        message: 'Save the current promotion before creating another one.',
        confirmLabel: 'Discard and add',
        destructive: true,
      });
      if (!discard) return;
    }
    const next = newPromotionDraft(
      Math.max(-1, ...drafts.map((draft) => draft.sortOrder)) + 1,
    );
    setEditing(next);
    setSelectedId(next.id);
    setDirty(true);
    setError(null);
  };

  const handleDuplicate = async (source: PromotionDraft) => {
    setBusy(true);
    try {
      const currentDrafts = dirty ? await persistEditing() : drafts;
      if (!currentDrafts) return;
      const sourceDraft = editing?.id === source.id ? editing : source;
      const copy = duplicatePromotionDraft(sourceDraft, currentDrafts);
      await savePromotionDraft(copy);
      setDrafts(updateDraftInList(currentDrafts, copy));
      setEditing(copy);
      setSelectedId(copy.id);
      setDirty(false);
      notify('Promotion duplicated.', 'success');
    } catch (duplicateError) {
      setError(errorMessage(duplicateError));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (draft: PromotionDraft) => {
    const approved = await confirm({
      title: 'Delete promotion?',
      message: `Delete “${draft.title}”? The published feed is unchanged until you publish again.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!approved) return;
    setBusy(true);
    try {
      await removePromotionDraft(draft.id);
      const next = drafts.filter((item) => item.id !== draft.id);
      setDrafts(next);
      const first = next[0] || null;
      setEditing(first);
      setSelectedId(first?.id || null);
      setDirty(false);
      notify('Promotion deleted.', 'success');
    } catch (deleteError) {
      setError(errorMessage(deleteError));
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async (draft: PromotionDraft, direction: -1 | 1) => {
    const index = drafts.findIndex((item) => item.id === draft.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= drafts.length) return;
    const reordered = [...drafts];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];
    const normalized = reordered.map((item, order) => ({ ...item, sortOrder: order }));
    setBusy(true);
    try {
      await saveDraftOrder(normalized);
      setDrafts(normalized);
      if (editing) {
        setEditing(normalized.find((item) => item.id === editing.id) || editing);
      }
    } catch (moveError) {
      setError(errorMessage(moveError));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    setBusy(true);
    try {
      const imported = await importPublishedPromotions(publishedItems);
      setDrafts(imported);
      const first = imported[0] || null;
      setEditing(first);
      setSelectedId(first?.id || null);
      setDirty(false);
      notify('Published promotions imported as drafts.', 'success');
    } catch (importError) {
      setError(errorMessage(importError));
    } finally {
      setBusy(false);
    }
  };

  const handlePublish = async () => {
    setBusy(true);
    try {
      const nextDrafts = dirty ? await persistEditing() : drafts;
      if (!nextDrafts) return;
      await publishPromotionsFeed(nextDrafts, { paused, rotationMs });
      setPublishedItems(derivePublishedItems(nextDrafts, promotionsFeedAppId));
      notify(`Published ${derivePublishedItems(nextDrafts, promotionsFeedAppId).length} promotion(s).`, 'success');
    } catch (publishError) {
      setError(errorMessage(publishError));
    } finally {
      setBusy(false);
    }
  };

  if (!isPromotionsConfigured) {
    return (
      <main className="rs-promo-manager rs-promo-manager--centered">
        <Alert severity="warning">
          Promotions Firebase is not configured. Add the VITE_PROMOTIONS_FIREBASE_* values and restart Vite.
        </Alert>
      </main>
    );
  }

  if (!authReady) {
    return (
      <main className="rs-promo-manager rs-promo-manager--centered" aria-busy="true">
        <CircularProgress aria-label="Checking sign-in" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="rs-promo-manager rs-promo-manager--signin">
        <section className="rs-promo-manager__signin-card">
          <p className="rs-promo-manager__eyebrow">Rabbit Hole Apps</p>
          <h1>Promotions Manager</h1>
          <p>Create, duplicate, preview, and publish shared promotions.</p>
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button
            variant="contained"
            size="large"
            onClick={() => {
              setError(null);
              void signInPromotionsAdmin().catch((signInError: unknown) =>
                setError(errorMessage(signInError)),
              );
            }}
          >
            Sign in with Google
          </Button>
        </section>
      </main>
    );
  }

  return (
    <main className="rs-promo-manager">
      <header className="rs-promo-manager__header">
        <div>
          <p className="rs-promo-manager__eyebrow">Rabbit Hole Apps</p>
          <h1>Promotions Manager</h1>
          <p>Publishing to <code>publicFeeds/{promotionsFeedAppId}</code></p>
        </div>
        <div className="rs-promo-manager__account">
          <span>{user.email}</span>
          <Button variant="outlined" onClick={() => void signOutPromotionsAdmin()}>
            Sign out
          </Button>
        </div>
      </header>

      {error ? (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <section className="rs-promo-manager__publish-bar" aria-label="Feed settings">
        <FormControlLabel
          control={
            <Switch
              checked={!paused}
              onChange={(_, checked) => setPaused(!checked)}
            />
          }
          label="Feed enabled"
        />
        <TextField
          label="Rotation (seconds)"
          type="number"
          size="small"
          value={rotationMs / 1000}
          slotProps={{ htmlInput: { min: 3, max: 60 } }}
          onChange={(event) => setRotationMs(Number(event.target.value) * 1000)}
        />
        <span className="rs-promo-manager__publish-count">
          {publishedCount} active draft{publishedCount === 1 ? '' : 's'}
        </span>
        <Button
          variant="contained"
          disabled={busy || drafts.length === 0}
          onClick={() => void handlePublish()}
        >
          {busy ? 'Working…' : 'Publish feed'}
        </Button>
      </section>

      {loading ? (
        <div className="rs-promo-manager__loading" aria-busy="true">
          <CircularProgress aria-label="Loading promotions" />
        </div>
      ) : (
        <div className="rs-promo-manager__workspace">
          <aside className="rs-promo-manager__list-pane" aria-label="Promotion drafts">
            <div className="rs-promo-manager__list-heading">
              <div>
                <h2>Drafts</h2>
                <span>{drafts.length}</span>
              </div>
              <Button variant="contained" onClick={() => void handleAdd()}>
                Add ad
              </Button>
            </div>

            {drafts.length === 0 && publishedItems.length > 0 ? (
              <Alert
                severity="info"
                action={
                  <Button color="inherit" size="small" onClick={() => void handleImport()}>
                    Import
                  </Button>
                }
              >
                Import your existing published feed to start editing it here.
              </Alert>
            ) : null}

            {drafts.length === 0 && publishedItems.length === 0 ? (
              <p className="rs-promo-manager__empty">No drafts yet. Add your first ad.</p>
            ) : null}

            <div className="rs-promo-manager__draft-list">
              {drafts.map((draft, index) => (
                <article
                  key={draft.id}
                  className={[
                    'rs-promo-manager__draft-row',
                    selectedId === draft.id ? 'rs-promo-manager__draft-row--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <button
                    type="button"
                    className="rs-promo-manager__draft-main"
                    onClick={() => void chooseDraft(draft)}
                  >
                    {draft.imageUrl ? <img src={draft.imageUrl} alt="" /> : null}
                    <span>
                      <strong>{draft.title}</strong>
                      <small>{draft.id}</small>
                      <small>{draft.active ? 'Active' : 'Inactive'}</small>
                    </span>
                  </button>
                  <div className="rs-promo-manager__row-actions" aria-label={`Actions for ${draft.title}`}>
                    <Button
                      size="small"
                      variant="text"
                      disabled={index === 0 || busy}
                      onClick={() => void handleMove(draft, -1)}
                    >
                      Up
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      disabled={index === drafts.length - 1 || busy}
                      onClick={() => void handleMove(draft, 1)}
                    >
                      Down
                    </Button>
                    <Button size="small" variant="text" onClick={() => void handleDuplicate(draft)}>
                      Duplicate
                    </Button>
                    <Button size="small" color="error" onClick={() => void handleDelete(draft)}>
                      Delete
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </aside>

          <section className="rs-promo-manager__editor-pane">
            {editing ? (
              <form onSubmit={(event) => void handleSave(event)}>
                <div className="rs-promo-manager__editor-heading">
                  <div>
                    <h2>Edit promotion</h2>
                    <code>{editing.id}</code>
                  </div>
                  <Button type="submit" variant="contained" disabled={busy || !dirty}>
                    Save draft
                  </Button>
                </div>

                <section className="rs-promo-manager__preview" aria-label="Banner preview">
                  <h3>Preview</h3>
                  {preview ? (
                    <PromoBanner
                      feed={{ paused: false, rotationMs: 7000, items: [preview] }}
                      placement="medium"
                    />
                  ) : (
                    <Alert severity="warning">Add a title and valid HTTPS destination to preview.</Alert>
                  )}
                </section>

                <div className="rs-promo-manager__form-grid">
                  <TextField
                    label="Title"
                    required
                    value={editing.title}
                    onChange={(event) => change('title', event.target.value)}
                  />
                  <TextField
                    label="Brand label"
                    value={editing.brandLabel || ''}
                    onChange={(event) => change('brandLabel', event.target.value)}
                  />
                  <TextField
                    className="rs-promo-manager__field--wide"
                    label="Subtitle"
                    value={editing.subtitle || ''}
                    onChange={(event) => change('subtitle', event.target.value)}
                  />
                  <TextField
                    label="Price qualifier"
                    select
                    value={editing.priceQualifier || ''}
                    onChange={(event) => change('priceQualifier', event.target.value)}
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="From">From</MenuItem>
                    <MenuItem value="Starting at">Starting at</MenuItem>
                    <MenuItem value="for">for</MenuItem>
                  </TextField>
                  <TextField
                    label="Price display"
                    value={editing.priceDisplay || ''}
                    helperText="Examples: 49, $25 Each, Free"
                    onChange={(event) => change('priceDisplay', event.target.value)}
                  />
                  <TextField
                    className="rs-promo-manager__field--wide"
                    label="Destination URL"
                    type="url"
                    required
                    value={editing.destinationUrl}
                    onChange={(event) => change('destinationUrl', event.target.value)}
                  />
                  <TextField
                    className="rs-promo-manager__field--wide"
                    label="Image URL"
                    type="url"
                    value={editing.imageUrl || ''}
                    helperText="Use a stable public HTTPS image URL."
                    onChange={(event) => change('imageUrl', event.target.value)}
                  />
                </div>

                <fieldset className="rs-promo-manager__fieldset">
                  <legend>Colors</legend>
                  <div className="rs-promo-manager__color-grid">
                    {(
                      [
                        ['backgroundColor', 'Background'],
                        ['primaryTextColor', 'Primary text'],
                        ['secondaryTextColor', 'Secondary text'],
                        ['accentColor', 'Accent'],
                      ] as const
                    ).map(([field, label]) => (
                      <label key={field}>
                        <span>{label}</span>
                        <span className="rs-promo-manager__color-control">
                          <input
                            type="color"
                            value={editing[field]}
                            aria-label={`${label} color picker`}
                            onChange={(event) => change(field, event.target.value.toUpperCase())}
                          />
                          <input
                            type="text"
                            value={editing[field]}
                            pattern="#[0-9A-Fa-f]{6}"
                            aria-label={`${label} hex value`}
                            onChange={(event) => change(field, event.target.value)}
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="rs-promo-manager__fieldset">
                  <legend>Publishing</legend>
                  <div className="rs-promo-manager__form-grid">
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editing.active}
                          onChange={(_, checked) => change('active', checked)}
                        />
                      }
                      label="Active"
                    />
                    <TextField
                      label="Target"
                      select
                      value={editing.targetMode}
                      onChange={(event) =>
                        change('targetMode', event.target.value as 'global' | 'apps')
                      }
                    >
                      <MenuItem value="apps">Selected apps</MenuItem>
                      <MenuItem value="global">All apps</MenuItem>
                    </TextField>
                    {editing.targetMode === 'apps' ? (
                      <TextField
                        className="rs-promo-manager__field--wide"
                        label="App IDs"
                        value={editing.targetAppIds.join(', ')}
                        helperText="Comma-separated, for example: matchreadytx, to3"
                        onChange={(event) =>
                          change(
                            'targetAppIds',
                            event.target.value
                              .split(',')
                              .map((value) => value.trim())
                              .filter(Boolean),
                          )
                        }
                      />
                    ) : null}
                    <TextField
                      label="Starts at"
                      type="datetime-local"
                      value={editing.startsAt || ''}
                      slotProps={{ inputLabel: { shrink: true } }}
                      onChange={(event) => change('startsAt', event.target.value)}
                    />
                    <TextField
                      label="Ends at"
                      type="datetime-local"
                      value={editing.endsAt || ''}
                      slotProps={{ inputLabel: { shrink: true } }}
                      onChange={(event) => change('endsAt', event.target.value)}
                    />
                  </div>
                </fieldset>
              </form>
            ) : (
              <div className="rs-promo-manager__empty-editor">
                <h2>No promotion selected</h2>
                <p>Add a promotion or import the currently published feed.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
