import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Card, CardHead, PrimaryButton, Row } from '../components/Card'
import Chip from '../components/Chip'
import { Icon } from '../components/Icon'
import EditableCanvas from '../components/board/EditableCanvas'
import { useBoard, type BoardVersion } from '../api/useBoard'
import type { BoardGraph } from '../../shared/boardGraph'
import { boardName, boardStamp, explainBoardCode, publicBoardUrl } from '../api/useBoards'
import { useLivePipeline } from '../api/useLivePipeline'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi } from '../data/types'

const COPY = {
  subtitle: { fa: 'بوم خودت — بساز، ذخیره کن، برگرد', en: 'Your own board — build it, save it, go back' },
  backToList: { fa: 'بازگشت به فهرست بومها', en: 'Back to the boards list' },
  loading: { fa: 'در حال بارگذاری…', en: 'Loading…' },

  // not found
  missingKicker: { fa: 'پیدا نشد', en: 'Not found' },
  missingTitle: { fa: 'چنین بومی در دسترس نیست', en: 'No such board is available' },
  missingSub: { fa: 'نشانی اشتباه است یا بوم خصوصی است', en: 'Wrong address, or the board is private' },
  missingBody: {
    fa: 'این نشانی به بومی نمی‌رسد. یا حذف شده، یا خصوصی است و برای دیدنش باید وارد شوی.',
    en: 'This address reaches no board. It was deleted, or it is private and needs a session to read.',
  },
  missingCta: { fa: 'رفتن به فهرست بومها', en: 'Go to the boards list' },

  // read-only
  readOnlyKicker: { fa: 'فقط خواندنی', en: 'Read-only' },
  readOnlyTitle: { fa: 'این بوم را تماشا می‌کنی', en: 'You are reading this board' },
  readOnlySub: { fa: 'بدون ورود، تغییری ذخیره نمی‌شود', en: 'With no session, nothing can be saved' },
  readOnlyBody: {
    fa: 'این بوم عمومی است، بنابراین بدون ورود هم دیده می‌شود — اما تغییر و ذخیره فقط برای صاحب آن است.',
    en: 'This board is public, so it opens with no session — but changing and saving it is the owner’s alone.',
  },

  // save
  saveKicker: { fa: 'ذخیره', en: 'Saving' },
  saveTitle: { fa: 'هر ذخیره یک نسخه می‌سازد', en: 'Every save makes a version' },
  saveSub: { fa: 'خودکار ذخیره نمی‌شود', en: 'Nothing is saved for you' },
  saveBody: {
    fa: 'تا وقتی دکمه را نزنی چیزی ذخیره نمی‌شود؛ جابه‌جا کردن گره‌ها یک نسخه‌ی تازه نمی‌سازد. خودت تصمیم می‌گیری کدام حالت ارزش نگه‌داشتن دارد.',
    en: 'Nothing is stored until you press the button; moving nodes around does not make a version. You decide which state is worth keeping.',
  },
  noteLabel: { fa: 'یادداشت این نسخه (اختیاری)', en: 'A note for this version (optional)' },
  notePlaceholder: { fa: 'مثلاً: مسیر سرد اضافه شد', en: 'e.g. added the cold path' },
  saveNow: { fa: 'ذخیره‌ی نسخه‌ی تازه', en: 'Save a new version' },
  savingNow: { fa: 'در حال ذخیره…', en: 'Saving…' },
  saved: { fa: 'همه‌چیز ذخیره است', en: 'Everything is saved' },
  unsaved: { fa: 'تغییرهای ذخیره‌نشده داری', en: 'You have unsaved changes' },
  lastSaved: { fa: 'آخرین ذخیره', en: 'Last saved' },
  neverSaved: { fa: 'هنوز ذخیره‌ای ثبت نشده', en: 'nothing saved yet' },
  discard: { fa: 'برگشت به آخرین نسخه‌ی ذخیره‌شده', en: 'Go back to the last saved version' },
  onBoard: { fa: 'روی بوم', en: 'On the board' },
  countsLine: { fa: '{nodes} گره · {edges} یال', en: '{nodes} nodes · {edges} edges' },

  // leaving
  leaveTitle: { fa: 'بدون ذخیره بروی؟', en: 'Leave without saving?' },
  leaveBody: {
    fa: 'تغییرهای ذخیره‌نشده‌ی این بوم از بین می‌روند.',
    en: 'The unsaved changes on this board will be lost.',
  },
  leaveSave: { fa: 'ذخیره کن و برو', en: 'Save, then leave' },
  leaveAnyway: { fa: 'بدون ذخیره برو', en: 'Leave without saving' },
  stay: { fa: 'بمان', en: 'Stay here' },

  // visibility
  visibilityKicker: { fa: 'دسترسی', en: 'Visibility' },
  visibilityTitle: { fa: 'چه کسی می‌تواند بخواند', en: 'Who can read it' },
  visibilitySub: { fa: 'همین‌جا هم عوض می‌شود', en: 'Changeable from here too' },
  private: { fa: 'خصوصی', en: 'private' },
  public: { fa: 'عمومی', en: 'public' },
  makePublic: { fa: 'عمومی کن', en: 'Make it public' },
  makePrivate: { fa: 'خصوصی کن', en: 'Make it private' },
  privateNote: {
    fa: 'بوم خصوصی فقط با ورود به حساب دیده می‌شود.',
    en: 'A private board is visible only to a signed-in session.',
  },
  publicNote: {
    fa: 'هر کسی که این نشانی را داشته باشد، بدون ورود آن را می‌بیند — فقط خواندنی.',
    en: 'Anyone with this address can read it without signing in — read-only.',
  },
  copyLink: { fa: 'کپی نشانی', en: 'Copy the link' },
  copied: { fa: 'کپی شد', en: 'Copied' },

  // history
  historyKicker: { fa: 'تاریخچه', en: 'History' },
  historyTitle: { fa: 'نسخه‌های این بوم', en: 'This board’s versions' },
  historySub: { fa: 'تازه‌ترین اول', en: 'Newest first' },
  historyBody: {
    fa: 'بازگردانی هیچ نسخه‌ای را پاک نمی‌کند: نسخه‌ی قدیمی دوباره روی بوم می‌نشیند و به عنوان یک نسخه‌ی تازه ثبت می‌شود. برای همین یک کلیک اشتباه هم برگشت‌پذیر است.',
    en: 'Restoring deletes nothing: the old graph comes back onto the board and is recorded as a new version. That is why a mis-click here is recoverable.',
  },
  historyLoading: { fa: 'در حال خواندن تاریخچه…', en: 'Reading the history…' },
  historyEmpty: { fa: 'هنوز نسخه‌ای ثبت نشده.', en: 'No version has been recorded yet.' },
  version: { fa: 'نسخه', en: 'version' },
  view: { fa: 'تماشا', en: 'View' },
  closeView: { fa: 'بازگشت به بوم خودم', en: 'Back to my board' },
  restore: { fa: 'بازگردانی', en: 'Restore' },
  restoringNow: { fa: 'در حال بازگردانی…', en: 'Restoring…' },
  viewingBanner: { fa: 'داری نسخه‌ی {v} را می‌بینی — این بوم فعلی تو نیست.', en: 'You are looking at version {v} — this is not your current board.' },
  restoreThis: { fa: 'همین را برگردان', en: 'Restore this one' },

  // failures
  offline: {
    fa: 'API در دسترس نیست، بنابراین این بوم خوانده نشد و چیزی ذخیره نمی‌شود.',
    en: 'The API is unreachable, so this board could not be read and nothing can be saved.',
  },
  retry: { fa: 'تلاش دوباره', en: 'Try again' },
  errorValidation: { fa: 'سرور این بوم را نپذیرفت:', en: 'The server did not accept this board:' },
  errorForbidden: { fa: 'اجازه‌ی این کار را نداری. دوباره وارد شو.', en: 'You are not allowed to do that. Sign in again.' },
  errorMissing: { fa: 'این بوم دیگر وجود ندارد.', en: 'That board no longer exists.' },
  errorServer: { fa: 'سرور نتوانست این کار را انجام دهد.', en: 'The server could not do that.' },
  errorOffline: { fa: 'سرور در دسترس نیست. بعداً دوباره امتحان کن.', en: 'The server is unreachable. Try again later.' },
} satisfies Record<string, Bi>

const SHELL =
  'w-full rounded-xl border border-hairline bg-black/40 px-3.5 py-2.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50'

/**
 * One board's editor, at `#/boards/:slug`.
 *
 * Three things here are deliberate. Saving is manual, because every accepted
 * save becomes a permanent version and a person nudging nodes about should
 * choose when that happens. Leaving with unsaved work asks first — the browser's
 * own Back included, which under a hash router never reaches `beforeunload`.
 * And a public board opened with no session renders read-only rather than
 * offering a save the server would refuse.
 */
export default function BoardEditor() {
  const { t, n, num } = useI18n()
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const live = useLivePipeline()
  const {
    board,
    graph,
    dirty,
    loading,
    saving,
    online,
    notFound,
    readOnly,
    error,
    versions,
    versionsLoading,
    restoring,
    viewing,
    setGraph,
    save,
    revert,
    setVisibility,
    viewVersion,
    closeVersion,
    restore,
    refresh,
  } = useBoard(slug)

  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  /** The dialog that stands between unsaved work and leaving the page. */
  const [leaving, setLeaving] = useState<(() => void) | null>(null)

  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  /** Set just before a history move this page itself asked for, so it passes. */
  const bypass = useRef(false)

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    // A duplicate history entry for this same address. The browser's Back pops
    // it without moving the router, which is what turns Back into a question
    // rather than a silent loss — `beforeunload` never fires on a hash change.
    window.history.pushState(null, '', window.location.href)

    const onPop = () => {
      if (bypass.current) {
        bypass.current = false
        return
      }
      if (!dirtyRef.current) {
        // Nothing to lose: let the press through to where it was going.
        bypass.current = true
        window.history.back()
        return
      }
      window.history.pushState(null, '', window.location.href)
      setLeaving(() => () => {
        bypass.current = true
        window.history.go(-2)
      })
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      window.removeEventListener('popstate', onPop)
    }
  }, [])

  const saveNow = async () => {
    const ok = await save(note)
    if (ok) setNote('')
    return ok
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicBoardUrl(slug))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // No clipboard permission: the address is on screen and selectable.
      setCopied(false)
    }
  }

  const plainError =
    error?.kind === 'validation'
      ? COPY.errorValidation
      : error?.kind === 'forbidden'
        ? COPY.errorForbidden
        : error?.kind === 'missing'
          ? COPY.errorMissing
          : error?.kind === 'server'
            ? COPY.errorServer
            : error?.kind === 'offline'
              ? COPY.errorOffline
              : null

  const title: Bi = board ? { fa: boardName(board.name, 'fa'), en: boardName(board.name, 'en') } : { fa: slug, en: slug }
  const isPublic = board?.visibility === 'public'
  const latest = versions.reduce<BoardVersion | null>(
    (best, entry) => (!best || entry.version > best.version ? entry : best),
    null,
  )
  const lastSavedAt = latest?.at ?? board?.updatedAt ?? null
  const shown = viewing ? viewing.graph : graph

  const banner = (
    <PageBanner
      icon="Workflow"
      title={title}
      subtitle={COPY.subtitle}
      actions={
        <button
          type="button"
          aria-label={t(COPY.backToList)}
          title={t(COPY.backToList)}
          onClick={() => {
            if (dirtyRef.current) {
              setLeaving(() => () => navigate('/boards'))
              return
            }
            navigate('/boards')
          }}
          className="text-white/70 transition hover:text-white"
        >
          <Icon name="ChevronLeft" size={18} className="rtl:rotate-180" />
        </button>
      }
    />
  )

  if (loading) {
    return (
      <AppShell>
        {banner}
        <p className="py-10 text-center text-[11.5px] text-white/30">{t(COPY.loading)}</p>
      </AppShell>
    )
  }

  if (!online) {
    return (
      <AppShell>
        {banner}
        <div className="mt-4 rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11.5px] text-white/45">{t(COPY.offline)}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
          >
            {t(COPY.retry)}
          </button>
        </div>
      </AppShell>
    )
  }

  if (notFound) {
    return (
      <AppShell>
        {banner}
        <Card className="mt-4">
          <CardHead
            icon="Search"
            kicker={COPY.missingKicker}
            title={t(COPY.missingTitle)}
            subtitle={t(COPY.missingSub)}
            gradient={['#7c2d12', '#ff6b3d']}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.missingBody)}</p>
          <Link
            to="/boards"
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[linear-gradient(100deg,#4c1d95,#7c3aed)] py-2.5 text-[12.5px] font-medium text-white transition hover:brightness-110"
          >
            <Icon name="ArrowUpRight" size={14} />
            {t(COPY.missingCta)}
          </Link>
        </Card>
      </AppShell>
    )
  }

  return (
    <AppShell>
      {banner}

      {plainError && (
        <div className="mt-3 rounded-xl border border-[#ff6b3d]/40 bg-[#ff6b3d]/10 px-3 py-2.5">
          <p className="text-[11.5px] text-[#ff9a76]">{t(plainError)}</p>
          {error && error.messages.length > 0 && (
            <ul className="mt-1.5 list-disc space-y-1 ps-4 text-[11.5px] text-white/70 marker:text-[#ff9a76]">
              {error.messages.map((code) => (
                <li key={code}>{t(explainBoardCode(code, n))}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {readOnly && (
        <Card className="mt-3">
          <CardHead
            icon="Eye"
            kicker={COPY.readOnlyKicker}
            title={t(COPY.readOnlyTitle)}
            subtitle={t(COPY.readOnlySub)}
            gradient={['#155e75', '#22d3ee']}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.readOnlyBody)}</p>
        </Card>
      )}

      {viewing && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2.5">
          <p className="text-[11.5px] text-[#c0aeff]">
            {t(COPY.viewingBanner).replace('{v}', num(viewing.version))}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={closeVersion}
              className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/70 transition hover:border-accent/50 hover:text-white"
            >
              {t(COPY.closeView)}
            </button>
            {!readOnly && (
              <button
                type="button"
                disabled={restoring !== null}
                onClick={() => void restore(viewing.version)}
                className="rounded-lg border border-accent/50 px-2.5 py-1 text-[10.5px] text-white transition hover:brightness-110 disabled:opacity-40"
              >
                {t(restoring !== null ? COPY.restoringNow : COPY.restoreThis)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* The canvas keeps its own fixed height so the panels below stay reachable. */}
      <div className="mt-3 h-[58vh] min-h-[320px] overflow-hidden rounded-2xl border border-hairline bg-panel/40">
        <EditableCanvas
          graph={shown}
          readOnly={readOnly || viewing !== null}
          onChange={(next: BoardGraph) => setGraph(next)}
          metrics={live.metrics}
          onOpenRoute={(to: string) => {
            // A node that opens a page is still a way off this one, so it asks.
            if (dirtyRef.current) setLeaving(() => () => navigate(to))
            else navigate(to)
          }}
        />
      </div>

      {!readOnly && (
        <Card className="mt-3">
          <CardHead
            icon="Send"
            kicker={COPY.saveKicker}
            title={t(COPY.saveTitle)}
            subtitle={t(COPY.saveSub)}
            gradient={['#065f46', '#34d399']}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.saveBody)}</p>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <Chip tone={dirty ? 'hot' : 'warm'}>{t(dirty ? COPY.unsaved : COPY.saved)}</Chip>
            {board && (
              <Chip tone="accent">
                {t(COPY.version)} {num(board.version)}
              </Chip>
            )}
          </div>

          <div className="mt-2">
            <Row
              label={t(COPY.lastSaved)}
              value={
                <span className="tabular-nums">{boardStamp(lastSavedAt, n) || t(COPY.neverSaved)}</span>
              }
            />
            <Row
              label={t(COPY.onBoard)}
              value={t(COPY.countsLine)
                .replace('{nodes}', num(graph.nodes.length))
                .replace('{edges}', num(graph.edges.length))}
            />
          </div>

          <label htmlFor="board-note" className="mt-3 block text-[11.5px] text-white/70">
            {t(COPY.noteLabel)}
          </label>
          <input
            id="board-note"
            value={note}
            placeholder={t(COPY.notePlaceholder)}
            onChange={(event) => setNote(event.target.value)}
            className={`${SHELL} mt-1.5 text-start`}
          />

          <div className="mt-3">
            <PrimaryButton onClick={() => void saveNow()} disabled={!dirty || saving || viewing !== null}>
              {t(saving ? COPY.savingNow : COPY.saveNow)}
            </PrimaryButton>
          </div>

          {dirty && (
            <button
              type="button"
              onClick={revert}
              className="mt-2 w-full rounded-xl border border-hairline py-2 text-[10.5px] text-white/45 transition hover:border-[#ff6b3d]/50 hover:text-[#ff9a76]"
            >
              {t(COPY.discard)}
            </button>
          )}
        </Card>
      )}

      {!readOnly && board && (
        <Card className="mt-3">
          <CardHead
            icon="Shield"
            kicker={COPY.visibilityKicker}
            title={t(COPY.visibilityTitle)}
            subtitle={t(COPY.visibilitySub)}
            gradient={['#155e75', '#22d3ee']}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Chip tone={isPublic ? 'warm' : 'neutral'}>{t(isPublic ? COPY.public : COPY.private)}</Chip>
            <button
              type="button"
              onClick={() => void setVisibility(isPublic ? 'private' : 'public')}
              className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
            >
              {t(isPublic ? COPY.makePrivate : COPY.makePublic)}
            </button>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-white/40">
            {t(isPublic ? COPY.publicNote : COPY.privateNote)}
          </p>
          {isPublic && (
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                dir="ltr"
                value={publicBoardUrl(slug)}
                onFocus={(event) => event.currentTarget.select()}
                aria-label={t(COPY.copyLink)}
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-black/40 px-2.5 py-1.5 text-[10.5px] text-white/70 outline-none"
              />
              <button
                type="button"
                onClick={() => void copyLink()}
                className="shrink-0 rounded-lg border border-hairline px-2.5 py-1.5 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
              >
                {t(copied ? COPY.copied : COPY.copyLink)}
              </button>
            </div>
          )}
        </Card>
      )}

      <Card className="mt-3">
        <CardHead
          icon="Clock"
          kicker={COPY.historyKicker}
          title={t(COPY.historyTitle)}
          subtitle={t(COPY.historySub)}
          gradient={['#3730a3', '#6366f1']}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t(COPY.historyBody)}</p>

        <div className="mt-3 space-y-2">
          {versionsLoading ? (
            <p className="py-3 text-center text-[11.5px] text-white/30">{t(COPY.historyLoading)}</p>
          ) : versions.length === 0 ? (
            <p className="py-3 text-center text-[11.5px] text-white/30">{t(COPY.historyEmpty)}</p>
          ) : (
            [...versions]
              .sort((a, b) => b.version - a.version)
              .map((entry) => (
                <article key={entry.version} className="rounded-xl border border-hairline bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={entry.version === board?.version ? 'warm' : 'neutral'}>
                      {t(COPY.version)} {num(entry.version)}
                    </Chip>
                    {entry.nodes !== null && (
                      <Chip>
                        {num(entry.nodes)} · {entry.edges === null ? '—' : num(entry.edges)}
                      </Chip>
                    )}
                    <span className="text-[10.5px] tabular-nums text-white/35">{boardStamp(entry.at, n)}</span>
                  </div>

                  {/* The note is the owner's own writing, so it renders as typed. */}
                  {entry.note && <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/70">{entry.note}</p>}

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void viewVersion(entry.version)}
                      className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
                    >
                      {t(COPY.view)}
                    </button>
                    {!readOnly && (
                      <button
                        type="button"
                        disabled={restoring !== null}
                        onClick={() => void restore(entry.version)}
                        className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white disabled:opacity-40"
                      >
                        {t(restoring === entry.version ? COPY.restoringNow : COPY.restore)}
                      </button>
                    )}
                  </div>
                </article>
              ))
          )}
        </div>
      </Card>

      {leaving && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-5" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-hairline bg-panel p-4">
            <h2 className="text-[13.5px] font-semibold text-white/90">{t(COPY.leaveTitle)}</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/60">{t(COPY.leaveBody)}</p>
            <div className="mt-3 flex flex-col gap-2">
              {!readOnly && (
                <PrimaryButton
                  disabled={saving}
                  onClick={() => {
                    void saveNow().then((ok) => {
                      if (!ok) return
                      const go = leaving
                      setLeaving(null)
                      go()
                    })
                  }}
                >
                  {t(saving ? COPY.savingNow : COPY.leaveSave)}
                </PrimaryButton>
              )}
              <button
                type="button"
                onClick={() => {
                  const go = leaving
                  setLeaving(null)
                  go()
                }}
                className="w-full rounded-xl border border-hairline py-2 text-[11.5px] text-white/50 transition hover:border-[#ff6b3d]/50 hover:text-[#ff9a76]"
              >
                {t(COPY.leaveAnyway)}
              </button>
              <button
                type="button"
                onClick={() => setLeaving(null)}
                className="w-full rounded-xl border border-hairline py-2 text-[11.5px] text-white/70 transition hover:border-accent/50 hover:text-white"
              >
                {t(COPY.stay)}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
