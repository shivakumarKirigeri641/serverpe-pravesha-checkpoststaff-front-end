import { useEffect, useState } from 'react';
import { dismissInstall, install, refresh, subscribe } from '../lib/pwa.js';
import { useT } from '../lib/i18n.jsx';

/*
 * One small card at the top of the screen: a new version to load, or the app
 * to install. The new version wins — it matters more — and neither blocks
 * anything underneath; both can be put away with one tap.
 */
export default function AppBanners() {
  const { t } = useT();
  const [s, setS] = useState({ canInstall: false, iosGuide: false, updateReady: false });
  const [later, setLater] = useState(false);
  useEffect(() => subscribe(setS), []);

  let body = null;
  if (s.updateReady && !later) {
    body = (
      <>
        <p className="flex-1 text-[14px] font-semibold">{t('pwaUpdate')}</p>
        <button type="button" onClick={() => setLater(true)} className="px-2 py-2 text-[13px] font-semibold text-muted">{t('pwaLater')}</button>
        <button type="button" onClick={refresh} className="btn-primary px-4 py-2 text-[14px]">{t('pwaRefresh')}</button>
      </>
    );
  } else if (s.canInstall) {
    body = (
      <>
        <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
        <p className="flex-1 text-[14px] font-semibold">{t('pwaInstall')}</p>
        <button type="button" onClick={dismissInstall} className="px-2 py-2 text-[13px] font-semibold text-muted">{t('pwaNotNow')}</button>
        <button type="button" onClick={install} className="btn-primary px-4 py-2 text-[14px]">{t('pwaInstallBtn')}</button>
      </>
    );
  } else if (s.iosGuide) {
    body = (
      <>
        <img src="/icon-192.png" alt="" className="h-9 w-9 rounded-xl" />
        <div className="flex-1">
          <p className="text-[14px] font-semibold">{t('pwaInstall')}</p>
          <p className="text-[13px] text-muted">{t('pwaIosSteps')}</p>
        </div>
        <button type="button" onClick={dismissInstall} className="px-2 py-2 text-[13px] font-semibold text-muted">{t('pwaNotNow')}</button>
      </>
    );
  }

  if (!body) return null;
  return (
    <div className="fixed inset-x-0 top-0 z-40 px-3 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
      <div className="card mx-auto flex max-w-lg items-center gap-2 px-3 py-2.5">{body}</div>
    </div>
  );
}
