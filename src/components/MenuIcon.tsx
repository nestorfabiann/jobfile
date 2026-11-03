const PATHS: Record<string, string> = {
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  proj: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/><path d="M10 13h6M10 17h6"/>',
  mkt: '<path d="M4 9l1.5-5h13L20 9"/><path d="M4 9a2.7 2.7 0 005.3 0 2.7 2.7 0 005.4 0A2.7 2.7 0 0020 9"/><path d="M5 12v8h14v-8"/><path d="M10 20v-4h4v4"/>',
  find: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  set: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
  inv: '<circle cx="10" cy="8" r="4"/><path d="M3 20c0-3.6 3-6 7-6"/><path d="M18 14v6M15 17h6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 114 2c-.9.6-1.5 1-1.5 2"/><path d="M12 17h.01"/>',
  biz: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V5h6v3"/><path d="M3 13h18"/>',
  adm: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6z"/>',
  out: '<path d="M10 4H5v16h5"/><path d="M15 8l4 4-4 4"/><path d="M19 12H9"/>',
};

/** Thin outline icon for the menus. Takes the text color of its row. */
export default function MenuIcon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }} dangerouslySetInnerHTML={{ __html: PATHS[name] ?? '' }} />;
}
