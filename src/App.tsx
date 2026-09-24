import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  Flag,
  History,
  Info,
  LoaderCircle,
  MapPin,
  Menu,
  Plus,
  Radio,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react';
import {
  CLASSES,
  FACTIONS,
  REGIONS,
  RULESETS,
  ZONES,
  type LobbyData,
  type Match,
  type Opponent,
  type Preferences,
  type Profile,
  type SessionData,
} from '../shared/types';
import { api } from './api';
import { Avatar, DiceArt, Gold, Mark, Modal } from './components';

type Page = 'lobby' | 'room' | 'history' | 'addon';
const nav = [
  { id: 'lobby', label: 'Find a match', icon: Users },
  { id: 'room', label: 'Match room', icon: Swords },
  { id: 'history', label: 'Your history', icon: History },
  { id: 'addon', label: 'Rollkeeper addon', icon: ScrollText },
] as const;
const number = (value: number) => value.toLocaleString();
const date = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export function App() {
  const [me, setMe] = useState<SessionData | null>(null);
  const [lobby, setLobby] = useState<LobbyData>({ opponents: [], queued: false, expiresAt: null });
  const [history, setHistory] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [page, setPage] = useState<Page>('lobby');
  const [modal, setModal] = useState<'profile' | 'guide' | 'ticket' | 'dispute' | 'receipt' | null>(
    null,
  );
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [booting, setBooting] = useState(true);
  const refreshInFlight = useRef(false);
  const selectedId = useRef<string | null>(null);
  selectedId.current = selectedMatch?.id ?? null;
  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      const [session, queue, past] = await Promise.all([
        api<SessionData>('/me'),
        api<LobbyData>('/lobby'),
        api<{ matches: Match[] }>('/history'),
      ]);
      setMe(session);
      setLobby(queue);
      setHistory(past.matches);
      if (
        session.activeMatch &&
        (!selectedId.current || selectedId.current === session.activeMatch.id)
      )
        setSelectedMatch(session.activeMatch);
      else if (selectedId.current) {
        const found = past.matches.find((m) => m.id === selectedId.current);
        if (found) setSelectedMatch(found);
      }
    } finally {
      refreshInFlight.current = false;
    }
  }, []);
  const boot = useCallback(async () => {
    setBooting(true);
    setError('');
    try {
      await api('/session', 'POST');
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBooting(false);
    }
  }, [refresh]);
  useEffect(() => {
    void boot();
  }, [boot]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);
  useEffect(() => {
    if (!me) return;
    const interval = setInterval(() => {
      if (!document.hidden)
        void refresh().catch(() =>
          setError('Connection interrupted. Your progress is saved; reconnecting…'),
        );
    }, 5000);
    return () => clearInterval(interval);
  }, [!!me, refresh]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await action();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function navigate(next: Page) {
    setPage(next);
    setMobileNav(false);
    setError('');
  }
  function challenge(opponent: Opponent) {
    void run(async () => {
      const data = await api<{ match: Match }>('/matches', 'POST', { opponentId: opponent.id });
      setSelectedMatch(data.match);
      setPage('room');
    });
  }
  function matchAction(action: string, body?: unknown) {
    if (!selectedMatch) return;
    void run(async () => {
      const data = await api<{ match: Match }>(
        `/matches/${selectedMatch.id}/${action}`,
        'POST',
        body ?? {},
      );
      setSelectedMatch(data.match);
      setModal(null);
    });
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast('Copied to clipboard.');
    } catch {
      setError('Copy is unavailable. Select the ticket text and copy it manually.');
    }
  }
  if (!me)
    return (
      <div className="boot-screen">
        <Mark size={52} />
        <h1>
          Last Roll<span>.</span>
        </h1>
        {booting ? (
          <p>
            <LoaderCircle className="spin" size={16} /> Opening the tavern…
          </p>
        ) : (
          <>
            <p role="alert">{error}</p>
            <button className="button primary" onClick={() => void boot()}>
              Try again
            </button>
          </>
        )}
      </div>
    );
  const active = me.activeMatch;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate('lobby');
          }}
        >
          <Mark />
          <span>
            Last Roll<span className="brand-period">.</span>
          </span>
        </a>
        <div className="sidebar-label">THE MEETING PLACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'active' : ''}`}
              onClick={() => {
                if (id === 'room' && active) setSelectedMatch(active);
                navigate(id);
              }}
              aria-current={page === id ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'room' && active && <i className="notification-dot" />}
              {id === 'addon' && <span className="nav-new">NEW</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-community">
          <div className="community-icon">
            <Swords size={20} />
          </div>
          <h3>
            Good games.
            <br />
            Better company.
          </h3>
          <p>
            A little luck goes a long way.
            <br />A little trust goes further.
          </p>
          <button className="text-button" onClick={() => setModal('guide')}>
            The Last Roll way <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="practice-chip">
            <span /> PRACTICE EDITION
          </span>
          <p>
            Independent. Community minded.
            <br />
            Not affiliated with Blizzard.
          </p>
          <a
            href="https://github.com/ForkFiesta/deathroll_matchmaker"
            target="_blank"
            rel="noreferrer"
          >
            Built in the open <ArrowUpRight size={12} />
          </a>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              aria-expanded={mobileNav}
              onClick={() => setMobileNav((v) => !v)}
            >
              {mobileNav ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="world-label">WORLD OF WARCRAFT: FOREVER</span>
            <span className="topbar-divider" />
            <span className="region-label">
              {me.profile.region} <ChevronDown size={12} />
            </span>
          </div>
          <div className="topbar-right">
            <span className="connection">
              <i /> Practice mode
            </span>
            <button
              className="profile-button"
              onClick={() => setModal('profile')}
              aria-label="Edit character profile"
            >
              <Avatar player={me.profile} />
              <span>
                {me.profile.name}
                <small>
                  {me.profile.className} · {me.profile.faction}
                </small>
              </span>
              <ChevronDown size={13} />
            </button>
          </div>
        </header>
        <main>
          {error && (
            <div className="error-banner" role="alert">
              <Info size={17} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {active && page !== 'room' && (
            <button
              className="active-banner"
              onClick={() => {
                setSelectedMatch(active);
                navigate('room');
              }}
            >
              <Radio size={17} />
              <span>
                {active.phase === 'invited'
                  ? 'A match invitation is waiting.'
                  : 'Your match is in progress.'}
              </span>
              <span>
                Open match room <ArrowRight size={16} />
              </span>
            </button>
          )}
          {page === 'lobby' && (
            <Lobby
              me={me}
              lobby={lobby}
              busy={busy}
              challenge={challenge}
              guide={() => setModal('guide')}
              save={(preferences) =>
                void run(async () => {
                  const { id: _id, ...profile } = me.profile;
                  await api('/profile', 'PUT', { ...profile, preferences });
                  setToast('Preferences saved. Your matches have been updated.');
                })
              }
              toggleQueue={() =>
                void run(async () => {
                  await api('/queue', lobby.queued ? 'DELETE' : 'POST', {});
                  setToast(
                    lobby.queued
                      ? 'You left the community queue.'
                      : 'You’re visible in the community queue for 15 minutes.',
                  );
                })
              }
              editProfile={() => setModal('profile')}
            />
          )}
          {page === 'room' && (
            <MatchRoom
              match={selectedMatch}
              me={me.profile}
              busy={busy}
              action={matchAction}
              find={() => navigate('lobby')}
              exportTicket={() =>
                void run(async () => {
                  const data = await api<{ ticket: string }>(
                    `/matches/${selectedMatch!.id}/ticket`,
                  );
                  setTicket(data.ticket);
                  setModal('ticket');
                })
              }
              dispute={() => setModal('dispute')}
              receipt={() => setModal('receipt')}
            />
          )}
          {page === 'history' && (
            <HistoryPage
              matches={history}
              me={me}
              open={(match) => {
                setSelectedMatch(match);
                navigate('room');
              }}
              find={() => navigate('lobby')}
            />
          )}
          {page === 'addon' && <AddonPage guide={() => setModal('guide')} />}
          <footer className="page-footer">
            <span>
              <Mark size={17} /> A good roll starts with a fair agreement.
            </span>
            <span>Practice only · No gold changes hands</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === 'profile' && (
        <Modal title="Your character" close={() => setModal(null)}>
          <ProfileForm
            profile={me.profile}
            busy={busy}
            locked={!!active}
            save={(profile) =>
              void run(async () => {
                await api('/profile', 'PUT', profile);
                setModal(null);
                setToast('Character profile updated.');
              })
            }
          />
        </Modal>
      )}
      {modal === 'guide' && (
        <Modal title="The Last Roll way" close={() => setModal(null)}>
          <div className="guide-content">
            <p className="lead">A familiar game, with a little more common ground.</p>
            {[
              [
                'Set your boundaries',
                'Choose a stake range and daily practice loss limit. Every match must fit both players’ preferences.',
              ],
              [
                'Agree before you roll',
                'Confirm your opponent, stake, starting roll and first player. In deathroll, players take turns rolling from 1 to the previous result. Rolling 1 loses.',
              ],
              [
                'Play a practice match',
                'The website simulates rolls with no gold at stake. Sample partners respond automatically; community players take their own turns.',
              ],
              [
                'Keep an honest record',
                'Both players confirm practice settlement. Client receipts are supplementary evidence, never guaranteed proof of payment.',
              ],
            ].map(([title, description], i) => (
              <div className="guide-step" key={title}>
                <span>0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </div>
            ))}
            <div className="notice">
              <Info size={19} />
              <p>
                Forever character verification, live position, layers, and real-gold play are not
                connected. Blizzard prohibits deathroll advertising; public gold matchmaking
                requires policy clarification.
              </p>
            </div>
            <a
              className="text-button"
              href="https://us.support.blizzard.com/en/help/article/227547"
              target="_blank"
              rel="noreferrer"
            >
              Read Blizzard’s policy <ExternalLink size={14} />
            </a>
          </div>
        </Modal>
      )}
      {modal === 'ticket' && (
        <Modal title="Take the terms into Rollkeeper" close={() => setModal(null)}>
          <p className="modal-description">
            Open <code>/rollkeeper</code> in-game and paste this complete ticket. It records
            practice terms; it doesn’t connect the website to WoW or certify a result.
          </p>
          <textarea
            className="ticket-area"
            value={ticket}
            readOnly
            aria-label="Rollkeeper match ticket"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button className="button primary full" onClick={() => void copy(ticket)}>
            <Copy size={16} /> Copy match ticket
          </button>
        </Modal>
      )}
      {modal === 'dispute' && (
        <Modal title="Record an issue" close={() => setModal(null)}>
          <p className="modal-description">
            Describe what happened. This closes the practice match as disputed. It does not penalize
            your opponent’s public profile.
          </p>
          <TextSubmit
            label="What happened?"
            placeholder="The other player disconnected before we finished…"
            button="Save dispute"
            busy={busy}
            minLength={10}
            maxLength={500}
            submit={(reason) => matchAction('dispute', { reason })}
          />
        </Modal>
      )}
      {modal === 'receipt' && (
        <Modal title="Attach a Rollkeeper receipt" close={() => setModal(null)}>
          <p className="modal-description">
            Paste the receipt from the addon. It stays labeled as client-supplied evidence and
            cannot change the website’s rolls or settlement state.
          </p>
          <TextSubmit
            label="Practice receipt"
            placeholder="RKR1|…"
            button="Attach receipt"
            busy={busy}
            minLength={10}
            maxLength={1000}
            submit={(receipt) => matchAction('receipt', { receipt })}
          />
        </Modal>
      )}
    </div>
  );
}

function Lobby({
  me,
  lobby,
  busy,
  challenge,
  guide,
  save,
  toggleQueue,
  editProfile,
}: {
  me: SessionData;
  lobby: LobbyData;
  busy: boolean;
  challenge: (p: Opponent) => void;
  guide: () => void;
  save: (p: Preferences) => void;
  toggleQueue: () => void;
  editProfile: () => void;
}) {
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'sample' | 'community'>('sample');
  const [nearby, setNearby] = useState(false);
  const opponents = lobby.opponents.filter(
    (p) =>
      p.demo === (tab === 'sample') &&
      (!nearby || p.zone === me.profile.zone) &&
      `${p.name} ${p.className} ${p.zone}`.toLowerCase().includes(search.toLowerCase()),
  );
  const sampleCount = lobby.opponents.filter((p) => p.demo).length;
  const communityCount = lobby.opponents.filter((p) => !p.demo).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE LUCK. A LITTLE TRUST.</div>
          <h1>
            Find your next roll<span>.</span>
          </h1>
          <p>Meet players on your terms. Let the dice take it from there.</p>
        </div>
        <button className="button secondary small" onClick={guide}>
          <BookOpen size={16} /> How it works
        </button>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-tag">
            <span /> THE TABLE IS OPEN
          </span>
          <h2>
            Your stakes.
            <br />
            Your kind of company.
          </h2>
          <p>
            Good matches start before the first roll.
            <br />
            Find common ground, agree on the stakes, and play.
          </p>
          <button
            className="hero-link"
            onClick={() =>
              document
                .getElementById('opponent-list')
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            Find your seat <ArrowRight size={17} />
          </button>
        </div>
        <DiceArt />
        <div className="hero-bottom">
          <span>
            <ShieldCheck size={15} /> Your limits come first
          </span>
          <span>
            <Users size={15} /> Every match is mutual
          </span>
          <span>
            <ScrollText size={15} /> A record of every roll
          </span>
        </div>
      </section>
      <div className="lobby-layout">
        <div className="opponents-section" id="opponent-list">
          <div className="section-heading">
            <h2>
              Find your company <span>{opponents.length}</span>
            </h2>
            <span className="refresh-label">
              <i /> Updated every 5s
            </span>
          </div>
          <div className="list-tabs" role="tablist" aria-label="Opponent type">
            <button
              role="tab"
              aria-selected={tab === 'sample'}
              className={tab === 'sample' ? 'selected' : ''}
              onClick={() => setTab('sample')}
            >
              Practice partners <span>{sampleCount}</span>
            </button>
            <button
              role="tab"
              aria-selected={tab === 'community'}
              className={tab === 'community' ? 'selected' : ''}
              onClick={() => setTab('community')}
            >
              Community queue <span>{communityCount}</span>
            </button>
          </div>
          <div className="list-toolbar">
            <label className="search-box">
              <Search size={17} />
              <input
                placeholder="Search name, class, or location"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search opponents"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={14} />
                </button>
              )}
            </label>
            <button
              className={`filter-button ${nearby ? 'on' : ''}`}
              onClick={() => setNearby((v) => !v)}
              aria-pressed={nearby}
            >
              <MapPin size={15} /> Nearby
            </button>
          </div>
          <p className="list-note">
            {tab === 'sample'
              ? 'Fictional players, illustrative history. A real feel for your first practice match.'
              : 'Other visitors on this server. Character details are self-reported.'}
          </p>
          {opponents.length ? (
            <div className="opponent-grid">
              {opponents.map((player) => (
                <OpponentCard
                  key={player.id}
                  player={player}
                  ownZone={me.profile.zone}
                  disabled={busy || !!me.activeMatch}
                  challenge={() => challenge(player)}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Users size={30} />
              <h3>
                {search || nearby
                  ? 'No one fits those filters.'
                  : tab === 'community'
                    ? 'Be the first at the table.'
                    : 'No practice partners in this pool.'}
              </h3>
              <p>
                {tab === 'community'
                  ? 'Join the queue and share this site with a friend. They’ll need a separate browser session and compatible preferences.'
                  : 'Sample partners play US · Normal · Alliance. Adjust your character or widen your stake range.'}
              </p>
              {tab === 'community' ? (
                <button
                  className="button secondary"
                  onClick={toggleQueue}
                  disabled={busy || !!me.activeMatch}
                >
                  {lobby.queued ? 'Leave queue' : 'Join community queue'}
                </button>
              ) : (
                <button className="text-button" onClick={editProfile}>
                  Edit character <ArrowRight size={15} />
                </button>
              )}
            </div>
          )}
          <div className="lobby-footnote">
            <Info size={15} />
            <span>
              Practice stakes have no value. No gold, deposits, or payments are collected.
            </span>
          </div>
        </div>
        <aside className="preferences-column">
          <PreferencesForm
            profile={me.profile}
            losses={me.losses}
            busy={busy || !!me.activeMatch}
            save={save}
          />
          <div className="availability-card">
            <div className="availability-heading">
              <span className="availability-icon">
                <Radio size={17} />
              </span>
              <div>
                <h3>{lobby.queued ? 'You’re at the table' : 'Open a seat for someone'}</h3>
                <p>
                  {lobby.queued ? 'Visible in the community queue' : 'Let other players find you'}
                </p>
              </div>
            </div>
            <button
              className={`button full ${lobby.queued ? 'secondary' : 'subtle'}`}
              onClick={toggleQueue}
              disabled={busy || !!me.activeMatch}
            >
              {lobby.queued ? (
                <>
                  <X size={15} /> Leave queue
                </>
              ) : (
                <>
                  <Plus size={15} /> Join community queue
                </>
              )}
            </button>
            {lobby.expiresAt && (
              <small>
                Availability expires{' '}
                {new Date(lobby.expiresAt).toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
                .
              </small>
            )}
          </div>
          <div className="trust-note">
            <ShieldCheck size={20} />
            <p>
              <strong>Trust grows one match at a time.</strong> History helps you choose. It never
              guarantees that someone will pay.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function OpponentCard({
  player,
  ownZone,
  disabled,
  challenge,
}: {
  player: Opponent;
  ownZone: string;
  disabled: boolean;
  challenge: () => void;
}) {
  return (
    <article className="opponent-card">
      <div className="opponent-top">
        <Avatar player={player} />
        <div className="opponent-name">
          <h3>{player.name}</h3>
          <span>
            {player.className} <i /> {player.faction}
          </span>
        </div>
        <span className={`player-status ${player.demo ? 'sample' : ''}`}>
          {player.demo ? 'SAMPLE' : 'QUEUED'}
        </span>
      </div>
      <div className="opponent-details">
        <div>
          <small>COMFORTABLE STAKES</small>
          <Gold amount={`${player.preferences.minStake}–${player.preferences.maxStake}`} />
        </div>
        <div>
          <small>MEETING PLACE</small>
          <span className="location">
            <MapPin size={13} />
            {player.zone}
          </span>
        </div>
      </div>
      <div className="opponent-history">
        <ShieldCheck size={14} />
        <span>
          <strong>{player.settlements}</strong>{' '}
          {player.demo ? 'sample settlements' : 'confirmed settlements'}
        </span>
        <span className="history-dot">·</span>
        <span>{player.distinctOpponents} opponents</span>
      </div>
      <div className="opponent-bottom">
        <span className={player.zone === ownZone ? 'nearby-label' : 'travel-label'}>
          {player.zone === ownZone ? (
            <>
              <span /> Same meeting place
            </>
          ) : (
            <>
              <MapPin size={12} /> A short journey
            </>
          )}
        </span>
        <button onClick={challenge} disabled={disabled} className="match-button">
          {player.demo ? 'Practice' : 'Invite'} <Gold amount={player.suggestedStake} />
          <ArrowUpRight size={15} />
        </button>
      </div>
    </article>
  );
}

function PreferencesForm({
  profile,
  losses,
  busy,
  save,
}: {
  profile: Profile;
  losses: number;
  busy: boolean;
  save: (p: Preferences) => void;
}) {
  const [prefs, setPrefs] = useState(profile.preferences);
  const [expanded, setExpanded] = useState(false);
  const serialized = JSON.stringify(profile.preferences);
  useEffect(() => setPrefs(JSON.parse(serialized)), [serialized]);
  const dirty = JSON.stringify(prefs) !== serialized;
  const preset = prefs.maxStake <= 10 ? 'casual' : prefs.maxStake <= 50 ? 'balanced' : 'bold';
  const update = (key: keyof Preferences, value: number | boolean) =>
    setPrefs((p) => ({ ...p, [key]: value }));
  const valid =
    prefs.minStake <= prefs.preferredStake &&
    prefs.preferredStake <= prefs.maxStake &&
    prefs.sessionLimit >= prefs.minStake;
  return (
    <form
      className={`preferences-card ${expanded ? 'expanded' : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        save(prefs);
      }}
    >
      <div className="preferences-heading">
        <SlidersHorizontal size={17} />
        <h2>Your comfort zone</h2>
        <button
          type="button"
          className="mobile-pref-toggle"
          aria-expanded={expanded}
          aria-label="Toggle matchmaking preferences"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Close' : 'Edit'}
          <ChevronDown size={14} />
        </button>
      </div>
      <p>A good match respects your boundaries.</p>
      <div className="mobile-pref-summary">
        <Gold amount={`${profile.preferences.minStake}–${profile.preferences.maxStake}`} />
        <span>per match</span>
        <span>·</span>
        <span>{profile.preferences.sessionLimit}g daily limit</span>
      </div>
      <fieldset disabled={busy}>
        <label className="field-label">PLAYING STYLE</label>
        <div className="risk-selector">
          {[
            ['casual', 'Casual', 1, 10, 5],
            ['balanced', 'Balanced', 10, 50, 25],
            ['bold', 'Bold', 50, 200, 100],
          ].map(([key, label, min, max, preferred]) => (
            <button
              type="button"
              key={key}
              className={preset === key ? 'chosen' : ''}
              onClick={() =>
                setPrefs((p) => ({
                  ...p,
                  minStake: +min,
                  maxStake: +max,
                  preferredStake: +preferred,
                  sessionLimit: Math.max(p.sessionLimit, +max),
                }))
              }
            >
              {label}
            </button>
          ))}
        </div>
        <label className="field-label">
          STAKE RANGE <span>practice gold</span>
        </label>
        <div className="range-inputs">
          <label>
            <span>Min</span>
            <input
              aria-label="Minimum stake"
              type="number"
              min="1"
              max="1000"
              required
              value={prefs.minStake}
              onChange={(e) => update('minStake', +e.target.value)}
            />
            <small>g</small>
          </label>
          <span>—</span>
          <label>
            <span>Max</span>
            <input
              aria-label="Maximum stake"
              type="number"
              min="1"
              max="1000"
              required
              value={prefs.maxStake}
              onChange={(e) => update('maxStake', +e.target.value)}
            />
            <small>g</small>
          </label>
        </div>
        <div className="preferred-row">
          <label htmlFor="preferred-stake">Your sweet spot</label>
          <Gold amount={prefs.preferredStake} />
        </div>
        <input
          id="preferred-stake"
          className="stake-slider"
          aria-label="Preferred stake"
          type="range"
          min={prefs.minStake}
          max={Math.max(prefs.minStake, prefs.maxStake)}
          value={prefs.preferredStake}
          onChange={(e) => update('preferredStake', +e.target.value)}
        />
        <div className="form-divider" />
        <label className="field-label" htmlFor="loss-limit">
          DAILY LOSS LIMIT <Info size={12} />
        </label>
        <div className="limit-input">
          <input
            id="loss-limit"
            type="number"
            min="1"
            max="5000"
            required
            value={prefs.sessionLimit}
            onChange={(e) => update('sessionLimit', +e.target.value)}
          />
          <span>practice gold</span>
        </div>
        <div className="budget-track">
          <span
            style={{ width: `${Math.min(100, (losses / Math.max(1, prefs.sessionLimit)) * 100)}%` }}
          />
        </div>
        <p className="limit-caption">{losses}g used · Resets at midnight UTC</p>
        <label className="switch-row">
          <span>
            Established opponents only<small>At least 5 confirmed settlements</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={prefs.establishedOnly}
            onChange={(e) => update('establishedOnly', e.target.checked)}
          />
        </label>
        {!valid && (
          <p className="field-error">
            Your sweet spot must be inside the range. The daily limit must cover your minimum stake.
          </p>
        )}
        <button className="button primary full" disabled={!dirty || !valid || busy} type="submit">
          {busy ? (
            <LoaderCircle size={15} className="spin" />
          ) : dirty ? (
            <Settings2 size={15} />
          ) : (
            <Check size={15} />
          )}{' '}
          {dirty ? 'Apply preferences' : 'Preferences saved'}
        </button>
      </fieldset>
      <div className="preferences-footer">
        <MapPin size={12} />
        {profile.region} · {profile.ruleset} · {profile.faction}
      </div>
    </form>
  );
}

function MatchRoom({
  match,
  me,
  busy,
  action,
  find,
  exportTicket,
  dispute,
  receipt,
}: {
  match: Match | null;
  me: Profile;
  busy: boolean;
  action: (a: string) => void;
  find: () => void;
  exportTicket: () => void;
  dispute: () => void;
  receipt: () => void;
}) {
  if (!match)
    return (
      <>
        <div className="page-heading">
          <div>
            <div className="eyebrow">ONE TABLE. TWO PLAYERS.</div>
            <h1>
              Your match room<span>.</span>
            </h1>
            <p>Good company is just a match away.</p>
          </div>
        </div>
        <div className="empty-state room-empty">
          <Swords size={36} />
          <h2>There’s a seat with your name on it.</h2>
          <p>Choose a practice partner or invite someone from the community queue.</p>
          <button className="button primary" onClick={find}>
            Find a match <ArrowRight size={16} />
          </button>
        </div>
      </>
    );
  const opponent = match.players.find((p) => p.id !== me.id)!;
  const yourTurn = match.turn === me.id;
  const won = !!match.loserId && match.loserId !== me.id;
  const finished = ['settlement', 'settled', 'disputed', 'cancelled'].includes(match.phase);
  const max = match.rolls.at(-1)?.value ?? match.start;
  const status = {
    invited: 'Invitation pending',
    ready: 'Agree & get ready',
    playing: yourTurn ? 'Your turn to roll' : `${opponent.name}’s turn`,
    settlement: 'Confirm practice settlement',
    settled: 'A good game, on the record',
    disputed: 'Issue recorded',
    cancelled: 'Match cancelled',
  }[match.phase];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            {match.demo ? 'SAMPLE OPPONENT · PRACTICE MATCH' : 'COMMUNITY · PRACTICE MATCH'}
          </div>
          <h1>
            {finished && match.phase === 'settled' ? 'Well played' : 'One last roll'}
            <span>.</span>
          </h1>
          <p>{status}</p>
        </div>
        <button className="button secondary small" onClick={exportTicket} disabled={busy}>
          <Copy size={15} /> Export terms
        </button>
      </div>
      <div className="room-layout">
        <section className="match-table">
          <div className="match-meta">
            <span>
              <i className="status-dot" /> {match.phase.toUpperCase()}
            </span>
            <span>#{match.id.slice(0, 8)}</span>
          </div>
          <div className="duel-players">
            {[match.players.find((p) => p.id === me.id)!, opponent].map((player, i) => (
              <div
                className={`duel-player ${match.turn === player.id && match.phase === 'playing' ? 'current' : ''}`}
                key={player.id}
              >
                <Avatar player={player} large />
                <h3>{player.id === me.id ? 'You' : player.name}</h3>
                <p>
                  {player.className} ·{' '}
                  {player.id === me.id
                    ? player.name
                    : match.demo
                      ? 'Sample partner'
                      : 'Community player'}
                </p>
                {i === 0 && <span className="versus">VS</span>}
              </div>
            ))}
          </div>
          <div className="roll-stage">
            <span className="eyebrow">
              {match.loserId
                ? won
                  ? 'YOU WON THIS PRACTICE MATCH'
                  : 'FORTUNE FAVORED YOUR OPPONENT'
                : match.phase === 'playing'
                  ? 'CURRENT ROLL RANGE'
                  : 'STARTING ROLL'}
            </span>
            <div className={`roll-number ${match.loserId ? 'result' : ''}`}>
              {match.loserId ? (
                <Gold amount={match.stake} />
              ) : (
                <>
                  <small>1 —</small> {number(max)}
                </>
              )}
            </div>
            <p>
              {match.loserId
                ? `${match.players.find((p) => p.id === match.loserId)!.name} rolled 1. No real gold is owed.`
                : 'The first player to roll 1 loses.'}
            </p>
            {match.phase === 'invited' &&
              (match.players[1].id === me.id ? (
                <button
                  className="button primary roll-button"
                  disabled={busy}
                  onClick={() => action('accept')}
                >
                  Accept invitation <Check size={17} />
                </button>
              ) : (
                <div className="waiting-label">
                  <LoaderCircle size={17} className="spin" /> Waiting for your opponent to accept
                </div>
              ))}
            {match.phase === 'ready' && (
              <>
                <button
                  className="button primary roll-button"
                  disabled={busy || match.ready.includes(me.id)}
                  onClick={() => action('ready')}
                >
                  {match.ready.includes(me.id) ? (
                    <>
                      <LoaderCircle className="spin" size={17} /> Waiting for your opponent
                    </>
                  ) : (
                    <>
                      <CheckCheck size={18} /> Agree & start practice
                    </>
                  )}
                </button>
                <p className="action-caption">
                  You accept the practice terms shown alongside this table.
                </p>
              </>
            )}
            {match.phase === 'playing' && (
              <button
                className="button primary roll-button"
                disabled={busy || !yourTurn}
                onClick={() => action('roll')}
              >
                {busy ? <LoaderCircle className="spin" size={18} /> : <Mark size={21} />}{' '}
                {yourTurn ? `Roll 1–${number(max)}` : 'Waiting for opponent'}
              </button>
            )}
            {match.phase === 'settlement' && (
              <>
                <button
                  className="button primary roll-button"
                  disabled={busy || match.confirmations.includes(me.id)}
                  onClick={() => action('confirm')}
                >
                  {match.confirmations.includes(me.id)
                    ? 'Waiting for opponent confirmation'
                    : 'Confirm practice settlement'}
                  <Check size={17} />
                </button>
                <p className="action-caption">
                  This records a practice acknowledgement. No payment is collected.
                </p>
              </>
            )}
            {match.phase === 'settled' && (
              <>
                <span className="settled-stamp">
                  <ShieldCheck size={19} /> Both sides confirmed
                </span>
                <button className="button secondary" onClick={find}>
                  Find another match <ArrowRight size={16} />
                </button>
              </>
            )}
            {['cancelled', 'disputed'].includes(match.phase) && (
              <>
                <p>{match.disputeReason}</p>
                <button className="button secondary" onClick={find}>
                  Back to matchmaking <ArrowRight size={16} />
                </button>
              </>
            )}
          </div>
          <div className="roll-log">
            <div className="section-heading">
              <h3>The roll record</h3>
              <span>{match.rolls.length} rolls</span>
            </div>
            {!match.rolls.length ? (
              <p className="log-empty">The story starts with your first roll.</p>
            ) : (
              <ol>
                {match.rolls.map((roll, i) => (
                  <li key={i} className={roll.value === 1 ? 'losing-roll' : ''}>
                    <span className="roll-index">{String(i + 1).padStart(2, '0')}</span>
                    <span>{roll.playerId === me.id ? 'You' : opponent.name}</span>
                    <small>1–{number(roll.max)}</small>
                    <strong>{number(roll.value)}</strong>
                    {roll.value === 1 && <Flag size={14} />}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
        <aside className="room-aside">
          <div className="terms-card">
            <div className="preferences-heading">
              <ScrollText size={18} />
              <h2>The agreement</h2>
            </div>
            <dl>
              <div>
                <dt>Stake per player</dt>
                <dd>
                  <Gold amount={match.stake} />
                  <small>practice only</small>
                </dd>
              </div>
              <div>
                <dt>Starting roll</dt>
                <dd>1–{number(match.start)}</dd>
              </div>
              <div>
                <dt>First to roll</dt>
                <dd>{match.firstPlayerId === me.id ? 'You' : opponent.name}</dd>
              </div>
              <div>
                <dt>Meeting place</dt>
                <dd>
                  {match.zone}
                  <small>Selected, not live location</small>
                </dd>
              </div>
              <div>
                <dt>Game pool</dt>
                <dd>
                  {me.region} · {me.ruleset}
                  <small>{me.faction} · Layer unknown</small>
                </dd>
              </div>
            </dl>
            <p className="terms-note">
              First player is chosen randomly. Rolls use server-generated randomness. A disconnect
              leaves the match available to resume; either player can record an issue.
            </p>
            {['invited', 'ready'].includes(match.phase) && (
              <button
                className="button secondary full"
                onClick={() => action('cancel')}
                disabled={busy}
              >
                Cancel match
              </button>
            )}
            {['playing', 'settlement'].includes(match.phase) && (
              <button className="text-button" onClick={dispute}>
                <Flag size={14} /> Record an issue
              </button>
            )}
          </div>
          <div className="receipt-card">
            <ShieldCheck size={21} />
            <h3>Keep the receipt.</h3>
            <p>
              {match.receipt
                ? 'An addon receipt is attached as client-supplied evidence. It has not been verified by Blizzard.'
                : 'Rollkeeper receipts can be attached as supplementary, client-supplied evidence.'}
            </p>
            <button className="text-button" onClick={receipt}>
              {match.receipt ? 'Replace receipt' : 'Attach addon receipt'} <Plus size={14} />
            </button>
          </div>
          <div className="trust-note">
            <Info size={19} />
            <p>
              {match.demo
                ? 'Your opponent is simulated. Its rolls and settlement confirmation are automatic.'
                : 'Character ownership is unverified. This match takes place on the website, not inside WoW.'}
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function HistoryPage({
  matches,
  me,
  open,
  find,
}: {
  matches: Match[];
  me: SessionData;
  open: (m: Match) => void;
  find: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVERY ROLL HAS A STORY.</div>
          <h1>
            Your record<span>.</span>
          </h1>
          <p>A little history makes the next introduction easier.</p>
        </div>
        <button className="button secondary small" onClick={find}>
          Find a match <ArrowRight size={15} />
        </button>
      </div>
      <div className="history-stats">
        <div>
          <span>COMPLETED PRACTICE GAMES</span>
          <strong>{me.stats.matches}</strong>
        </div>
        <div>
          <span>CONFIRMED SETTLEMENTS</span>
          <strong>
            {me.stats.settlements}
            <ShieldCheck size={22} />
          </strong>
        </div>
        <div>
          <span>TODAY’S PRACTICE LOSSES</span>
          <strong>
            <Gold amount={me.losses} />
            <small> / {me.profile.preferences.sessionLimit}g</small>
          </strong>
        </div>
      </div>
      <section className="history-panel">
        <div className="section-heading">
          <h2>Match history</h2>
          <span>Saved to your guest session</span>
        </div>
        <p className="list-note">
          Sample games are labeled. They never count toward community-player reputation. Clearing
          cookies loses access to this guest profile.
        </p>
        {matches.length ? (
          <div className="history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>OPPONENT</th>
                  <th>STAKE</th>
                  <th>RESULT</th>
                  <th>STATUS</th>
                  <th>PLAYED</th>
                  <th>
                    <span className="sr-only">Open match</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => {
                  const opponent = match.players.find((p) => p.id !== me.profile.id)!;
                  const won = match.loserId && match.loserId !== me.profile.id;
                  return (
                    <tr key={match.id}>
                      <td>
                        <div className="history-player">
                          <Avatar player={opponent} />
                          <div>
                            {opponent.name}
                            <small>{match.demo ? 'Sample partner' : 'Community player'}</small>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Gold amount={match.stake} />
                      </td>
                      <td>
                        <span className={match.loserId ? (won ? 'result-win' : 'result-loss') : ''}>
                          {match.loserId ? (
                            won ? (
                              <>
                                <ArrowDownLeft size={14} /> Won
                              </>
                            ) : (
                              <>
                                <ArrowUpRight size={14} /> Lost
                              </>
                            )
                          ) : (
                            '—'
                          )}
                        </span>
                      </td>
                      <td>
                        <span className={`phase-tag ${match.phase}`}>{match.phase}</span>
                      </td>
                      <td className="date-cell">{date(match.createdAt)}</td>
                      <td>
                        <button
                          className="icon-button"
                          onClick={() => open(match)}
                          aria-label={`View match with ${opponent.name}`}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <History size={30} />
            <h3>Your first chapter is waiting.</h3>
            <p>Finish a practice match to begin your record.</p>
            <button className="button primary" onClick={find}>
              Find your first match <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function AddonPage({ guide }: { guide: () => void }) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE ORDER. A LOT LESS GUESSWORK.</div>
          <h1>
            Meet Rollkeeper<span>.</span>
          </h1>
          <p>Your companion for agreed terms, observed rolls, and honest receipts.</p>
        </div>
        <span className="version-badge">v0.1.0 · Experimental</span>
      </div>
      <section className="addon-hero">
        <div>
          <span className="hero-tag">THE IN-GAME COMPANION</span>
          <h2>
            Keep the game friendly.
            <br />
            Keep the terms clear.
          </h2>
          <p>
            Bring a practice ticket into WoW, follow the roll sequence, and export a receipt. Every
            action stays in the player’s hands.
          </p>
          <a className="button primary" href="/downloads/Rollkeeper.zip" download>
            <Download size={17} /> Download Rollkeeper
          </a>
          <a
            className="text-button"
            href="https://github.com/ForkFiesta/deathroll_matchmaker/tree/main/addon/Rollkeeper"
            target="_blank"
            rel="noreferrer"
          >
            View source <ArrowUpRight size={15} />
          </a>
        </div>
        <div className="addon-preview">
          <div className="addon-preview-title">
            <Mark size={22} />
            <strong>ROLLKEEPER</strong>
            <span>PRACTICE</span>
          </div>
          <div className="preview-ticket">
            <span>MATCH TERMS</span>
            <strong>
              Aldric Ashford <small>vs.</small> Wanderer
            </strong>
            <p>25g practice stake · Start at 1,000</p>
          </div>
          <div className="preview-roll">
            <span>NEXT ROLL</span>
            <strong>1–148</strong>
          </div>
          <div className="preview-command">
            /roll 148 <Copy size={13} />
          </div>
          <small>Illustrative addon preview</small>
        </div>
      </section>
      <div className="addon-steps">
        {[
          [
            '01',
            'Install the folder',
            'Unzip Rollkeeper into your WoW Interface/AddOns folder. Check the client build instructions in the included README.',
          ],
          [
            '02',
            'Bring your agreement',
            'Export terms from a match room. Type /rollkeeper in-game, paste the complete ticket, and click Import.',
          ],
          [
            '03',
            'Play, then keep a record',
            'Use WoW’s own /roll manually. The addon observes available system messages and lets you export a practice receipt.',
          ],
        ].map(([i, title, text]) => (
          <div key={i}>
            <span>{i}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="addon-notices">
        <div className="notice">
          <Info size={22} />
          <div>
            <h3>Forever compatibility is still to be verified.</h3>
            <p>
              The package uses conventional WoW UI APIs. Its interface version must be checked
              against the installed Forever build, and localized roll parsing needs client testing.
              It does not detect layers, verify trades, move characters, send invitations, or
              transfer gold.
            </p>
          </div>
        </div>
        <div className="notice">
          <ShieldCheck size={22} />
          <div>
            <h3>Visible source. Free to use.</h3>
            <p>
              No in-game advertising, paid features, automatic rolls, or automatic trade acceptance.
              Availability of an API does not constitute Blizzard approval.
            </p>
            <button className="text-button" onClick={guide}>
              Read the ground rules <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileForm({
  profile,
  busy,
  locked,
  save,
}: {
  profile: Profile;
  busy: boolean;
  locked: boolean;
  save: (p: Omit<Profile, 'id'>) => void;
}) {
  const [form, setForm] = useState(profile);
  const update = (key: keyof Profile, value: string) => setForm((p) => ({ ...p, [key]: value }));
  return (
    <form
      className="profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        const { id: _id, ...body } = form;
        save(body);
      }}
    >
      <p className="modal-description">
        Your practice identity is self-reported. Battle.net character verification and live location
        are not connected.
      </p>
      {locked && (
        <div className="notice">
          Finish or cancel your current match before changing your character.
        </div>
      )}
      <fieldset disabled={busy || locked}>
        <label>
          Character name
          <input
            value={form.name}
            minLength={3}
            maxLength={40}
            required
            onChange={(e) => update('name', e.target.value)}
            autoComplete="off"
          />
        </label>
        <div className="form-grid">
          {(
            [
              ['className', 'Class', CLASSES],
              ['faction', 'Faction', FACTIONS],
              ['region', 'Region', REGIONS],
              ['ruleset', 'Ruleset', RULESETS],
              ['zone', 'Preferred meeting place', ZONES],
            ] as const
          ).map(([key, label, values]) => (
            <label key={key}>
              {label}
              <select value={form[key]} onChange={(e) => update(key, e.target.value)}>
                {values.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <p className="list-note">
          Saving a profile removes your old queue listing. Rejoin when you’re ready.
        </p>
        <button className="button primary full" type="submit">
          Save character <Check size={16} />
        </button>
      </fieldset>
    </form>
  );
}
function TextSubmit({
  label,
  placeholder,
  button,
  busy,
  minLength,
  maxLength,
  submit,
}: {
  label: string;
  placeholder: string;
  button: string;
  busy: boolean;
  minLength: number;
  maxLength: number;
  submit: (value: string) => void;
}) {
  const [value, setValue] = useState('');
  function handle(e: FormEvent) {
    e.preventDefault();
    submit(value);
  }
  return (
    <form onSubmit={handle} className="text-submit">
      <label>
        {label}
        <textarea
          required
          minLength={minLength}
          maxLength={maxLength}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </label>
      <button className="button primary full" disabled={busy || value.trim().length < minLength}>
        {button}
      </button>
    </form>
  );
}
