import { Link } from 'react-router-dom'
import { NodeIcon } from './icons'
import { Icon } from './Icon'
import { useBusiness } from '../api/useBusiness'
import { nodeGuide } from '../data/nodeGuide'
import { explainCode } from '../i18n/errors'
import { useI18n } from '../i18n/I18nProvider'
import type { StageNode } from '../data/types'

const COPY = {
  auto: { fa: 'خودش کار می‌کند', en: 'Runs on its own' },
  autoNote: {
    fa: 'کارگر پس‌زمینه هر چند ثانیه این را جلو می‌برد؛ لازم نیست کسی نگاه کند.',
    en: 'The background worker moves this every few seconds; nobody has to be watching.',
  },
  manual: { fa: 'با تو جلو می‌رود', en: 'You drive this' },
  manualNote: {
    fa: 'این نود منتظر توست. از دکمه‌ی پایین واردش شو.',
    en: 'This node waits for you. The button below is the way in.',
  },
  needs: { fa: 'به داده‌ی تو نیاز دارد', en: 'Needs your data' },
  needsNote: {
    fa: 'تا این فیلدها پر نشوند، هرچه اینجا نوشته شود درباره‌ی کسب‌وکار تو نیست:',
    en: 'Until these are filled in, nothing written here is about your business:',
  },
  toBusiness: { fa: 'پروفایل بیزینسی', en: 'Business profile' },
  close: { fa: 'بستن', en: 'Close' },
  dismiss: { fa: 'بستن توضیح این نود', en: 'Dismiss this node’s description' },
  noGuide: {
    fa: 'هنوز توضیحی برای این نود نوشته نشده.',
    en: 'No description has been written for this node yet.',
  },
}

/**
 * What one box on the board does, and the way in to its work. Opened by tapping
 * a node; the explanation itself lives in `src/data/nodeGuide.ts`, never here.
 */
export default function NodeSheet({ node, onClose }: { node: StageNode | null; onClose: () => void }) {
  const { t } = useI18n()
  const { missing, online } = useBusiness()

  if (!node) return null

  // A node with no entry still opens, saying so — a silent dead tap would hide
  // the omission instead of showing it.
  const guide = nodeGuide[node.id]

  // An unreachable API leaves `missing` empty, so a dead server never accuses
  // the owner of an incomplete profile it could not read.
  const blocked = guide?.needsBusiness && online && missing.length > 0
  const driver = guide?.driver === 'auto' ? COPY.auto : COPY.manual
  const driverNote = guide?.driver === 'auto' ? COPY.autoNote : COPY.manualNote

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label={t(COPY.dismiss)}
        onClick={onClose}
        className="absolute inset-0 bg-black/65 backdrop-blur-[2px]"
      />

      <div className="sheet-in relative max-h-[85vh] w-full max-w-[520px] overflow-y-auto rounded-t-3xl border-t border-hairline bg-panel px-5 pb-6 pt-4 text-start">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/15" />

        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-white/35">{t(node.kicker)}</div>
            <div className="truncate text-[15px] font-semibold text-white/92">{t(node.title)}</div>
          </div>
          <NodeIcon icon={node.icon} size={22} />
        </div>

        <div className="mt-4 space-y-1.5 border-t border-hairline pt-3">
          {t(guide?.what ?? COPY.noGuide)
            .split('\n')
            .map((line) => (
              <p key={line} className="text-[12.5px] leading-relaxed text-white/60">
                {line}
              </p>
            ))}
        </div>

        {guide && (
        <div className="mt-3 rounded-xl border border-hairline bg-black/25 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${guide.driver === 'auto' ? 'bg-success' : 'bg-accent'}`}
            />
            <span className="text-[11.5px] font-semibold text-white/75">{t(driver)}</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-white/40">{t(driverNote)}</p>
        </div>
        )}

        {guide?.caveat && (
          <p className="mt-3 rounded-xl border border-hairline bg-white/[0.03] px-3 py-2.5 text-[11.5px] leading-relaxed text-white/45">
            {t(guide.caveat)}
          </p>
        )}

        {blocked && (
          <div className="mt-3 rounded-xl border border-accent/40 bg-accent/[0.07] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[11.5px] font-semibold text-white/80">
              <Icon name="Briefcase" size={13} />
              {t(COPY.needs)}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-white/45">{t(COPY.needsNote)}</p>
            <ul className="mt-1.5 space-y-0.5 text-[11px] text-white/55">
              {missing.map((code) => (
                <li key={code}>{t(explainCode(code))}</li>
              ))}
            </ul>
            <Link
              to="/business"
              onClick={onClose}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-[11.5px] text-white/80 transition hover:text-white"
            >
              <Icon name="Briefcase" size={13} />
              {t(COPY.toBusiness)}
            </Link>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {guide?.to && guide.action && (
            <Link
              to={guide.to}
              onClick={onClose}
              className="flex-1 rounded-xl bg-accent/90 py-2.5 text-center text-[12.5px] font-semibold text-white transition hover:bg-accent"
            >
              {t(guide.action)}
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`rounded-xl border border-hairline py-2.5 text-[12.5px] text-white/50 transition hover:text-white ${
              guide?.to ? 'w-28' : 'flex-1'
            }`}
          >
            {t(COPY.close)}
          </button>
        </div>
      </div>
    </div>
  )
}
