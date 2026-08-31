import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AppShell from '../components/AppShell'
import PageBanner from '../components/PageBanner'
import { Card, CardHead, PrimaryButton } from '../components/Card'
import Chip from '../components/Chip'
import { Icon } from '../components/Icon'
import {
  boardName,
  boardStamp,
  explainBoardCode,
  publicBoardUrl,
  useBoards,
  type Board,
  type BoardVisibility,
} from '../api/useBoards'
import { useI18n } from '../i18n/I18nProvider'
import type { Bi } from '../data/types'

const COPY = {
  title: { fa: 'بوم‌های من', en: 'My boards' },
  subtitle: { fa: 'نقشه‌هایی که خودت می‌سازی', en: 'The maps you build yourself' },
  backToBoard: { fa: 'بازگشت به بوم فروش', en: 'Back to the sales board' },

  // create
  createKicker: { fa: 'بوم تازه', en: 'New board' },
  createTitle: { fa: 'یک بوم خالی بساز', en: 'Start an empty board' },
  createSub: { fa: 'نامش را بعداً هم می‌شود عوض کرد', en: 'The name can change later' },
  nameFa: { fa: 'نام فارسی', en: 'Persian name' },
  nameEn: { fa: 'نام انگلیسی', en: 'English name' },
  nameHint: {
    fa: 'هر دو زبان را بنویس؛ برنامه نام را به زبان خودت نشان می‌دهد.',
    en: 'Write both; the app shows the name in whichever language you are reading.',
  },
  createNow: { fa: 'ساختن بوم', en: 'Create the board' },
  creatingNow: { fa: 'در حال ساختن…', en: 'Creating…' },
  needsSession: {
    fa: 'برای ساختن یا تغییر بوم باید وارد شده باشی.',
    en: 'Making or changing a board needs you to be signed in.',
  },

  // list
  listKicker: { fa: 'بوم‌ها', en: 'Boards' },
  listTitle: { fa: 'هرچه تا حالا ساخته‌ای', en: 'Everything you have built' },
  listSub: { fa: 'تازه‌ترین تغییر اول', en: 'Most recently changed first' },
  loading: { fa: 'در حال بارگذاری…', en: 'Loading…' },
  empty: { fa: 'هنوز بومی نساخته‌ای.', en: 'You have not built a board yet.' },
  emptyPublic: {
    fa: 'بوم عمومی‌ای برای نشان دادن نیست.',
    en: 'There is no public board to show.',
  },

  // a row
  open: { fa: 'باز کردن', en: 'Open' },
  nodesLabel: { fa: 'گره', en: 'nodes' },
  edgesLabel: { fa: 'یال', en: 'edges' },
  versionLabel: { fa: 'نسخه', en: 'version' },
  changed: { fa: 'آخرین تغییر', en: 'Changed' },
  unknown: { fa: '—', en: '—' },
  private: { fa: 'خصوصی', en: 'private' },
  public: { fa: 'عمومی', en: 'public' },

  // rename
  rename: { fa: 'تغییر نام', en: 'Rename' },
  renameSave: { fa: 'ثبت نام تازه', en: 'Save the new name' },
  cancel: { fa: 'انصراف', en: 'Cancel' },

  // visibility
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

  // delete
  remove: { fa: 'حذف بوم', en: 'Delete the board' },
  removeAsk: { fa: 'مطمئنی؟', en: 'Are you sure?' },
  removeWarn: {
    fa: 'حذف بوم همه‌ی نسخه‌های آن را هم پاک می‌کند. این کار برگشت‌پذیر نیست.',
    en: 'Deleting a board destroys every one of its versions too. This cannot be undone.',
  },
  removeYes: { fa: 'بله، حذف کن', en: 'Yes, delete it' },
  removing: { fa: 'در حال حذف…', en: 'Deleting…' },

  // failures
  offline: {
    fa: 'API در دسترس نیست، بنابراین فهرست خالی است و بومی ساخته یا تغییر داده نمی‌شود.',
    en: 'The API is unreachable, so the list is empty and no board can be made or changed.',
  },
  retry: { fa: 'تلاش دوباره', en: 'Try again' },
  errorValidation: { fa: 'درخواست پذیرفته نشد:', en: 'The request was rejected:' },
  errorForbidden: {
    fa: 'اجازه‌ی این کار را نداری. دوباره وارد شو.',
    en: 'You are not allowed to do that. Sign in again.',
  },
  errorMissing: { fa: 'این بوم دیگر وجود ندارد.', en: 'That board no longer exists.' },
  errorServer: { fa: 'سرور نتوانست این کار را انجام دهد.', en: 'The server could not do that.' },
  errorOffline: { fa: 'سرور در دسترس نیست. بعداً دوباره امتحان کن.', en: 'The server is unreachable. Try again later.' },
} satisfies Record<string, Bi>

const SHELL =
  'w-full rounded-xl border border-hairline bg-black/40 px-3.5 py-2.5 text-[12.5px] text-white/85 outline-none placeholder:text-white/25 focus:border-accent/50'

/** The list of boards the owner has built, at `#/boards`. */
export default function Boards() {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const { boards, loading, online, busy, canEdit, error, create, rename, setVisibility, remove, refresh, clearError } =
    useBoards()

  const [draftFa, setDraftFa] = useState('')
  const [draftEn, setDraftEn] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !online || !canEdit) return
    const board = await create({ fa: draftFa.trim(), en: draftEn.trim() })
    if (!board) return
    setDraftFa('')
    setDraftEn('')
    navigate(`/boards/${board.slug}`)
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

  return (
    <AppShell>
      <PageBanner
        icon="Network"
        title={COPY.title}
        subtitle={COPY.subtitle}
        actions={
          <Link
            to="/sales-automation"
            aria-label={t(COPY.backToBoard)}
            title={t(COPY.backToBoard)}
            className="text-white/70 transition hover:text-white"
          >
            <Icon name="ChevronLeft" size={18} className="rtl:rotate-180" />
          </Link>
        }
      />

      {!online && (
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
      )}

      {plainError && (
        <div className="mt-3 rounded-xl border border-[#ff6b3d]/40 bg-[#ff6b3d]/10 px-3 py-2.5">
          <p className="text-[11.5px] text-[#ff9a76]">{t(plainError)}</p>
          <ErrorCodes codes={error?.messages ?? []} />
        </div>
      )}

      {canEdit && (
        <Card className="mt-3">
          <CardHead
            icon="Sparkles"
            kicker={COPY.createKicker}
            title={t(COPY.createTitle)}
            subtitle={t(COPY.createSub)}
            gradient={['#4c1d95', '#8b5cf6']}
          />
          <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={COPY.nameFa} htmlFor="board-name-fa">
                <input
                  id="board-name-fa"
                  dir="rtl"
                  value={draftFa}
                  onChange={(event) => {
                    clearError()
                    setDraftFa(event.target.value)
                  }}
                  className={`${SHELL} mt-1.5 text-start`}
                />
              </Field>
              <Field label={COPY.nameEn} htmlFor="board-name-en">
                <input
                  id="board-name-en"
                  dir="ltr"
                  value={draftEn}
                  onChange={(event) => {
                    clearError()
                    setDraftEn(event.target.value)
                  }}
                  className={`${SHELL} mt-1.5 text-start`}
                />
              </Field>
            </div>
            <p className="text-[10.5px] leading-relaxed text-white/30">{t(COPY.nameHint)}</p>
            <PrimaryButton type="submit" disabled={busy || !online}>
              {t(busy ? COPY.creatingNow : COPY.createNow)}
            </PrimaryButton>
          </form>
        </Card>
      )}

      {!canEdit && (
        <div className="mt-3 rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5">
          <p className="text-[11.5px] text-white/45">{t(COPY.needsSession)}</p>
        </div>
      )}

      <Card className="mt-3">
        <CardHead
          icon="Layers"
          kicker={COPY.listKicker}
          title={t(COPY.listTitle)}
          subtitle={t(COPY.listSub)}
          gradient={['#3730a3', '#6366f1']}
        />

        <div className="mt-3 space-y-2">
          {loading ? (
            <p className="py-4 text-center text-[11.5px] text-white/30">{t(COPY.loading)}</p>
          ) : boards.length === 0 ? (
            <p className="py-4 text-center text-[11.5px] text-white/30">
              {t(!online ? COPY.offline : canEdit ? COPY.empty : COPY.emptyPublic)}
            </p>
          ) : (
            boards.map((board) => (
              <BoardRow
                key={board.slug}
                board={board}
                locale={locale}
                canEdit={canEdit}
                busy={busy}
                onRename={(name) => rename(board.slug, name)}
                onVisibility={(visibility) => setVisibility(board.slug, visibility)}
                onRemove={() => remove(board.slug)}
              />
            ))
          )}
        </div>
      </Card>
    </AppShell>
  )
}

/** The server's `field:code` answers, as sentences (rule 11). */
function ErrorCodes({ codes }: { codes: string[] }) {
  const { t, n } = useI18n()
  if (codes.length === 0) return null
  return (
    <ul className="mt-1.5 list-disc space-y-1 ps-4 text-[11.5px] text-white/70 marker:text-[#ff9a76]">
      {codes.map((code) => (
        <li key={code}>{t(explainBoardCode(code, n))}</li>
      ))}
    </ul>
  )
}

function Field({ label, htmlFor, children }: { label: Bi; htmlFor: string; children: ReactNode }) {
  const { t } = useI18n()
  return (
    <div>
      <label htmlFor={htmlFor} className="text-[11.5px] text-white/70">
        {t(label)}
      </label>
      {children}
    </div>
  )
}

function BoardRow({
  board,
  locale,
  canEdit,
  busy,
  onRename,
  onVisibility,
  onRemove,
}: {
  board: Board
  locale: 'fa' | 'en'
  canEdit: boolean
  busy: boolean
  onRename: (name: Bi) => Promise<boolean>
  onVisibility: (visibility: BoardVisibility) => Promise<boolean>
  onRemove: () => Promise<boolean>
}) {
  const { t, n, num } = useI18n()
  const [renaming, setRenaming] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [copied, setCopied] = useState(false)
  const [draft, setDraft] = useState<Bi>(board.name)

  const isPublic = board.visibility === 'public'
  const link = publicBoardUrl(board.slug)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // No clipboard permission: the address is on screen and selectable anyway.
      setCopied(false)
    }
  }

  const submitName = async (event: FormEvent) => {
    event.preventDefault()
    const ok = await onRename({ fa: draft.fa.trim(), en: draft.en.trim() })
    if (ok) setRenaming(false)
  }

  return (
    <article className="rounded-xl border border-hairline bg-white/[0.02] p-3">
      <div className="flex items-start gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-accent/15 text-white/80">
          <Icon name="Workflow" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[12.5px] font-medium leading-snug text-white/90">
            {boardName(board.name, locale)}
          </h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Chip tone={isPublic ? 'warm' : 'neutral'}>{t(isPublic ? COPY.public : COPY.private)}</Chip>
            <Chip tone="accent">
              {t(COPY.versionLabel)} {num(board.version)}
            </Chip>
            <Chip>
              {board.nodes === null ? t(COPY.unknown) : num(board.nodes)} {t(COPY.nodesLabel)}
            </Chip>
            <Chip>
              {board.edges === null ? t(COPY.unknown) : num(board.edges)} {t(COPY.edgesLabel)}
            </Chip>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10.5px] text-white/35">
        {t(COPY.changed)}{' '}
        <span className="text-white/55 tabular-nums">{boardStamp(board.updatedAt, n) || t(COPY.unknown)}</span>
      </div>

      {isPublic && (
        <div className="mt-2.5 rounded-lg border border-hairline bg-black/30 p-2.5">
          <p className="text-[10.5px] leading-relaxed text-white/40">{t(COPY.publicNote)}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              dir="ltr"
              value={link}
              onFocus={(event) => event.currentTarget.select()}
              aria-label={t(COPY.copyLink)}
              className="min-w-0 flex-1 rounded-lg border border-hairline bg-black/40 px-2.5 py-1.5 text-[10.5px] text-white/70 outline-none"
            />
            <button
              type="button"
              onClick={() => void copy()}
              className="shrink-0 rounded-lg border border-hairline px-2.5 py-1.5 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
            >
              {t(copied ? COPY.copied : COPY.copyLink)}
            </button>
          </div>
        </div>
      )}

      {renaming && (
        <form className="mt-2.5 flex flex-col gap-2" onSubmit={submitName}>
          <input
            dir="rtl"
            aria-label={t(COPY.nameFa)}
            value={draft.fa}
            onChange={(event) => setDraft((prev) => ({ ...prev, fa: event.target.value }))}
            className={`${SHELL} text-start`}
          />
          <input
            dir="ltr"
            aria-label={t(COPY.nameEn)}
            value={draft.en}
            onChange={(event) => setDraft((prev) => ({ ...prev, en: event.target.value }))}
            className={`${SHELL} text-start`}
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg border border-accent/50 px-2.5 py-1 text-[10.5px] text-white transition hover:brightness-110 disabled:opacity-40"
            >
              {t(COPY.renameSave)}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(board.name)
                setRenaming(false)
              }}
              className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/50 transition hover:text-white"
            >
              {t(COPY.cancel)}
            </button>
          </div>
        </form>
      )}

      {confirming && (
        <div className="mt-2.5 rounded-lg border border-[#ff6b3d]/40 bg-[#ff6b3d]/10 p-2.5">
          <p className="text-[11.5px] font-medium text-[#ff9a76]">{t(COPY.removeAsk)}</p>
          <p className="mt-1 text-[10.5px] leading-relaxed text-white/60">{t(COPY.removeWarn)}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void onRemove()}
              className="rounded-lg border border-[#ff6b3d]/50 px-2.5 py-1 text-[10.5px] text-[#ff9a76] transition hover:bg-[#ff6b3d]/20 disabled:opacity-40"
            >
              {t(busy ? COPY.removing : COPY.removeYes)}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/50 transition hover:text-white"
            >
              {t(COPY.cancel)}
            </button>
          </div>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Link
          to={`/boards/${board.slug}`}
          className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/70 transition hover:border-accent/50 hover:text-white"
        >
          {t(COPY.open)}
        </Link>

        {canEdit && (
          <>
            <button
              type="button"
              onClick={() => {
                setDraft(board.name)
                setRenaming((prev) => !prev)
              }}
              aria-expanded={renaming}
              className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white"
            >
              {t(COPY.rename)}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void onVisibility(isPublic ? 'private' : 'public')}
              className="rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/60 transition hover:border-accent/50 hover:text-white disabled:opacity-40"
            >
              {t(isPublic ? COPY.makePrivate : COPY.makePublic)}
            </button>
            <button
              type="button"
              onClick={() => setConfirming((prev) => !prev)}
              aria-expanded={confirming}
              className="ms-auto rounded-lg border border-hairline px-2.5 py-1 text-[10.5px] text-white/40 transition hover:border-[#ff6b3d]/50 hover:text-[#ff9a76]"
            >
              {t(COPY.remove)}
            </button>
          </>
        )}
      </div>

      {canEdit && !isPublic && <p className="mt-2 text-[10px] text-white/25">{t(COPY.privateNote)}</p>}
    </article>
  )
}
