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

Giriş ekranında ayrıca rol seçimi yapılmaz. Kullanıcı adı ve parola kullanıcı rolünü belirler; girişten sonra ilgili panel otomatik olarak açılır.

### Uygulamaya erişim

Docker Compose ortamı çalıştırıldıktan sonra geliştirme adresleri:

| Bölüm | Adres |
|---|---|
| Tanıtım sayfası | <http://localhost:5172> |
| Ortak giriş ve ilk kurulum | <http://localhost:5170> |
| Öğrenci paneli | <http://localhost:5173> |
| Öğretmen/Uzman paneli | <http://localhost:5174> |
| Yönetici paneli | <http://localhost:5175> |
| API sağlık kontrolü | <http://localhost:3000/api/health> |

Beklenen sağlık kontrolü yanıtı:

```json
{"status":"ok"}
```

Üretim benzeri yerel adresler varsayılan olarak:

| Bölüm | Adres |
|---|---|
| Giriş | <http://localhost:8080> |
| Öğrenci | <http://localhost:8081> |
| Öğretmen/Uzman | <http://localhost:8082> |
| Yönetici | <http://localhost:8083> |

### İlk yönetici hesabını oluşturma

İlk kurulum, sistemde henüz yönetici hesabı yoksa giriş uygulamasında otomatik olarak açılır.

1. Giriş uygulamasını açın: <http://localhost:5170>
2. `/setup` akışındaki kullanıcı adı ve parola alanlarını doldurun.
3. İlk yönetici hesabını oluşturduktan sonra uygulama sizi yönetici paneline yönlendirir.

Kurulum, hesap bilgilerini `config/users.json` dosyasına kaydeder ve oturum başlatır. Sonraki öğrenci, öğretmen/uzman ve yönetici hesapları yönetici panelinin **Hesaplar** bölümünden oluşturulabilir.

### Senaryolar ve videolar

- Senaryolar taslak veya yayımlanmış durumda olabilir.
- Yalnızca yayımlanmış senaryolar öğrencilere görünür.
- Yönetici senaryoya başlık, metin, bağlam, bakış açıları ve yansıtıcı sorular ekleyebilir.
- Senaryoya harici bir video bağlantısı eklenebilir.
- MP4, WebM veya Ogg biçiminde en fazla 100 MB boyutunda video yüklenebilir.
- Öğrenci değerlendirmeleri ve uzmana sorulan sorular ilgili rollerin yetki sınırları içinde saklanır.

### Bildirimler

- Uygulama içi bildirimler kullanılabilir.
- Bildirim merkezinden okunmuş bildirimler işaretlenebilir ve bildirimler silinebilir.
- VAPID anahtarları yapılandırılmışsa tarayıcı masaüstü bildirimleri kullanılabilir.
- Bildirim izni yalnızca kullanıcı bildirim düğmesine bastığında istenir.
- Web Push desteği HTTPS gerektirir; yerel geliştirmede `localhost` desteklenen istisnadır.

### Yaygın kullanım sorunları

- **Yanlış panele yönlendirme:** Oturum açtıktan sonra kullanıcıya ait rolün doğru olduğundan emin olun.
- **Giriş yapılamaması:** Kullanıcı adını, parolayı ve hesabın yönetici tarafından aktif tutulduğunu kontrol edin.
- **Port çakışması:** `.env` içindeki geliştirme veya üretim benzeri port değerlerini değiştirin.
- **Video yüklenmiyor:** Dosya türünün MP4, WebM veya Ogg ve boyutunun 100 MB sınırında olduğundan emin olun.
- **Bildirim ayarı görünmüyor veya devre dışı:** Tarayıcı bildirim iznini ve API'nin VAPID yapılandırmasını kontrol edin.

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
| `apps/landing-web` | React 19, Vite, TypeScript, React Router, Supabase Auth | Tanıtım sayfası, e-posta/şifre girişi ve role göre korunan öğrenci/uzman/admin rotaları |
| `apps/student-web` | React 19, Vite, TypeScript | Ortak giriş kurulum akışı ve öğrenci arayüzü |
| `apps/teacher-web` | React 19, Vite, TypeScript | Senaryo inceleme ve öğrenci sorularını yanıtlama |
| `apps/admin-web` | React 19, Vite, TypeScript | Hesap, senaryo, değerlendirme, audit ve bildirim yönetimi |
| `apps/api` | NestJS 11, Node.js, TypeScript | Kimlik doğrulama, yetkilendirme ve iş mantığı |
| PostgreSQL | PostgreSQL 17 | Oturum, senaryo, değerlendirme, bildirim ve audit verileri |

API modül grupları: `auth`, `admin`, `scenarios`, `expert-questions`, `problem-reports`, `notifications`, `audit` ve `health`.

### Gereksinimler

- Node.js 22 veya üzeri
- npm
- Docker Desktop veya Docker Engine
- Docker Compose v2 (`docker compose`)
- Git

Docker tabanlı çalışma önerilen akıştır. Windows için Docker Desktop, Linux için Docker Engine ve Compose eklentisinin kurulu olması gerekir.

### Kurulum aşamaları

#### Linux

1. Docker Engine, Docker Compose ve Git'i işletim sisteminizin paket yöneticisiyle kurun.
2. Projeyi terminalde klonlayın:

```bash
git clone <repo-url>
cd sakanin-sinirinda-chatbox
npm install
```

3. Ortam dosyasını oluşturun:

```bash
cp .env.example .env
```

4. Docker servislerini başlatın:

```bash
docker compose up --build --renew-anon-volumes -d
docker compose ps
```

İhtiyaç halinde mevcut kullanıcının Docker grubuna eklenmesi gerekebilir:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

Bu komutlardan sonra oturumu yeniden başlatmak da gerekebilir.

#### Windows

1. [Docker Desktop](https://www.docker.com/products/docker-desktop/) uygulamasını kurun.
2. Docker Desktop ayarlarından **WSL 2 based engine** seçeneğini etkinleştirin.
3. Windows'ta Git'i ve Node.js 22 veya üzeri sürümü kurun.
4. PowerShell veya WSL terminalinde depoyu klonlayın:

PowerShell:

```powershell
git clone <repo-url>
cd sakanin-sinirinda-chatbox
npm install
Copy-Item .env.example .env
```

WSL:

```bash
git clone <repo-url>
cd sakanin-sinirinda-chatbox
npm install
cp .env.example .env
```

Windows performansı için projeyi `/mnt/c` yerine WSL dosya sisteminde, örneğin `~/projeler/sakanin-sinirinda-chatbox` altında tutun.

5. Docker Desktop'ın çalıştığından emin olun ve PowerShell veya WSL terminalinden `.env` dosyasını kullanarak servisleri başlatın:

```bash
docker compose up --build --renew-anon-volumes -d
docker compose ps
```

PowerShell'den çalıştırıyorsanız komutun olduğu dizin Windows proje dizini olmalıdır.

### Ortam değişkenleri

Linux ve Windows kurulumlarında proje kökünde bulunan `.env.example` dosyasından oluşturulan `.env` dosyası aynı değişkenleri kullanır.

Minimum yerel yapılandırma:

```env
POSTGRES_USER=sakanin
POSTGRES_PASSWORD=change-me-local-only
POSTGRES_DB=sakanin
DATABASE_URL=postgresql://sakanin:change-me-local-only@db:5432/sakanin

API_PORT=3000
LANDING_DEV_PORT=5172
LOGIN_DEV_PORT=5170
STUDENT_DEV_PORT=5173
TEACHER_DEV_PORT=5174
ADMIN_DEV_PORT=5175

SESSION_COOKIE_DOMAIN=

VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@example.com

VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`POSTGRES_PASSWORD` ile `DATABASE_URL` içindeki parolanın aynı olması gerekir. `.env` dosyasını Git'e eklemeyin.
Birleşik landing uygulamasındaki Supabase girişi için proje URL'sini ve yalnızca public anon/publishable anahtarını tanımlayın. Bu `VITE_` değerleri frontend derlemesine eklenir; Supabase `service_role` anahtarını frontend'e koymayın.

Temel değişkenler:

| Değişken | Varsayılan / açıklama |
|---|---|
| `POSTGRES_USER` | PostgreSQL kullanıcı adı; varsayılan `sakanin` |
| `POSTGRES_PASSWORD` | PostgreSQL parolası; zorunlu |
| `POSTGRES_DB` | PostgreSQL veritabanı adı; varsayılan `sakanin` |
| `DATABASE_URL` | API'nin PostgreSQL bağlantı dizesi |
| `API_PORT` | Geliştirmede API host portu; varsayılan `3000` |
| `LANDING_DEV_PORT` | Geliştirme landing portu; varsayılan `5172` |
| `LOGIN_DEV_PORT` | Geliştirme giriş portu; varsayılan `5170` |
| `STUDENT_DEV_PORT` | Geliştirme öğrenci portu; varsayılan `5173` |
| `TEACHER_DEV_PORT` | Geliştirme öğretmen/uzman portu; varsayılan `5174` |
| `ADMIN_DEV_PORT` | Geliştirme yönetici portu; varsayılan `5175` |
| `LOGIN_PROD_PORT` | Üretim benzeri giriş portu; varsayılan `8080` |
| `STUDENT_PROD_PORT` | Üretim benzeri öğrenci portu; varsayılan `8081` |
| `TEACHER_PROD_PORT` | Üretim benzeri öğretmen/uzman portu; varsayılan `8082` |
| `ADMIN_PROD_PORT` | Üretim benzeri yönetici portu; varsayılan `8083` |
| `WEB_ORIGINS` | API CORS origin listesi |
| `LOGIN_APP_URL` | Giriş uygulamasının yönlendirme URL'i |
| `STUDENT_APP_URL` | Öğrenci uygulamasının yönlendirme URL'i |
| `TEACHER_APP_URL` | Öğretmen/uzman uygulamasının yönlendirme URL'i |
| `ADMIN_APP_URL` | Yönetici uygulamasının yönlendirme URL'i |
| `SESSION_COOKIE_DOMAIN` | Çoklu alt alan adı için cookie domain'i |
| `USERS_FILE` | Kullanıcı JSON dosyasının API içindeki yolu |
| `MEDIA_DIRECTORY` | Yüklenen videoların API içindeki dizini |
| `VAPID_PUBLIC_KEY` | Tarayıcı push bildirimleri için public key |
| `VAPID_PRIVATE_KEY` | Tarayıcı push bildirimleri için private key |
| `VAPID_SUBJECT` | VAPID yönetici e-posta adresi |
| `VITE_SUPABASE_URL` | Landing uygulamasının Supabase proje URL'si |
| `VITE_SUPABASE_ANON_KEY` | Tarayıcıda kullanılmak üzere Supabase public anon/publishable anahtarı |

### Tek uygulamada rol rotaları ve Supabase

`apps/landing-web` uygulaması aşağıdaki rotaları aynı React Router uygulamasında sunar:

| Rota | Erişim |
|---|---|
| `/` | Tanıtım sayfası |
| `/login` | Supabase Auth e-posta/şifre girişi |
| `/student` | `student` rolü |
| `/expert` | `expert` rolü |
| `/admin` | `admin` rolü |

Giriş ve korumalı rota kontrolü, `auth.users.id` ile eşleşen `public.profiles.id` kaydındaki `role` alanını okur. Supabase SQL Editor'da rol tablosunu ve yalnızca kullanıcının kendi rolünü okumasına izin veren politikayı kurun:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'expert', 'admin'))
);

alter table public.profiles enable row level security;

create policy "Users can read their own role"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);
```

Kullanıcılar ve roller güvenilir bir yönetici/servis işlemiyle oluşturulmalıdır; istemciden rol yazma politikası açmayın. Rota koruması arayüz erişimini sınırlar; veriye erişen her backend/API işlemi ayrıca yetki kontrolü ve RLS ile korunmalıdır. Yerel Vite çalıştırmasında kök `.env` dosyası okunur; Docker Compose'da da aynı iki değer landing frontend build argümanlarına aktarılır. Değerleri değiştirdikten sonra frontend'i yeniden başlatın veya yeniden derleyin.

### Geliştirme ortamını başlatma

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
