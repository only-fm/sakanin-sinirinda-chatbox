import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PressableButton } from './PressableButton';
import { useAuth } from './auth/AuthContext';
import './style.css';

export function LandingPage() {
  const { error, loading, role } = useAuth();
  const navigate = useNavigate();

  const handleLoginClick = () => {
    const rolePath = role === 'student' ? '/ogrenci' : role === 'expert' ? '/uzman' : '/admin';
    navigate(role ? rolePath : '/login');
  };

  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing-container">
      {/* Arka Planda Yüzen Işık Küreleri */}
      <div className="ambient-background" aria-hidden="true">
        <div className="ambient-orb orb-1" />
        <div className="ambient-orb orb-2" />
        <div className="ambient-orb orb-3" />
      </div>

      {/* Üst Menü (Navbar) */}
      <header className={`landing-navbar${scrolled ? ' landing-navbar-scrolled' : ''}`}>
        <div className="nav-brand">
          <img className="brand-badge" src="/icon.png" alt="" aria-hidden="true" />
          <span className="brand-text">Şakanın Sınırında</span>
        </div>
        <nav className="nav-links">
          <a href="#tanitim">Nedir?</a>
          <a href="#farklar">Şaka vs. Zorbalık</a>
          <a href="#nasil-calisir">Nasıl Çalışır?</a>
          <a href="#degerler">İlkelerimiz</a>
        </nav>
        <div className="nav-actions">
          <PressableButton className="nav-login-btn" disabled={loading} hoverScale={0.97} onClick={handleLoginClick} pressScale={0.94} type="button">
            {loading ? 'Kontrol ediliyor…' : role ? 'Panele Git' : 'Oturum Aç →'}
          </PressableButton>
        </div>
      </header>

      {/* Hero (Ana Başlık & Çağrı) */}
      <section className="hero-section" id="tanitim">
        <div className="hero-tag-pill">
          <span className="pill-dot" />
          <span>Birlikte Düşünmek İçin Güvenli Bir Alan</span>
        </div>
        <h1 className="hero-title">
          Şaka Nerede Biter, <br />
          <span className="gradient-text">Akran Zorbalığı</span> Nerede Başlar?
        </h1>
        <p className="hero-description">
          Öğrencilerin doğru/yanlış puanlama baskısı hissetmeden, gerçek hayat senaryoları,
          farklı bakış açıları ve yansıtıcı sorular üzerinden kendi düşüncelerini keşfetmelerine
          yardımcı olan güvenli eğitim platformu.
        </p>

        <div className="hero-cta-group">
          <PressableButton className="primary-cta-btn" disabled={loading} hoverScale={0.98} onClick={handleLoginClick} pressScale={0.95} type="button">
            <span>{loading ? 'Oturum kontrol ediliyor…' : role ? 'Panele Git' : 'Platforma Giriş Yap'}</span>
            <span className="btn-icon">🚀</span>
          </PressableButton>
          <a className="secondary-cta-btn" href="#farklar">
            Farkları İncele ↓
          </a>
        </div>

        {/* Karşılaştırma Kartları (Şaka vs Zorbalık) */}
        <div className="hero-cards-preview" id="farklar">
          <div className="preview-card joke-card">
            <div className="preview-card-header">
              <span className="preview-emoji">🎭</span>
              <div>
                <h3>Şaka</h3>
                <span className="card-badge joke-badge">Eğlence ve Paylaşım</span>
              </div>
            </div>
            <ul>
              <li>✓ Herkesin birlikte güldüğü, kimsenin incinmediği durumlar</li>
              <li>✓ Karşılıklı saygı ve eşit güç dengesi</li>
              <li>✓ İstenmediği anlaşıldığında anında durulabilen davranış</li>
            </ul>
          </div>

          <div className="preview-divider">
            <span>VS</span>
          </div>

          <div className="preview-card bullying-card">
            <div className="preview-card-header">
              <span className="preview-emoji">🛑</span>
              <div>
                <h3>Akran Zorbalığı</h3>
                <span className="card-badge bullying-badge">İncinme ve Baskı</span>
              </div>
            </div>
            <ul>
              <li>✕ Bir tarafın üzüldüğü veya kendini çaresiz hissettiği durumlar</li>
              <li>✕ Güç dengesizliği veya tekrarlayan incitici eylemler</li>
              <li>✕ "Şaka yapıyordum" denilerek sorumluluktan kaçınma</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır Bölümü */}
      <section className="steps-section" id="nasil-calisir">
        <div className="section-header">
          <span className="section-eyebrow">3 ADIMDA EMPATİ</span>
          <h2>Nasıl Çalışır?</h2>
          <p>Düşünmeyi ve farklı pencerelerden bakmayı kolaylaştıran adım adım keşif süreci.</p>
        </div>

        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">01</div>
            <div className="step-icon">📖</div>
            <h3>Senaryoyu Keşfet</h3>
            <p>
              Okulda, serviste veya dijital ortamda geçen gerçekçi bir olayın hikayesini oku,
              varsa videosunu izle ve bağlamı incele.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">02</div>
            <div className="step-icon">👥</div>
            <h3>Bakış Açılarını Gör</h3>
            <p>
              Olayı yaşayanın, şakayı yapanın ve dışarıdan izleyen gözlemcilerin gözünden
              durumu değerlendir, hisleri anla.
            </p>
          </div>

          <div className="step-card">
            <div className="step-number">03</div>
            <div className="step-icon">💡</div>
            <h3>Yansıt ve Uzmana Sor</h3>
            <p>
              Kendi değerlendirmeni yap, yansıtıcı sorulara cevap ver. Aklına takılanları
              okulundaki rehberlik uzmanına özel olarak sor.
            </p>
          </div>
        </div>
      </section>

      {/* Temel İlkeler ve Değerlerimiz */}
      <section className="values-section" id="degerler">
        <div className="section-header">
          <span className="section-eyebrow">GÜVEN VE ETİK</span>
          <h2>Temel İlkelerimiz</h2>
          <p>Öğrenciler için güvenli, yargısız ve samimi bir öğrenme ortamı.</p>
        </div>

        <div className="values-grid">
          <div className="value-card">
            <span className="value-icon">🎯</span>
            <h3>Doğru / Yanlış Baskısı Yok</h3>
            <p>
              Amacımız bir test ya da sınav yapmak değildir. Öğrencinin düşünme sürecini
              özgürce işletmesini ve empati kurmasını destekleriz.
            </p>
          </div>

          <div className="value-card">
            <span className="value-icon">🛡️</span>
            <h3>Öğrenci Mahremiyeti</h3>
            <p>
              Öğrencilerin yanıtları ve kişisel yansımaları diğer öğrencilerle paylaşılmaz;
              herkes kendi düşünce günlüğünü güvenle doldurur.
            </p>
          </div>

          <div className="value-card">
            <span className="value-icon">💬</span>
            <h3>Uzmanla Güvenli Köprü</h3>
            <p>
              "Uzmana Sor" modülü ile öğrenciler akran ilişkilerine dair kafalarını kurcalayan
              soruları doğrudan rehber uzmanlara iletebilir.
            </p>
          </div>
        </div>
      </section>

      {/* Alt Eylem Çağrısı (CTA Banner) */}
      <section className="bottom-cta-section">
        <div className="cta-box">
          <span className="cta-sparkle" aria-hidden="true">✨</span>
          <h2>Farkındalık Yolculuğuna Başlamaya Hazır mısın?</h2>
          <p>Öğrenci, uzman veya yönetici hesabınla hemen oturum aç ve keşfetmeye başla.</p>
          <PressableButton className="primary-cta-btn pulse-glow" disabled={loading} hoverScale={0.98} onClick={handleLoginClick} pressScale={0.95} type="button">
            <span>{loading ? 'Oturum kontrol ediliyor…' : role ? 'Panele Git' : 'Oturum Açma Sayfasına Git'}</span>
            <span className="btn-icon">→</span>
          </PressableButton>
          {error && (
            <p role="status">Oturum veya rol bilgisi alınamadı: {error}</p>
          )}
        </div>
      </section>

      {/* Alt Bilgi (Footer) */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <img className="brand-badge-small" src="/icon.png" alt="" aria-hidden="true" />
            <strong>Şakanın Sınırında</strong>
          </div>
          <p className="footer-text">
            Öğrencilerin şaka ile akran zorbalığı arasındaki farkı keşfetmelerine yardımcı olmak için tasarlanmıştır.
          </p>
          <p className="footer-copy">© 2026 Şakanın Sınırında. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
