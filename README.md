# Şakanın Sınırında

Şakanın Sınırında, öğrencilerin şaka ile akran zorbalığı arasındaki farkı senaryolar, bağlam bilgisi, farklı bakış açıları ve yansıtıcı sorular üzerinden keşfetmesine yardımcı olan bir web uygulamasıdır.

Bu README kullanıcılar ve geliştiriciler için iki ayrı bölümde hazırlanmıştır.

## Kullanıcılar İçin

### Uygulama nedir?

Uygulama, bir durumu doğru veya yanlış bir test sorusu olarak puanlamaktan ziyade öğrencilerin bağlamı, duyguları ve farklı bakış açılarını değerlendirmesini amaçlar.

Temel kullanım akışları:

- Öğrenciler yayımlanmış senaryoları inceler.
- Öğrenciler durumu şaka veya zorbalık olarak değerlendirir ve gerekçesini yazar.
- Öğrenciler yansıtıcı soruları yanıtlar.
- Öğrenciler öğretmen/uzmanlara soru gönderebilir ve yanıtlarını takip edebilir.
- Öğretmen ve uzmanlar yayımlanmış senaryoları inceleyebilir ve öğrenci sorularını yanıtlayabilir.
- Yöneticiler kullanıcı, senaryo, değerlendirme, bildirim ve hareket kayıtlarını yönetebilir.

### Kullanıcı rolleri

| Rol | Kullanıcı paneli | Yapabilecekleri |
|---|---|---|
| Öğrenci | `5173` geliştirme / `8081` üretim benzeri | Senaryoları inceleme, değerlendirme ve gerekçe kaydetme, yansıtıcı soruları yanıtlama, uzmana soru sorma, sorun bildirme |
| Öğretmen/Uzman | `5174` geliştirme / `8082` üretim benzeri | Yayımlanmış senaryoları inceleme, öğrenci sorularını yanıtlama, sorun bildirme |
| Yönetici | `5175` geliştirme / `8083` üretim benzeri | Hesap ve senaryo yönetimi, öğrenci değerlendirmelerini inceleme, bildirim ve hareket kayıtlarını takip etme |

Giriş ekranında ayrıca rol seçimi yapılmaz. Kullanıcı adı veya e-posta ve parola ile giriş yapılır; rol `profiles` kaydından okunur ve ilgili panel otomatik olarak açılır.

### Uygulamaya erişim

Birleşik Vite uygulaması için geliştirme adresi:

| Bölüm | Adres |
|---|---|
| Tek React uygulaması | <http://localhost:5172> |
| Tanıtım sayfası | <http://localhost:5172/> |
| Ortak giriş | <http://localhost:5172/login> |
| Öğrenci paneli | <http://localhost:5172/student> |
| Uzman paneli | <http://localhost:5172/expert> |
| Yönetici paneli | <http://localhost:5172/admin> |

Beklenen sağlık kontrolü yanıtı:

```json
{"status":"ok"}
```

### İlk yönetici hesabını oluşturma

İlk yönetici Auth kullanıcısını Supabase Dashboard > Authentication > Users bölümünden oluşturun. Ardından SQL Editor'da o kullanıcının profilini yönetici yapın. Bu ilk kurulum dışında istemci üzerinden rol yükseltme yapılmamalıdır. Sonraki öğrenci, uzman ve yönetici hesapları yönetici panelinin **Hesaplar** bölümünden oluşturulabilir.

### Senaryolar ve videolar

- Senaryolar taslak veya yayımlanmış durumda olabilir.
- Yalnızca yayımlanmış senaryolar öğrencilere görünür.
- Yönetici senaryoya başlık, metin, bağlam, bakış açıları ve yansıtıcı sorular ekleyebilir.
- Senaryoya harici bir video bağlantısı eklenebilir.
- MP4, WebM veya Ogg biçiminde en fazla 100 MB boyutunda video yüklenebilir.
- Öğrenci değerlendirmeleri ve uzmana sorulan sorular ilgili rollerin yetki sınırları içinde saklanır.

### Bildirimler

- Uygulama içi bildirimler Supabase Realtime ile çalışır.
- Bildirim merkezinden okunmuş bildirimler işaretlenebilir ve bildirimler silinebilir.
- Tarayıcı abonelik kaydı arayüzü mevcut olsa da sunucu tarafı Web Push gönderimi henüz etkin değildir.
- Bildirim izni yalnızca kullanıcı bildirim düğmesine bastığında istenir.
- Web Push desteği HTTPS gerektirir; yerel geliştirmede `localhost` desteklenen istisnadır.

### Yaygın kullanım sorunları

- **Yanlış panele yönlendirme:** Oturum açtıktan sonra kullanıcıya ait rolün doğru olduğundan emin olun.
- **Giriş yapılamaması:** Kullanıcı adını, parolayı ve hesabın yönetici tarafından aktif tutulduğunu kontrol edin.
- **Video yüklenmiyor:** Dosya türünün MP4, WebM veya Ogg ve boyutunun 100 MB sınırında olduğundan emin olun.
- **Supabase bağlantı hatası:** `.env` ve Netlify ortamında public Supabase URL/key değerlerini kontrol edin; migration'ların projeye uygulandığından emin olun.

## Geliştiriciler İçin

### Proje yapısı

Bu depo, ayrı frontend uygulamalarını, bir NestJS API'yi ve PostgreSQL veritabanını içeren bir npm monorepo'sudur.

```text
.
├─ apps/
│  ├─ landing-web/       # Tanıtım sayfası
│  ├─ student-web/       # Giriş ve öğrenci çalışma alanı
│  ├─ teacher-web/       # Öğretmen/uzman çalışma alanı
│  ├─ admin-web/         # Yönetici çalışma alanı
│  └─ api/               # NestJS API
├─ config/
│  ├─ users.example.json # Kullanıcı dosyası örneği
│  └─ users.json         # Yerel kullanıcı verileri (Git'e eklenmez)
├─ infra/
│  ├─ docker/            # API ve frontend Dockerfile'ları
│  └─ nginx/             # Üretim benzeri sunum ve /api proxy
├─ scenarios/videos/     # Yüklenen senaryo videoları
├─ compose.yaml          # Temel Docker Compose yapılandırması
├─ compose.override.yaml # Varsayılan yerel geliştirme ayarları
├─ compose.prod.yaml     # Üretim benzeri yerel çalışma ayarları
└─ package.json          # Kök komutlar ve npm workspaces
```

### Bileşen sorumlulukları

| Bileşen | Teknoloji | Sorumluluk |
|---|---|---|
| `apps/landing-web` | React 19, Vite, TypeScript, React Router, Supabase | Tek SPA, ortak giriş ve bütün rol rotaları |
| `apps/student-web` | React 19, Vite, TypeScript | Tek SPA içinde kullanılan mevcut öğrenci arayüz bileşenleri |
| `apps/teacher-web` | React 19, Vite, TypeScript | Tek SPA içinde kullanılan mevcut uzman arayüz bileşenleri |
| `apps/admin-web` | React 19, Vite, TypeScript | Tek SPA içinde kullanılan mevcut yönetici arayüz bileşenleri |
| `supabase/` | PostgreSQL, Auth, Storage, Edge Functions | Veritabanı, kullanıcı rolleri, video saklama ve güvenli yönetici işlemleri |
| `apps/api` | NestJS (eski) | Taşıma sürecindeki önceki API; Netlify SPA tarafından kullanılmaz |

### Gereksinimler

- Node.js 22 veya üzeri
- npm
- Git

### Kurulum ve yerel geliştirme

```bash
git clone <repo-url>
cd sakanin-sinirinda-chatbox
npm install
```

`.env.example` dosyasını `.env` olarak kopyalayıp Supabase URL ve public anon key değerlerini girin. PowerShell'de:

```powershell
Copy-Item .env.example .env
npm run dev --workspace apps/landing-web
```

Diğer işletim sistemlerinde `.env` kopyalama komutu `cp .env.example .env` olabilir. Vite uygulaması `http://localhost:5172` üzerinde tek SPA olarak çalışır.

### Ortam değişkenleri

Linux ve Windows kurulumlarında proje kökünde bulunan `.env.example` dosyasından oluşturulan `.env` dosyası aynı değişkenleri kullanır.

Tek React uygulamasını çalıştırmak için gereken ayarlar:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_TURNSTILE_SITE_KEY=
```

`.env` dosyasını Git'e eklemeyin. Frontend'e yalnızca Supabase public anon/publishable anahtarını verin; `service_role` anahtarı yalnızca Supabase Edge Functions ortamında kalmalıdır. Eski Docker Compose API ayarları bu SPA kurulumu için kullanılmaz.

### Tek uygulamada rol rotaları ve Supabase

`apps/landing-web` uygulaması aşağıdaki rotaları aynı React Router uygulamasında sunar:

| Rota | Erişim |
|---|---|
| `/` | Tanıtım sayfası |
| `/login` | Turnstile doğrulamalı Supabase Auth kullanıcı adı veya profilde tanımlı e-posta ve parola girişi |
| `/student` | `student` rolü |
| `/expert` | `expert` rolü |
| `/admin` | `admin` rolü |

Giriş ve korumalı rota kontrolü, `auth.users.id` ile eşleşen `public.profiles.id` kaydındaki `role` alanını okur. Tablo ve RLS politikaları için proje kökündeki SQL migration'larını Supabase CLI ile uygulayın:

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy admin-users
```

`profiles` kullanıcı/rol altyapısını SQL Editor üzerinden kurmak veya yenilemek için `supabase/user_management.sql` dosyasının tamamını çalıştırın. Bu betik `profiles` tablosunu, yeni Auth kullanıcıları için öğrenci profili oluşturan trigger'ı ve rol alanının istemciden değiştirilemediği RLS politikalarını kurar. Uygulamanın diğer tabloları için migration'ları ayrıca `supabase db push` ile uygulayın.

Öğrencinin `profiles.email` alanı boşsa ilk girişte e-posta toplama penceresi gösterilir. E-posta kaydedilmeden öğrenci paneline erişilemez; profil sahibi yalnızca kendi e-posta alanını güncelleyebilir. Giriş, doğrudan Supabase Auth parola doğrulamasıyla yapılır: `@` içeren değer e-posta olarak, diğer değerler kullanıcı adına bağlı dahili Auth e-posta takma adı olarak kullanılır. `profiles.email` iletişim adresidir; girişte kullanılacak e-posta, Auth hesabındaki e-posta adresi olmalıdır.

İlk Auth kullanıcısını oluşturduktan sonra SQL Editor'da kimliğini kontrol edip tek seferlik yükseltin:

```sql
update public.profiles set role = 'admin' where id = '<auth-user-uuid>';
```

Yönetici panelinden açılan kullanıcılar Supabase Auth'ta dahili `.invalid` e-posta takma adıyla oluşturulur; bu takma ad kullanıcı adıyla girişte kullanılır. Gerçek e-posta ile oluşturulmuş hesaplar e-posta adresiyle giriş yapabilir. `contact_email` alanı ileride kişisel e-posta eklenmesine zemin sağlar; e-posta tabanlı ikinci faktör henüz etkin değildir. Öğrenciler için Cloudflare Zero Trust gerekmez; Supabase Auth ve RLS erişim sınırları kullanılır.

Giriş bot koruması için Cloudflare Turnstile'da bir widget oluşturun; site key'i yerel `.env` ve Netlify site environment variables bölümündeki `VITE_TURNSTILE_SITE_KEY` değerine ekleyin. Supabase Dashboard'da Authentication CAPTCHA ayarlarında Turnstile sağlayıcısını etkinleştirip aynı widget'ın secret key'ini girin. Frontend site key'i tek başına yeterli değildir; Supabase tarafındaki secret key doğrulaması olmadan Auth CAPTCHA doğrulanmaz.

Yerel Vite çalıştırmasında kök `.env` dosyasında `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ve gerekiyorsa `VITE_VAPID_PUBLIC_KEY` tanımlayın. `service_role` anahtarını yalnız Supabase Edge Function secret olarak saklayın; frontend'e koymayın.

### Netlify dağıtımı

Netlify deposu proje köküne bağlandığında `netlify.toml` tek `apps/landing-web` derlemesini yapılandırır. Netlify ortam değişkenlerinde `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` tanımlayın. SPA yönlendirmesi derin bağlantıları sağlar. Supabase migration'larını ve `admin-users` Edge Function'ını dağıtımdan önce uygulayın. Yönetici kullanıcı işlemi için Supabase Edge Functions'ın varsayılan `SUPABASE_SERVICE_ROLE_KEY` secret'ı kullanılır; bu anahtarı Netlify'a eklemeyin.

### Geliştirme ortamını başlatma

> Aşağıdaki Docker Compose, PostgreSQL, NestJS API ve `config/users.json` bölümleri önceki çoklu uygulama kurulumuna aittir. Netlify'daki tek SPA ve Supabase kurulumu için kullanılmaz; güncel akış için yukarıdaki Supabase/Netlify bölümlerini izleyin.

```bash
docker compose up --build --renew-anon-volumes -d
docker compose ps
```

İlk derleme birkaç dakika sürebilir. API derlemesi tamamlanıp healthcheck başarılı olduğunda web servisleri başlar.

Servis durumları ve loglar:

```bash
docker compose ps
docker compose logs -f
docker compose logs -f api
```

Sağlık kontrolü:

```bash
curl http://localhost:3000/api/health
```

Durdurma:

```bash
docker compose down
```

`docker compose down -v` kullanmayın; bu komut PostgreSQL volume'unu da siler.

### Kullanıcı verisini hazırlama

İlk yönetici hesabı için kullanıcı dosyasını elle oluşturmak mümkün değildir. Önerilen yöntem giriş uygulamasındaki kurulum sihirbazıdır.

Alternatif olarak örnek dosyayı kopyalayabilirsiniz:

```bash
cp config/users.example.json config/users.json
```

Kullanıcı dosyasıyla çalışırken kullanıcı metadata senkronizasyonu için:

```bash
npm run build --workspace apps/api
npm run create:users
```

`npm run create:users`, API ve kullanıcı dosyası yapılandırmasını kullanır. API çalışır durumda olmalıdır.

### Kök ve workspace komutları

```bash
# Tüm workspace'leri derle
npm run build

# Tüm workspace'lerde TypeScript kontrolü
npm run typecheck

# Kullanıcı metadata senkronizasyonu
npm run create:users

# Tekil workspace build
npm run build --workspace apps/api
npm run build --workspace apps/landing-web
npm run build --workspace apps/student-web
npm run build --workspace apps/teacher-web
npm run build --workspace apps/admin-web
```

Tekil API tip kontrolü:

```bash
npm run typecheck --workspace apps/api
```

### Üretim benzeri yerel çalışma

```bash
docker compose -f compose.yaml -f compose.prod.yaml up --build -d
```

Bu modda:

- Frontend uygulamaları Nginx ile sunulur.
- `/api` istekleri API servisine proxy'lenir.
- Login/Student/Teacher/Admin uygulamaları varsayılan olarak `8080-8083` portlarında açılır.
- PostgreSQL yalnızca Docker ağı içindedir ve host'a yayınlanmaz.

Durdurma:

```bash
docker compose -f compose.yaml -f compose.prod.yaml down
```

### Veriler ve kalıcılık

- PostgreSQL verileri `postgres_data` Docker volume'unda saklanır.
- Kullanıcı hesapları `config/users.json` dosyasındadır.
- Yüklenen senaryo videoları `scenarios/videos` dizinindedir.
- Dosya tabanlı kullanıcı verilerini yedeklemek için scrypt parola hash'i içeren dosyanın korunması gerekir.
- PostgreSQL yedeğini, kullanıcı dosyasını ve medya dizinini birlikte yedekleyin.

Mantıksal PostgreSQL yedeği için örnek:

```bash
docker compose exec -T db pg_dump -U sakanin sakanin > backup.sql
```

### Web Push yapılandırması

Bir VAPID anahtar çifti üretin:

```bash
npx web-push generate-vapid-keys
```

Çıktıdaki public/private anahtarları `.env` dosyasına yazın ve `VAPID_SUBJECT` için size ulaşılabilecek bir `mailto:` adresi kullanın.

Sadece private key'i API ortamında tutun. `VITE_` değişkenlerine veya frontend dosyalarına private key eklemeyin.

Değerleri güncelledikten sonra API'yi yeniden oluşturun:

```bash
docker compose up -d --force-recreate api
```

Bildirim API uçları:

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `GET /api/notifications/events`
- `/api/notifications/push/*`
- Okunmuş/silinmiş bildirim işlemleri

Bildirim kayıtları ve gerekli PostgreSQL indeksleri API ilk açılışında oluşturulur.

### Sorun giderme

- **Zorunlu PostgreSQL değişkeni hatası:** `.env` dosyasını oluşturduğunuzdan ve `POSTGRES_PASSWORD` ile `DATABASE_URL` değerlerini ayarladığınızdan emin olun.
- **API başlayamıyor:** `docker compose logs --tail=100 api` ile hata kaydını inceleyin.
- **`users.json` hatası:** Dosyanın geçerli JSON olduğundan emin olun veya kurulum sihirbazını kullanarak yeni bir ilk yönetici hesabı oluşturun.
- **Web servisleri `Created` durumunda:** `docker compose ps` ve API loglarını kontrol edin. Geliştirme API'si ilk derleme sırasında hazırlanabilir.
- **Eski bağımlılık veya volume sorunu:** `docker compose up --build --renew-anon-volumes -d` komutunu kullanın.
- **Port çakışması:** `.env` içindeki ilgili port değerlerini değiştirip Compose'u yeniden başlatın.
- **Yanlış yönlendirme:** `LOGIN_APP_URL`, `STUDENT_APP_URL`, `TEACHER_APP_URL` ve `ADMIN_APP_URL` değerlerinin kullandığınız host/portlarla uyumlu olduğunu doğrulayın.
- **Windows/WSL performansı:** Depoyu mümkünse WSL dosya sisteminde çalıştırın; Windows bind mount performansı daha düşük olabilir.

### Güvenlik notları

- `.env`, `config/users.json`, loglar ve yüklenen videolar Git'e eklenmemelidir.
- Oturumlar `HttpOnly` cookie olarak taşınır; HTTPS isteklerinde `Secure` kullanılır. Ters vekil `X-Forwarded-Proto` başlığını iletmelidir. HTTP üzerinden erişimde oturum çerezleri şifrelenmediğinden üretimde HTTPS kullanın.
- Oturum token'inin kendisi yerine veritabanında yalnızca token özeti saklanır.
- Oturum süresi 12 saattir.
- Parolalar `config/users.json` içinde düz metin değil scrypt hash olarak saklanır.
- Öğrenci yanıtları ve soruları API'deki rol/yetki kontrolleriyle sınırlandırılır.
- PostgreSQL Compose yapılandırmasında host'a yayımlanmaz.
- Gerçek üretim dağıtımı için DNS, TLS/SSL sonlandırma, ters vekil, gizli yönetimi, yedekleme otomasyonu ve izleme ayrıca planlanmalıdır.
