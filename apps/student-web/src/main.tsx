import { StrictMode, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type User = {
  id: string;
  username: string;
  role: 'student' | 'teacher' | 'admin';
  tutorialCompleted: boolean;
};

type ScenarioSummary = {
  id: string;
  title: string;
  status: 'published';
  createdAt: string;
  publishedAt: string | null;
  hasResponse: boolean;
  responseCount: number;
};

type Perspective = {
  id: string;
  label: string;
  text: string;
};

type ReflectionQuestion = {
  id: string;
  text: string;
};

type ScenarioDetail = ScenarioSummary & {
  scenarioText: string;
  context: string;
  videoUrl: string;
  uploadedVideoUrl: string;
  perspectives: Perspective[];
  reflectionQuestions: ReflectionQuestion[];
  answers: Record<string, string>;
  classification: 'joke' | 'bullying' | null;
  reasoning: string;
  updatedAt: string;
};

type ExpertQuestion = {
  id: string;
  question: string;
  answer: string | null;
  scenarioId: string | null;
  scenarioTitle: string | null;
  answeredByUsername: string | null;
  createdAt: string;
  answeredAt: string | null;
};

type ApiFailure = {
  message?: string | string[];
};

class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const API_BASE = import.meta.env.DEV
  ? '/api'
  : import.meta.env.VITE_API_BASE_URL || '/api';
const LOGIN_APP_URL =
  import.meta.env.VITE_LOGIN_APP_URL ||
  (import.meta.env.DEV ? 'http://localhost:5170' : 'http://localhost:8080');
const APP_URLS: Record<User['role'], string> = {
  student: import.meta.env.VITE_STUDENT_APP_URL,
  teacher: import.meta.env.VITE_TEACHER_APP_URL,
  admin: import.meta.env.VITE_ADMIN_APP_URL,
};

function getLoginAppUrl(): string {
  const appUrl = new URL(LOGIN_APP_URL, window.location.origin);
  if (['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname)) {
    appUrl.hostname = window.location.hostname;
  }
  return appUrl.origin;
}

function isLoginApp(): boolean {
  return window.location.origin === getLoginAppUrl();
}

function getAppUrl(role: User['role']): string {
  const configuredUrl = APP_URLS[role];
  const appUrl = new URL(configuredUrl || window.location.origin, window.location.origin);
  if (['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname)) {
    appUrl.hostname = window.location.hostname;
  }
  if (!configuredUrl) {
    appUrl.port = String(
      role === 'student' ? (import.meta.env.DEV ? 5173 : 8081)
        : role === 'teacher' ? (import.meta.env.DEV ? 5174 : 8082)
          : (import.meta.env.DEV ? 5175 : 8083),
    );
  }
  return appUrl.origin;
}

async function request<T>(path: string, body?: object, method?: 'POST' | 'PATCH'): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: method ?? (body ? 'POST' : 'GET'),
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as T & ApiFailure;
  if (!response.ok) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(' ')
      : payload.message;
    lastApiError = {
      status: response.status,
      message: message || `İstek başarısız oldu (${response.status}).`,
      at: new Date().toISOString(),
    };
    throw new ApiRequestError(
      message || `İstek başarısız oldu (${response.status}).`,
      response.status,
    );
  }
  return payload;
}

// Rapor penceresinin otomatik ekleyeceği son API hatası (10 dakika içindekiler).
let lastApiError: { status: number; message: string; at: string } | null = null;

function StudentApp() {
  const [user, setUser] = useState<User | null>(null);
  const [activePage, setActivePage] = useState<'scenarios' | 'expert'>('scenarios');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loginState, setLoginState] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [activeScenario, setActiveScenario] = useState<ScenarioDetail | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [classification, setClassification] = useState<'joke' | 'bullying' | ''>('');
  const [reasoning, setReasoning] = useState('');
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<ExpertQuestion[]>([]);
  const [questionText, setQuestionText] = useState('');
  const [questionScenarioId, setQuestionScenarioId] = useState('');
  const [questionSaving, setQuestionSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [seenScenarioIds, setSeenScenarioIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('sakanin_seen_scenarios');
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  });
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupUsername, setSetupUsername] = useState('admin');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordConfirm, setSetupPasswordConfirm] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportDescription, setReportDescription] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [reportError, setReportError] = useState('');

  useEffect(() => {
    const viewport = window.matchMedia('(max-width: 760px)');
    const updateDevice = () => {
      document.documentElement.dataset.deviceType = viewport.matches ? 'mobile' : 'desktop';
    };
    updateDevice();
    viewport.addEventListener('change', updateDevice);
    return () => viewport.removeEventListener('change', updateDevice);
  }, []);

  useEffect(() => {
    if (window.location.pathname === '/register') {
      window.history.replaceState(null, '', '/login');
    }
  }, []);

  useEffect(() => {
    const roles: User['role'][] = ['student', 'teacher', 'admin'];
    void (async () => {
      try {
        const status = await request<{ needsSetup: boolean }>('/auth/setup-status');
        if (status.needsSetup) {
          if (!isLoginApp()) {
            window.location.replace(`${getLoginAppUrl()}/setup`);
            return;
          }
          setNeedsSetup(true);
          if (window.location.pathname !== '/setup') {
            window.history.replaceState(null, '', '/setup');
          }
          return;
        }
        const users = await Promise.all(
          roles.map(async (role) => {
            try {
              return await request<User>(`/auth/me?role=${role}`);
            } catch (cause: unknown) {
              if (isUnauthorized(cause)) return null;
              throw cause;
            }
          }),
        );
        const currentUser = users.find((candidate) => candidate !== null);
        if (!currentUser) {
          if (!isLoginApp()) {
            window.location.replace(`${getLoginAppUrl()}/login`);
          }
          return;
        }
        if (currentUser.role === 'student') {
          if (isLoginApp()) {
            window.location.replace(getAppUrl('student'));
            return;
          }
          setUser(currentUser);
          if (!currentUser.tutorialCompleted) {
            setTutorialStep(0);
            setSidebarOpen(window.matchMedia('(max-width: 760px)').matches);
          }
        } else {
          window.location.replace(getAppUrl(currentUser.role));
        }
      } catch (cause: unknown) {
        setError(errorMessage(cause));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!showSaveSuccess) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowSaveSuccess(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [showSaveSuccess]);

  useEffect(() => {
    if (!user) return;
    void request<ScenarioSummary[]>('/scenarios')
      .then(setScenarios)
      .catch((cause: unknown) => setError(errorMessage(cause)));
    void refreshQuestions();
  }, [user]);

  async function refreshQuestions() {
    try {
      setQuestions(await request<ExpertQuestion[]>('/expert-questions/mine'));
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  }

  async function submitExpertQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuestionSaving(true);
    setError('');
    setMessage('');
    try {
      await request<ExpertQuestion>('/expert-questions', {
        question: questionText,
        ...(questionScenarioId ? { scenarioId: questionScenarioId } : {}),
      });
      setQuestionText('');
      setQuestionScenarioId('');
      setMessage('Sorun uzmana iletildi. Yanıtı yalnızca sen görebilirsin.');
      await refreshQuestions();
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setQuestionSaving(false);
    }
  }

  async function handleInitialSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (setupPassword !== setupPasswordConfirm) {
      setError('Girdiğiniz parolalar birbiriyle uyuşmuyor.');
      return;
    }
    setSetupLoading(true);
    try {
      const result = await request<{ user: User }>('/auth/setup', {
        username: setupUsername,
        password: setupPassword,
      });
      setMessage('🎉 Yönetici hesabı oluşturuldu! Yönetici paneline yönlendiriliyorsunuz…');
      setTimeout(() => {
        window.location.assign(getAppUrl(result.user.role));
      }, 1000);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
      setSetupLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoginState('submitting');
    try {
      const result = await request<{ user: User }>('/auth/login', {
        username,
        password,
      });
      const destination = getAppUrl(result.user.role);
      setLoginState('success');
      window.setTimeout(() => window.location.assign(destination), 1200);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
      setLoginState('idle');
    }
  }

  async function openScenario(id: string) {
    setError('');
    setMessage('');
    setActiveScenario(null);
    setScenarioLoading(true);
    window.scrollTo({ top: 0 });
    if (!seenScenarioIds.includes(id)) {
      const next = [...seenScenarioIds, id];
      setSeenScenarioIds(next);
      try {
        localStorage.setItem('sakanin_seen_scenarios', JSON.stringify(next));
      } catch {
        // localStorage hatasını sessizce yut
      }
    }
    try {
      const scenario = await request<ScenarioDetail>(`/scenarios/${id}`);
      setActiveScenario(scenario);
      setAnswers(scenario.answers);
      setClassification(scenario.classification ?? '');
      setReasoning(scenario.reasoning);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setScenarioLoading(false);
    }
  }

  async function saveAnswers(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeScenario) return;
    setError('');
    setMessage('');
    const filledAnswers = Object.fromEntries(
      Object.entries(answers).filter(([, answer]) => answer.trim().length > 0),
    );
    if (!classification || reasoning.trim().length < 3) {
      setError('Şaka/zorbalık seçimini ve en az 3 karakterlik gerekçeni ekle.');
      return;
    }
    const selectedClassification = classification;

    setSaving(true);
    try {
      await request(`/scenarios/${activeScenario.id}/responses`, {
        answers: filledAnswers,
        classification: selectedClassification,
        reasoning,
      });
      setActiveScenario({
        ...activeScenario,
        answers: { ...answers },
        classification: selectedClassification,
        reasoning,
      });
      setScenarios((current) =>
        current.map((scenario) =>
          scenario.id === activeScenario.id
            ? {
                ...scenario,
                hasResponse: Object.keys(filledAnswers).length > 0,
                responseCount: scenario.hasResponse
                  ? scenario.responseCount
                  : scenario.responseCount + (Object.keys(filledAnswers).length > 0 ? 1 : 0),
              }
            : scenario,
        ),
      );
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4500);
      setShowSaveSuccess(true);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    setError('');
    try {
      await request('/auth/logout?role=student', {});
      window.location.assign(getLoginAppUrl());
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  }

  async function finishTutorial() {
    try {
      const updated = await request<User>('/auth/tutorial-complete', {}, 'PATCH');
      setUser(updated);
      setTutorialStep(null);
    } catch (cause: unknown) {
      setError(errorMessage(cause));
    }
  }

  function currentScreenLabel(): string {
    if (activePage === 'expert') return 'Uzmana Sor';
    if (activeScenario) return `Senaryo: ${activeScenario.title}`;
    return 'Senaryo listesi';
  }

  async function submitProblemReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReportSending(true);
    setReportError('');
    try {
      await request('/problem-reports', {
        description: reportDescription,
        screen: currentScreenLabel(),
        context: problemReportContext(),
      });
      setReportOpen(false);
      setReportDescription('');
      setMessage('Sorun bildirimin yöneticiye iletildi. Teşekkürler!');
    } catch (cause: unknown) {
      setReportError(errorMessage(cause));
    } finally {
      setReportSending(false);
    }
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <div className="spinner-loader" aria-hidden="true" />
        <p className="eyebrow">Şakanın Sınırında</p>
        <p role="status" className="loading-text">Oturum kontrol ediliyor…</p>
      </main>
    );
  }

  if (needsSetup) {
    return (
      <main className="setup-wizard-screen">
        <div className="ambient-background" aria-hidden="true">
          <div className="ambient-orb orb-1" />
          <div className="ambient-orb orb-2" />
        </div>
        <div className="setup-wizard-card">
          <div className="setup-wizard-header">
            <div className="setup-badge-icon" aria-hidden="true">
              <span>⚙️</span>
            </div>
            <p className="eyebrow">İLK KURULUM SİHİRBAZI</p>
            <h1>Yönetici Hesabını Oluşturun</h1>
            <p className="setup-subtitle">
              Sistemde henüz bir yönetici hesabı bulunmuyor. Platformu yönetmek ve senaryolar eklemek için
              ilk yönetici hesabınızı şimdi belirleyin.
            </p>
          </div>

          <form className="setup-wizard-form" onSubmit={(e) => void handleInitialSetup(e)}>
            <label htmlFor="setup-username">Yönetici Kullanıcı Adı</label>
            <input
              autoComplete="username"
              id="setup-username"
              maxLength={32}
              minLength={3}
              onChange={(e) => setSetupUsername(e.target.value)}
              required
              type="text"
              value={setupUsername}
            />

            <label htmlFor="setup-password">Yönetici Parolası</label>
            <input
              autoComplete="new-password"
              id="setup-password"
              maxLength={128}
              minLength={1}
              onChange={(e) => setSetupPassword(e.target.value)}
              placeholder="İstediğiniz parolayı belirleyin"
              required
              type="password"
              value={setupPassword}
            />

            <label htmlFor="setup-password-confirm">Parola Tekrarı</label>
            <input
              autoComplete="new-password"
              id="setup-password-confirm"
              maxLength={128}
              minLength={1}
              onChange={(e) => setSetupPasswordConfirm(e.target.value)}
              placeholder="Parolanızı tekrar girin"
              required
              type="password"
              value={setupPasswordConfirm}
            />

            <button className="primary-button setup-submit-btn" disabled={setupLoading} type="submit">
              {setupLoading ? 'Oluşturuluyor…' : 'Yönetici Hesabını Oluştur ve Başla 🚀'}
            </button>
          </form>

          {message && <p className="success" role="status">{message}</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
      </main>
    );
  }

  const completedCount = scenarios.filter((s) => s.hasResponse).length;
  const totalCount = scenarios.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  function isScenarioNew(scenario: ScenarioSummary): boolean {
    if (scenario.hasResponse) return false;
    if (!seenScenarioIds.includes(scenario.id)) return true;
    if (scenario.publishedAt) {
      const diffHours = (Date.now() - new Date(scenario.publishedAt).getTime()) / (1000 * 60 * 60);
      return diffHours < 48;
    }
    return false;
  }

  function findNextPendingScenario(): ScenarioSummary | null {
    if (!activeScenario || scenarios.length === 0) return null;
    const isPending = (scenario: ScenarioSummary) =>
      scenario.id !== activeScenario.id
      && (!scenario.hasResponse || !seenScenarioIds.includes(scenario.id));
    const currentIndex = scenarios.findIndex((scenario) => scenario.id === activeScenario.id);
    for (let offset = 1; offset <= scenarios.length; offset += 1) {
      const candidate = scenarios[(currentIndex + offset) % scenarios.length];
      if (candidate && isPending(candidate)) return candidate;
    }
    return null;
  }

  const nextPendingScenario = findNextPendingScenario();

  if (user) {
    return (
      <main className={`student-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
        {showConfetti && <ConfettiEffect />}
        {sidebarOpen && <button className="sidebar-backdrop" aria-label="Menüyü kapat" onClick={() => setSidebarOpen(false)} type="button" />}
        <aside className="student-sidebar">
          <div className="sidebar-brand">
            <img className="sidebar-brand-mark" src="/icon.png" alt="" aria-hidden="true" />
            <span>Şakanın<br />Sınırında</span>
          </div>
          <p className="sidebar-section-label">MENÜ</p>
          <nav className="sidebar-nav" aria-label="Öğrenci menüsü">
            <button
              aria-current={activePage === 'scenarios' ? 'page' : undefined}
              className={activePage === 'scenarios' ? 'sidebar-link active' : 'sidebar-link'}
              id="nav-scenarios"
              onClick={() => { setActivePage('scenarios'); setError(''); setMessage(''); setSidebarOpen(false); }}
              type="button"
            >
              <span aria-hidden="true">▤</span> Senaryolar
            </button>
            <button
              aria-current={activePage === 'expert' ? 'page' : undefined}
              className={activePage === 'expert' ? 'sidebar-link active' : 'sidebar-link'}
              id="nav-expert"
              onClick={() => { setActivePage('expert'); setActiveScenario(null); setError(''); setMessage(''); setSidebarOpen(false); }}
              type="button"
            >
              <span aria-hidden="true">✉</span> Uzmana Sor
              {questions.some((question) => question.answer) && (
                <span className="sidebar-badge" aria-label="Yanıt geldi">•</span>
              )}
            </button>
          </nav>
          <div className="sidebar-user">
            <span className="sidebar-avatar">{user.username.slice(0, 1).toUpperCase()}</span>
            <span className="sidebar-username">{user.username}</span>
            <button className="sidebar-logout" id="sidebar-logout" onClick={() => void logout()} type="button">
              Çıkış
            </button>
          </div>
        </aside>

        <div className="student-workspace">
          <header className="student-header">
            <div className="header-title-group">
              <button
                aria-expanded={sidebarOpen}
                aria-label={sidebarOpen ? 'Menüyü kapat' : 'Menüyü aç'}
                className="mobile-menu-button"
                onClick={() => setSidebarOpen((open) => !open)}
                type="button"
              >
                ☰
              </button>
              <div className="header-greeting-wrap">
                <h1>
                  Merhaba, {user.username} <span className="wave-emoji" aria-hidden="true">👋</span>
                </h1>
                <p className="header-subtitle">Düşüncelerini ve bakış açılarını keşfetmeye hazır mısın?</p>
              </div>
            </div>
          </header>

          {activePage === 'expert' ? (
            <div className="expert-question-layout">
              <section className="expert-panel">
                <p className="eyebrow">GÜVENLİ VE ÖZEL</p>
                <h2>Aklına takılanı sor</h2>
                <p className="muted">
                  Sorunu yalnızca sen, uzmanlar ve yöneticiler görebilir. Uzmanın yanıtı bu alanda görünür.
                </p>
                <form className="expert-question-form" onSubmit={(event) => void submitExpertQuestion(event)}>
                  <label htmlFor="question-scenario">İlgili senaryo (isteğe bağlı)</label>
                  <select
                    id="question-scenario"
                    onChange={(event) => setQuestionScenarioId(event.target.value)}
                    value={questionScenarioId}
                  >
                    <option value="">Genel bir soru</option>
                    {scenarios.map((scenario) => (
                      <option key={scenario.id} value={scenario.id}>{scenario.title}</option>
                    ))}
                  </select>
                  <label htmlFor="expert-question">Sorun</label>
                  <textarea
                    id="expert-question"
                    maxLength={4000}
                    minLength={3}
                    onChange={(event) => setQuestionText(event.target.value)}
                    placeholder="Merak ettiğin konuyu burada paylaşabilirsin…"
                    required
                    rows={5}
                    value={questionText}
                  />
                  <div className="question-form-footer">
                    <span>{questionText.length}/4000</span>
                    <button className="primary-button" disabled={questionSaving} type="submit">
                      {questionSaving ? 'Gönderiliyor…' : 'Uzmanla paylaş'}
                    </button>
                  </div>
                </form>
              </section>
              <section className="expert-panel">
                <div className="expert-panel-heading">
                  <div>
                    <p className="eyebrow">ÖZEL MESAJLARIN</p>
                    <h2>Sorularım ve yanıtlar</h2>
                  </div>
                  <button className="secondary-button" onClick={() => void refreshQuestions()} type="button">Yenile</button>
                </div>
                {questions.length === 0 ? (
                  <p className="empty-state">Henüz soru göndermedin.</p>
                ) : (
                  <ul className="expert-question-list">
                    {questions.map((question) => (
                      <li className="expert-question-card" key={question.id}>
                        <div className="question-card-meta">
                          <span>{question.scenarioTitle ?? 'Genel soru'}</span>
                          <time dateTime={question.createdAt}>{new Date(question.createdAt).toLocaleDateString('tr-TR')}</time>
                        </div>
                        <h3>{question.question}</h3>
                        {question.answer ? (
                          <div className="expert-answer">
                            <span>Uzman yanıtı · {question.answeredByUsername}</span>
                            <p>{question.answer}</p>
                          </div>
                        ) : (
                          <p className="question-pending">Uzman yanıtı bekleniyor</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          ) : scenarioLoading ? (
            <p role="status">Senaryo yükleniyor…</p>
          ) : activeScenario ? (
            <>
              <button className="text-button back-button" onClick={() => setActiveScenario(null)} type="button">
                ← Senaryolara dön
              </button>
              <div className="scenario-detail-heading">
                <span className="scenario-status-pill">YAYINDA</span>
                <button
                  className="secondary-button ask-expert-button"
                  onClick={() => {
                    setQuestionScenarioId(activeScenario.id);
                    setActivePage('expert');
                    setMessage('');
                    setError('');
                  }}
                  type="button"
                >
                  ✉ Uzmana Sor
                </button>
              </div>
              <section className="content-section">
                <h2>Senaryo</h2>
                <p>{activeScenario.scenarioText}</p>
                {(activeScenario.uploadedVideoUrl || activeScenario.videoUrl) && (
                  <ScenarioMedia
                    className="scenario-video"
                    title={activeScenario.title}
                    url={activeScenario.uploadedVideoUrl || activeScenario.videoUrl}
                  />
                )}
              </section>
              <section className="content-section">
                <h2>Bağlam</h2>
                <p>{activeScenario.context}</p>
              </section>
              <section className="content-section">
                <div className="section-header-badge">
                  <span className="badge-icon" aria-hidden="true">👥</span>
                  <h2>Farklı bakış açıları</h2>
                </div>
                <div className="perspective-grid">
                  {activeScenario.perspectives.map((perspective, idx) => {
                    const avatars = ['👀', '🎯', '🗣️', '💭', '🤝'];
                    const avatar = avatars[idx % avatars.length];
                    return (
                      <article className="perspective-card" key={perspective.id}>
                        <div className="perspective-card-top">
                          <span className="perspective-avatar" aria-hidden="true">{avatar}</span>
                          <h3>{perspective.label}</h3>
                        </div>
                        <p>{perspective.text}</p>
                      </article>
                    );
                  })}
                </div>
              </section>
              <section className="content-section reflection-section">
                <div className="section-header-badge">
                  <span className="badge-icon" aria-hidden="true">💡</span>
                  <h2>Üzerine düşün</h2>
                </div>
                <p className="muted">
                  Yanıtların doğru/yanlış olarak değerlendirilmez; kendi düşünceni özgürce paylaşabilirsin.
                </p>
                <form className="reflection-form" onSubmit={(event) => void saveAnswers(event)}>
                  <fieldset className="classification-fieldset">
                    <legend>Bu durumu nasıl değerlendiriyorsun?</legend>
                    <div className="classification-cards">
                      <label className={`classification-card joke ${classification === 'joke' ? 'selected' : ''}`}>
                        <input
                          checked={classification === 'joke'}
                          name="classification"
                          onChange={() => setClassification('joke')}
                          required
                          type="radio"
                          value="joke"
                        />
                        <div className="classification-card-inner">
                          <span className="classification-emoji" aria-hidden="true">🎭</span>
                          <div className="classification-info">
                            <strong>Şaka</strong>
                          </div>
                          <span className="classification-check" aria-hidden="true">✓</span>
                        </div>
                      </label>
                      <label className={`classification-card bullying ${classification === 'bullying' ? 'selected' : ''}`}>
                        <input
                          checked={classification === 'bullying'}
                          name="classification"
                          onChange={() => setClassification('bullying')}
                          required
                          type="radio"
                          value="bullying"
                        />
                        <div className="classification-card-inner">
                          <span className="classification-emoji" aria-hidden="true">🛑</span>
                          <div className="classification-info">
                            <strong>Zorbalık</strong>
                          </div>
                          <span className="classification-check" aria-hidden="true">✓</span>
                        </div>
                      </label>
                    </div>
                  </fieldset>
                  <label htmlFor="classification-reason">Neden böyle düşündüğünü açıkla</label>
                  <textarea
                    id="classification-reason"
                    maxLength={3000}
                    minLength={3}
                    onChange={(event) => setReasoning(event.target.value)}
                    required
                    rows={4}
                    value={reasoning}
                  />
                  {activeScenario.reflectionQuestions.map((question, index) => (
                    <div className="question-item" key={question.id}>
                      <label htmlFor={`answer-${question.id}`}>
                        {index + 1}. {question.text}
                      </label>
                      <textarea
                        id={`answer-${question.id}`}
                        onChange={(event) => setAnswers({
                          ...answers,
                          [question.id]: event.target.value,
                        })}
                        rows={4}
                        value={answers[question.id] ?? ''}
                      />
                    </div>
                  ))}
                  <button className="primary-button" disabled={saving} type="submit">
                    {saving ? 'Kaydediliyor…' : 'Yanıtlarımı kaydet'}
                  </button>
                </form>
              </section>
            </>
          ) : (
            <section className="content-section scenarios-overview-section">
              <div className="student-hero-banner">
                <div className="hero-progress-card">
                  <div className="progress-info">
                    <span className="progress-label">🌟 Senaryo Keşif Yolculuğun</span>
                    <span className="progress-count">{completedCount} / {totalCount} Tamamlandı</span>
                  </div>
                  <div className="progress-bar-track">
                    <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }} />
                  </div>
                  <p className="progress-status-text">
                    {progressPercent === 100
                      ? '🎉 Tebrikler! Tüm senaryoları inceleyip düşüncelerini kaydettin.'
                      : progressPercent > 0
                        ? '🚀 Harika bir başlangıç! Kalan senaryoları keşfetmeye devam et.'
                        : '✨ Başlamak için aşağıdaki senaryolardan birini seçip incele.'}
                  </p>
                </div>
              </div>

              <div className="section-title-row">
                <div>
                  <p className="eyebrow">KEŞFET VE DÜŞÜN</p>
                  <h2>Yayımlanmış senaryolar</h2>
                </div>
                <span className="scenario-count">{scenarios.length} senaryo</span>
              </div>
              {scenarios.length === 0 ? (
                <div className="empty-state-card">
                  <span className="empty-icon" aria-hidden="true">🌿</span>
                  <p className="empty-state">Henüz yayımlanmış bir senaryo bulunmuyor.</p>
                </div>
              ) : (
                <ul className="student-scenario-list">
                  {scenarios.map((scenario, index) => {
                    const isNew = isScenarioNew(scenario);
                    return (
                      <li key={scenario.id} style={{ animationDelay: `${index * 0.08}s` }}>
                        <button
                          className={`student-scenario-card ${
                            scenario.hasResponse ? 'card-completed' : isNew ? 'card-new' : 'card-pending'
                          }`}
                          onClick={() => void openScenario(scenario.id)}
                          type="button"
                        >
                          <span className="scenario-card-icon" aria-hidden="true">
                            {scenario.hasResponse ? '✅' : isNew ? '✨' : '💡'}
                          </span>
                          <span className="scenario-card-copy">
                            <span className="scenario-title-row-card">
                              <strong>{scenario.title}</strong>
                              {isNew && <span className="scenario-new-pill">YENİ!</span>}
                            </span>
                            <span className="scenario-card-status-chip">
                              {scenario.hasResponse
                                ? '🌟 Yanıtların Kaydedildi'
                                : scenario.responseCount > 0
                                  ? `👥 ${scenario.responseCount} kişi inceledi`
                                  : isNew
                                    ? '🔥 Yeni Eklendi · Henüz kimse incelemedi'
                                    : '✨ Keşfetmeye Başla'}
                            </span>
                          </span>
                          <span className="scenario-card-arrow" aria-hidden="true">→</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          )}
          {message && <p className="success" role="status">{message}</p>}
          {error && <p className="error" role="alert">{error}</p>}
        </div>
        <button
          className="problem-fab"
          id="problem-fab"
          onClick={() => { setReportOpen(true); setReportError(''); }}
          type="button"
        >
          <span className="problem-fab-icon" aria-hidden="true">!</span>
          Sorun mu var?
        </button>
        {reportOpen && (
          <div className="problem-modal-backdrop" onClick={() => setReportOpen(false)}>
            <div
              aria-labelledby="problem-modal-title"
              aria-modal="true"
              className="problem-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <div className="problem-modal-header">
                <span className="problem-modal-icon" aria-hidden="true">⚠️</span>
                <div>
                  <h2 id="problem-modal-title">Sorun mu var?</h2>
                  <p>Bir hata, takılan ekran ya da beklenmeyen davranış gördüysen bize bildir.</p>
                </div>
              </div>
              <form onSubmit={(event) => void submitProblemReport(event)}>
                <label htmlFor="problem-description">Ne oldu?</label>
                <textarea
                  id="problem-description"
                  maxLength={2000}
                  minLength={3}
                  onChange={(event) => setReportDescription(event.target.value)}
                  placeholder="Örn: Senaryoyu açtığımda sayfa yüklenmedi…"
                  required
                  rows={5}
                  value={reportDescription}
                />
                <p className="hint">
                  Ekran, tarayıcı bilgileri ve son hata (varsa) bildirimle birlikte otomatik iletilir.
                  Bildirimi yalnızca yöneticiler görebilir.
                </p>
                <div className="problem-modal-actions">
                  <button className="text-button" onClick={() => setReportOpen(false)} type="button">
                    Vazgeç
                  </button>
                  <button className="primary-button" disabled={reportSending} type="submit">
                    {reportSending ? 'Gönderiliyor…' : 'Sorunu bildir'}
                  </button>
                </div>
                {reportError && <p className="error" role="alert">{reportError}</p>}
              </form>
            </div>
          </div>
        )}
        {showSaveSuccess && (
          <div
            className="celebration-modal-backdrop"
            onClick={() => setShowSaveSuccess(false)}
            role="presentation"
          >
            <div
              aria-labelledby="save-success-title"
              aria-modal="true"
              className="celebration-modal"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
              <button
                aria-label="Pencereyi kapat"
                className="celebration-close"
                onClick={() => setShowSaveSuccess(false)}
                type="button"
              >
                ×
              </button>
              <span className="celebration-icon" aria-hidden="true">🎉</span>
              <h2 id="save-success-title">Harika! Değerlendirmen kaydedildi.</h2>
              <p>Bu senaryoyu inceleyip düşüncelerini paylaştın.</p>
              <div className="celebration-actions">
                {nextPendingScenario && (
                  <button
                    className="primary-button celebration-next-button"
                    onClick={() => {
                      setShowSaveSuccess(false);
                      void openScenario(nextPendingScenario.id);
                    }}
                    type="button"
                  >
                    ➜ Sonraki senaryo
                  </button>
                )}
                <button
                  className="secondary-button"
                  onClick={() => {
                    setShowSaveSuccess(false);
                    setActivePage('scenarios');
                    setActiveScenario(null);
                    setError('');
                    setMessage('');
                    setSidebarOpen(false);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  type="button"
                >
                  Anasayfaya dön
                </button>
              </div>
              {nextPendingScenario && (
                <p className="celebration-hint">İncelemediğin senaryolar var.</p>
              )}
            </div>
          </div>
        )}
        {tutorialStep !== null && (
          <StudentTutorial
            step={tutorialStep}
            onFinish={() => void finishTutorial()}
            onNext={() => setTutorialStep((step) => (step ?? 0) + 1)}
          />
        )}
      </main>
    );
  }

  return (
    <main className="login-screen">
      <div className="ambient-background" aria-hidden="true">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
      </div>
      <section className="login-aside" aria-label="Şakanın Sınırında hakkında">
        <div className="brand-mark-wrapper">
          <img className="brand-mark" src="/icon.png" alt="" aria-hidden="true" />
        </div>
        <p className="aside-kicker">Birlikte düşünmek için güvenli ve keyifli bir alan</p>
        <h1>Şaka nerede biter, incitmek nerede başlar?</h1>
        <p>
          Farklı bakış açılarına yer aç. Kendi düşünceni keşfet; yanıtların doğru ya da
          yanlış diye değerlendirilmez.
        </p>
      </section>
      <section className="login-content">
        <p className="eyebrow">Şakanın Sınırında · Ortak giriş</p>
        <h2>Tekrar hoş geldin!</h2>
        <p className="intro">
          Düşüncelerini keşfetmek ve değerlendirmek için kullanıcı adın ve parolanla giriş yap.
        </p>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="username">Kullanıcı adı</label>
          <input
            autoComplete="username"
            id="username"
            maxLength={32}
            minLength={3}
            onChange={(event) => setUsername(event.target.value)}
            required
            title="3-32 karakter; harf, rakam, nokta, alt çizgi veya tire kullanın."
            type="text"
            value={username}
          />
          <label htmlFor="password">Parola</label>
          <input
            autoComplete="current-password"
            id="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <button className="primary-button" disabled={loginState !== 'idle'} type="submit">
            {loginState === 'submitting' ? 'Giriş yapılıyor…' : 'Giriş yap'}
          </button>
        </form>
        {message && <p className="success" role="status">{message}</p>}
        {error && <p className="error" role="alert">{error}</p>}
      </section>
      {loginState === 'success' && (
        <div className="login-success-screen" role="status" aria-live="polite">
          <div className="login-success-card">
            <div className="login-success-icon" aria-hidden="true">
              <svg viewBox="0 0 52 52">
                <circle cx="26" cy="26" r="24" />
                <path d="m15 27 7 7 15-16" />
              </svg>
            </div>
            <h2>Oturum açıldı!</h2>
            <p>Sisteme yönlendiriliyorsun…</p>
            <div className="login-success-progress" aria-hidden="true">
              <span />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu.';
}

function problemReportContext(): Record<string, string> {
  const context: Record<string, string> = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
  const recent = lastApiError
    && Date.now() - new Date(lastApiError.at).getTime() < 10 * 60 * 1000
    ? lastApiError
    : null;
  if (recent) context.lastApiError = `${recent.status}: ${recent.message}`;
  return context;
}

function apiResourceUrl(value: string): string {
  return value.startsWith('/api/') ? `${API_BASE}${value.slice('/api'.length)}` : value;
}

function youtubeEmbedUrl(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const videoId = host === 'youtu.be'
    ? url.pathname.split('/').filter(Boolean)[0]
    : ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)
      ? url.pathname === '/watch'
        ? url.searchParams.get('v')
        : url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1]
      : undefined;
  return videoId && /^[\w-]{11}$/.test(videoId)
    ? `https://www.youtube-nocookie.com/embed/${videoId}`
    : null;
}

function ScenarioMedia(props: { className: string; title: string; url: string }) {
  const embedUrl = youtubeEmbedUrl(props.url);
  return embedUrl ? (
    <div className="video-embed-frame">
      <iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        src={embedUrl}
        title={`${props.title} videosu`}
      />
    </div>
  ) : (
    <video
      className={props.className}
      controls
      crossOrigin={props.url.startsWith('/api/') ? 'use-credentials' : undefined}
      preload="metadata"
      src={apiResourceUrl(props.url)}
    />
  );
}

function StudentTutorial(props: { step: number; onNext: () => void; onFinish: () => void }) {
  const steps = [
    { title: 'Hoş geldin', text: 'Senaryolara buradan ulaşabilirsin.', target: 'nav-scenarios' },
    { title: 'Senaryolar', text: 'Bir senaryoyu açıp metni, farklı bakış açılarını ve videosu varsa videoyu incele.', target: 'nav-scenarios' },
    { title: 'Değerlendir', text: 'Senaryoda şaka veya zorbalık seçimini yap; gerekçeni ve yanıtlarını kaydet.', target: 'nav-scenarios' },
    { title: 'Uzmana Sor', text: 'Sorunu uzmana ilet ve yanıtını buradan takip et.', target: 'nav-expert' },
    { title: 'Çıkış', text: 'Oturumu kapatma düğmesi menünün alt kısmında.', target: 'sidebar-logout' },
  ];
  const current = steps[Math.min(props.step, steps.length - 1)];
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [visible, setVisible] = useState(false);
  const tipRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const target = document.getElementById(current.target);
    if (!target || !tipRef.current) return;
    target.classList.add('tutorial-target');
    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      const tipRect = tipRef.current?.getBoundingClientRect();
      if (!tipRect) return;
      const margin = 12;
      const left = window.innerWidth > 760
        ? Math.min(rect.right + margin, window.innerWidth - tipRect.width - margin)
        : Math.min(Math.max(margin, rect.left), window.innerWidth - tipRect.width - margin);
      const below = rect.bottom + margin;
      const top = below + tipRect.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, rect.top - tipRect.height - margin);
      setPosition({ top, left: Math.max(margin, left) });
      setVisible(true);
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      target.classList.remove('tutorial-target');
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [current.target]);

  return (
    <aside
      className="tutorial-coachmark"
      ref={tipRef}
      role="note"
      aria-live="polite"
      style={{ top: position.top, left: position.left, visibility: visible ? 'visible' : 'hidden' }}
    >
      <p className="eyebrow">REHBER · {Math.min(props.step + 1, steps.length)}/{steps.length}</p>
      <h2>{current.title}</h2>
      <p>{current.text}</p>
      <div className="tutorial-actions">
        <button className="text-button" onClick={props.onFinish} type="button">Atla</button>
        <button className="primary-button" onClick={props.step + 1 >= steps.length ? props.onFinish : props.onNext} type="button">
          {props.step + 1 >= steps.length ? 'Tamamla' : 'İleri'}
        </button>
      </div>
    </aside>
  );
}

function ConfettiEffect() {
  const pieces = Array.from({ length: 32 });
  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map((_, i) => (
        <span
          className={`confetti-piece p-${i % 6}`}
          key={i}
          style={{
            left: `${(i * 3.1) + ((i * 7) % 5)}%`,
            animationDelay: `${(i % 6) * 0.1}s`,
            animationDuration: `${2.2 + ((i % 4) * 0.3)}s`,
          }}
        />
      ))}
    </div>
  );
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StudentApp />
  </StrictMode>,
);
