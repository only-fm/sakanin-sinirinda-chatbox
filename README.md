# Şakanın Sınırında

Öğrencilerin şaka ile akran zorbalığı arasındaki farkı; senaryolar, bağlam bilgisi, farklı bakış açıları ve yansıtıcı sorular üzerinden keşfetmesine yardımcı olan bir web uygulamasıdır.

Bu depo; tanıtım (landing), ortak giriş, öğrenci, öğretmen/uzman ve yönetici arayüzlerini ayrı frontend uygulamaları olarak, NestJS tabanlı bir API ve PostgreSQL veritabanı ile birlikte sunan bir monorepo içerir.

## İçindekiler

- [Proje özeti](#proje-özeti)
- [Öne çıkan özellikler](#öne-çıkan-özellikler)
- [Mimari ve depo yapısı](#mimari-ve-depo-yapısı)
- [Teknolojiler](#teknolojiler)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
  - [1. Depoyu hazırlama](#1-depoyu-hazırlama)
  - [2. Ortam değişkenlerini (.env) oluşturma](#2-ortam-değişkenlerini-env-oluşturma)
  - [3. Bağımlılıkları yükleme](#3-bağımlılıkları-yükleme)
  - [4. Geliştirme ortamını Docker Compose ile başlatma](#4-geliştirme-ortamını-docker-compose-ile-başlatma)
  - [5. İlk yönetici hesabı ve ilk giriş](#5-ilk-yönetici-hesabı-ve-ilk-giriş)
  - [6. Servisleri durdurma](#6-servisleri-durdurma)
- [Yerel erişim adresleri ve portlar](#yerel-erişim-adresleri-ve-portlar)
- [Kullanıcı rolleri ve yetkiler](#kullanıcı-rolleri-ve-yetkiler)
- [Senaryo, medya ve veri yönetimi](#senaryo-medya-ve-veri-yönetimi)
- [Ortam değişkenleri](#ortam-değişkenleri)
- [Faydalı komutlar](#faydalı-komutlar)
- [Üretim benzeri yerel çalışma](#üretim-benzeri-yerel-çalışma)
- [Veri kalıcılığı ve yedekleme notları](#veri-kalıcılığı-ve-yedekleme-notları)
- [Sorun giderme](#sorun-giderme)
- [Güvenlik ve gizlilik notları](#güvenlik-ve-gizlilik-notları)

## Proje özeti

Uygulamanın amacı, öğrencilerin bir durumu "doğru/yanlış" şeklinde puanlanan bir test gibi değil; bağlamı, duyguları ve farklı bakış açılarını değerlendirerek düşünmesini desteklemektir.

- Öğrenciler yayımlanmış senaryoları inceler, durumu "şaka" veya "zorbalık" olarak nasıl değerlendirdiklerini ve gerekçelerini yazar, yansıtıcı soruları yanıtlar.
- Öğrenciler uzmanlara (öğretmen/uzman rolü) soru gönderebilir ve yanıtlarını takip edebilir.
- Öğretmen/uzman rolü yayımlanmış senaryoları inceleyebilir ve öğrenci sorularını yanıtlayabilir.
- Yöneticiler senaryo içeriklerini yönetir, kullanıcı hesaplarını düzenler, öğrenci değerlendirmelerini ve hareket kayıtlarını inceler, sorun bildirimlerini takip eder.

## Öne çıkan özellikler

- **Rol bazlı arayüzler:** Landing, giriş, öğrenci, öğretmen/uzman ve yönetici için ayrı uygulamalar.
- **Ortak kimlik doğrulama:** Kullanıcı adı/parola ile giriş; rol otomatik algılanır ve ilgili arayüze yönlendirilir.
- **İlk kurulum sihirbazı:** Sistemde yönetici hesabı yoksa giriş tarafında ilk yönetici hesabı oluşturma akışı sunulur.
- **Dosya tabanlı kullanıcı kaynağı:** Hesaplar `config/users.json` dosyasında tutulur; parolalar scrypt ile hash'lenir.
- **Senaryo yönetimi:** Taslak/yayın akışı, başlık-metin-bağlam, bakış açıları, yansıtıcı sorular, harici video URL'si veya yüklenen video desteği.
- **Öğrenci deneyimi:** Senaryo keşfi, değerlendirme/gerekçe/yanıt kaydetme, uzmanlara soru sorma, rehber (tutorial) adımları.
- **Uzman/öğretmen deneyimi:** Yayımlanmış senaryo inceleme, öğrenci sorularını yanıtlama, sorun bildirimi.
- **Yönetim paneli:** Hesap yönetimi, içerik yönetimi, öğrenci değerlendirmeleri, hareket kayıtları (audit), sorun bildirimleri.
- **Sorun bildirimi:** Öğrenci ve uzman arayüzlerinden ekran bağlamı ve son API hatası bilgisiyle yöneticiye bildirim gönderimi.
- **Oturum ve yetkilendirme:** HTTP-only cookie tabanlı oturumlar, rol kontrolleri ve sunucu tarafı doğrulama.

## Mimari ve depo yapısı

```text
.
├─ apps/
│  ├─ landing-web/       # Tanıtım / açılış sayfası (React + Vite)
│  ├─ student-web/       # Ortak giriş + öğrenci çalışma alanı (React + Vite)
│  ├─ teacher-web/       # Öğretmen/uzman arayüzü (React + Vite)
│  ├─ admin-web/         # Yönetici arayüzü (React + Vite)
│  └─ api/               # NestJS API (modüler monolit)
├─ config/
│  └─ users.example.json # Kullanıcı dosyası şablonu
├─ infra/
│  ├─ docker/            # API ve frontend Dockerfile'ları
│  └─ nginx/             # Üretim benzeri frontend sunumu ve /api proxy
├─ scenarios/
│  └─ videos/            # Yüklenen senaryo videoları (kalıcı, .gitignore'da)
├─ compose.yaml          # Temel Docker Compose tanımı
├─ compose.override.yaml # Yerel geliştirme override'ı (varsayılan)
├─ compose.prod.yaml     # Üretim benzeri yerel çalışma override'ı
├─ tasks.md              # Proje kapsamı/faz notları
└─ package.json          # npm workspaces ve kök script'ler
```

### Uygulamalar ve sorumluluklar

| Bileşen | Açıklama |
|---|---|
| `apps/landing-web` | Tanıtım sayfası; oturum durumuna göre girişe veya ilgili panele yönlendirir. |
| `apps/student-web` | Aynı kod tabanı iki bağlamda kullanılır: **giriş uygulaması** (`login-web` servisi) ve **öğrenci uygulaması** (`student-web` servisi). Kurulum sihirbazı ve giriş akışı bu uygulamadadır. |
| `apps/teacher-web` | Uzman/öğretmen paneli: senaryo inceleme, öğrenci sorularını yanıtlama, sorun bildirimi. |
| `apps/admin-web` | Yönetim paneli: kullanıcılar, senaryolar, öğrenci değerlendirmeleri, audit log'ları, sorun bildirimleri. |
| `apps/api` | Kimlik doğrulama, yetkilendirme, senaryo/yanıt/soru/bildirim/audit iş mantığı ve PostgreSQL şema başlangıcı. |

### API modülleri (özet)

- `auth`: oturum açma/kapama, mevcut kullanıcı, ilk kurulum, tutorial tamamlama
- `admin`: kullanıcı CRUD işlemleri (dosya + DB metadata senkronizasyonu)
- `scenarios`: senaryo yönetimi, yayınlama, medya, öğrenci yanıtları
- `expert-questions`: öğrenci soruları ve uzman yanıtları
- `problem-reports`: sorun bildirimleri
- `audit`: hareket kayıtları
- `health`: sağlık kontrolü (`GET /api/health`)

## Teknolojiler

- **Frontend:** React 19, Vite 7, TypeScript
- **Backend:** NestJS 11, Node.js, TypeScript, `pg`
- **Veritabanı:** PostgreSQL 17 (Docker)
- **Altyapı:** Docker Compose, Nginx (üretim benzeri frontend sunumu ve `/api` proxy)
- **Monorepo:** npm workspaces (`apps/*`)

## Gereksinimler

- [Node.js](https://nodejs.org/) **22+** ve **npm**
- [Docker Engine](https://docs.docker.com/engine/install/) ve **Docker Compose** (v2, `docker compose`)
- Git

> Not: Docker tabanlı kurulum önerilen yoldur; API, frontend'ler ve PostgreSQL bu şekilde birlikte çalışacak biçimde yapılandırılmıştır.

## Kurulum

### 1. Depoyu hazırlama

```bash
git clone <repo-url>
cd sakanin-sinirinda-chatbox
```

### 2. Ortam değişkenlerini (.env) oluşturma

Proje kök dizininde `.env` dosyası oluşturun ve en azından aşağıdaki değerleri tanımlayın. `.env.example` başlangıç şablonu olarak kullanılabilir.

Şablondan yerel ortam dosyasını oluşturup kendi değerlerinizi `.env` içinde ayarlayın:

```bash
cp .env.example .env
```

`.env` gizli/yerel değerler içindir; Git'e eklemeyin. `.env.example` ise gerçek parola veya anahtar içermeyen, GitHub'a eklenebilecek bir şablondur.

**Yerel geliştirme için örnek `.env`:**

```env
# PostgreSQL
POSTGRES_USER=sakanin
POSTGRES_PASSWORD=change-me-local-only
POSTGRES_DB=sakanin
DATABASE_URL=postgresql://sakanin:change-me-local-only@db:5432/sakanin

# Geliştirme portları (opsiyonel, varsayılanlar aşağıdadır)
API_PORT=3000
LANDING_DEV_PORT=5172
LOGIN_DEV_PORT=5170
STUDENT_DEV_PORT=5173
TEACHER_DEV_PORT=5174
ADMIN_DEV_PORT=5175

# Üretim benzeri yerel portlar (opsiyonel)
LOGIN_PROD_PORT=8080
STUDENT_PROD_PORT=8081
TEACHER_PROD_PORT=8082
ADMIN_PROD_PORT=8083

# CORS / yönlendirme (gerekirse özelleştirin)
# WEB_ORIGINS=http://localhost:5170,http://localhost:5172,http://localhost:5173,http://localhost:5174,http://localhost:5175
# LOGIN_APP_URL=http://localhost:5170
# STUDENT_APP_URL=http://localhost:5173
# TEACHER_APP_URL=http://localhost:5174
# ADMIN_APP_URL=http://localhost:5175

# Farklı alt alan adlarında ortak oturum gerekiyorsa (yerelde boş bırakın)
# SESSION_COOKIE_DOMAIN=
```

> `POSTGRES_PASSWORD` ve `DATABASE_URL` içindeki parolanın aynı olduğundan emin olun. Gerçek/parlaşılan ortamlarda güçlü ve gizli değerler kullanın.

### 3. Bağımlılıkları yükleme

Yerelde derleme/tür denetimi komutlarını çalıştırmak veya geliştirme araçlarını kullanmak için:

```bash
npm install
```

> Docker geliştirme akışında servisler konteyner içinde bağımlılıkları kullanır; ancak kök workspace komutları (`npm run build`, `npm run typecheck`) için yerel `node_modules` faydalıdır.

### 4. Geliştirme ortamını Docker Compose ile başlatma

```bash
docker compose up --build --renew-anon-volumes -d
docker compose ps
```

`compose.override.yaml`, varsayılan olarak geliştirme servislerini ve portlarını etkinleştirir. İlk çalıştırmada imajların build edilmesi birkaç dakika sürebilir. `--renew-anon-volumes`, servislerin eski `node_modules` volume'larını kullanmasını önler; PostgreSQL verilerini tutan `postgres_data` named volume'u silmez. API derlemesi tamamlanıp healthcheck başarılı olduğunda API'ye bağlı web servisleri başlar.

Servisler arka planda çalışır; Compose tarayıcı sekmelerini otomatik açmaz. Adresler için [Yerel erişim adresleri ve portlar](#yerel-erişim-adresleri-ve-portlar) bölümüne bakın.

Sağlık kontrolü:

```bash
curl http://localhost:3000/api/health
```

Beklenen yanıt: `{"status":"ok"}`

Logları izlemek için:

```bash
docker compose logs -f
```

Belirli bir servisin logları için:

```bash
docker compose logs -f api
```

### 5. İlk yönetici hesabı ve ilk giriş

İki yöntemden birini kullanabilirsiniz:

#### Yöntem A — Kurulum sihirbazı (önerilen, hızlı başlangıç)

1. Sistemde hiç yönetici hesabı yoksa API bunu algılar.
2. Giriş uygulamasını açın: [http://localhost:5170](http://localhost:5170)
3. Uygulama sizi `/setup` akışına yönlendirir ve ilk **yönetici** hesabını oluşturmanızı ister.
4. Kurulumdan sonra yönetici paneline yönlendirilirsiniz.

> Bu yöntem, hesabı `config/users.json` dosyasına da kaydeder ve oturumu başlatır.

#### Yöntem B — `config/users.json` üzerinden ön hazırlık

1. Örnek dosyadan kullanıcı dosyasını oluşturun:

   ```bash
   cp config/users.example.json config/users.json
   ```

2. Gerekirse ilk yönetici hesabını dosyaya ekleyin (alternatif olarak Yöntem A'yı kullanın). Dosya formatı ve hash'leme işlemleri API tarafından yönetildiği için manuel düzenleme yapacaksanız uygulamanın beklediği alanlara dikkat edin.
3. API çalıştıktan sonra veritabanı metadata senkronizasyonu için (gerekli durumlarda):

   ```bash
   docker compose exec api npm run build --workspace apps/api
   docker compose exec api npm run provision:users --workspace apps/api
   ```

> `config/users.json` hassas bir dosyadır: Git'e eklenmez (`.gitignore`), paylaşılmamalı ve yedeklenmelidir.

Sonraki öğrenci/öğretmen/yönetici hesapları yönetici panelindeki **Hesaplar** bölümünden oluşturulabilir ve güncellenebilir. Ortak giriş ekranından öğrenci kaydı yoktur.

### 6. Servisleri durdurma

```bash
docker compose down
```

Veritabanı verileri `postgres_data` Docker volume'unda korunur.

> **Dikkat:** `docker compose down -v` komutu volume'ları da siler ve veritabanı verilerini kalıcı olarak kaldırır.

## Yerel erişim adresleri ve portlar

### Geliştirme (`docker compose up`)

`compose.override.yaml` varsayılan olarak yüklendiği için aşağıdaki adresler kullanılır:

| Servis | Adres | Açıklama |
|---|---:|---|
| Landing (tanıtım) | `http://localhost:5172` | Açılış/tanıtım sayfası |
| Login (giriş/kurulum) | `http://localhost:5170` | Ortak giriş ve ilk kurulum sihirbazı |
| Student (öğrenci) | `http://localhost:5173` | Öğrenci çalışma alanı |
| Teacher (uzman/öğretmen) | `http://localhost:5174` | Öğretmen/uzman çalışma alanı |
| Admin (yönetici) | `http://localhost:5175` | Yönetici paneli |
| API sağlık kontrolü | `http://localhost:3000/api/health` | NestJS API |

> Portlar `.env` içindeki `LANDING_DEV_PORT`, `LOGIN_DEV_PORT`, `STUDENT_DEV_PORT`, `TEACHER_DEV_PORT`, `ADMIN_DEV_PORT`, `API_PORT` değişkenleriyle değiştirilebilir.

### Üretim benzeri (`compose.yaml` + `compose.prod.yaml`)

| Servis | Varsayılan adres |
|---|---:|
| Login | `http://localhost:8080` |
| Student | `http://localhost:8081` |
| Teacher | `http://localhost:8082` |
| Admin | `http://localhost:8083` |

Bu modda frontend'ler Nginx üzerinden sunulur ve `/api` isteklerini API servislerine proxy'ler. PostgreSQL host'a açılmaz.

## Kullanıcı rolleri ve yetkiler

| Rol | Tip (`users.json`) | Temel yetenekler |
|---|---|---|
| Öğrenci | `student` | Yayımlanmış senaryoları görüntüleme, değerlendirme/gerekçe/yanıt kaydetme, uzmana soru sorma, sorun bildirimi oluşturma |
| Öğretmen/Uzman | `teacher` | Yayımlanmış senaryoları inceleme, öğrenci sorularını yanıtlama, sorun bildirimi oluşturma |
| Yönetici | `admin` | Kullanıcı ve senaryo yönetimi, öğrenci değerlendirmelerini görüntüleme, audit log ve sorun bildirimi yönetimi |

Ek notlar:
- Giriş ekranında rol seçimi yapılmaz; kullanıcı adı/parolaya göre rol belirlenir.
- Oturumlar rol bazlı cookie'ler ile taşınır (`sakanin_student_session`, `sakanin_teacher_session`, `sakanin_admin_session`).
- Oturum süresi 12 saattir.
- Hesap güncelleme/silme gibi işlemler sonrası mevcut oturumların kapanması beklenen davranıştır.

## Senaryo, medya ve veri yönetimi

- **Taslak/Yayın:** Senaryolar taslak olarak oluşturulur; yalnızca yayımlanan senaryolar öğrencilere görünür.
- **İçerik alanları:** Başlık, senaryo metni, bağlam, bakış açıları ve yansıtıcı sorular.
- **Video desteği:**
  - Harici video URL'si eklenebilir (ör. YouTube bağlantıları arayüzlerde gömülü oynatılabilir).
  - MP4/WebM/Ogg dosyası yüklenebilir (en fazla 100 MB).
  - Yüklenen dosyalar `scenarios/videos` altında saklanır ve bu klasör Git/Docker build bağlamı dışında tutulur.
- **Yanıtlar:** Öğrencinin senaryo değerlendirmesi (şaka/zorbalık), gerekçesi ve yansıtıcı yanıtları saklanır.
- **Uzman soruları:** Öğrencinin gönderdiği sorular ve uzman yanıtları ilgili rollerin erişimine göre görüntülenir.
- **Audit log:** Hesap, oturum, içerik, senaryo görüntüleme/yanıt ve sorun bildirimi gibi olaylar kayıt altına alınır (hassas içerikler sınırlı tutulur).

## Ortam değişkenleri

| Değişken | Varsayılan / örnek | Açıklama |
|---|---|---|
| `POSTGRES_USER` | `sakanin` | PostgreSQL kullanıcı adı |
| `POSTGRES_PASSWORD` | *(zorunlu)* | PostgreSQL parolası |
| `POSTGRES_DB` | `sakanin` | PostgreSQL veritabanı adı |
| `DATABASE_URL` | `postgresql://...@db:5432/...` | API'nin PostgreSQL bağlantı dizesi |
| `API_PORT` | `3000` | Geliştirmede API host portu |
| `LANDING_DEV_PORT` | `5172` | Geliştirmede landing portu |
| `LOGIN_DEV_PORT` | `5170` | Geliştirmede giriş uygulaması portu |
| `STUDENT_DEV_PORT` | `5173` | Geliştirmede öğrenci uygulaması portu |
| `TEACHER_DEV_PORT` | `5174` | Geliştirmede öğretmen uygulaması portu |
| `ADMIN_DEV_PORT` | `5175` | Geliştirmede yönetici uygulaması portu |
| `LOGIN_PROD_PORT` | `8080` | Üretim benzeri login host portu |
| `STUDENT_PROD_PORT` | `8081` | Üretim benzeri öğrenci host portu |
| `TEACHER_PROD_PORT` | `8082` | Üretim benzeri öğretmen host portu |
| `ADMIN_PROD_PORT` | `8083` | Üretim benzeri yönetici host portu |
| `WEB_ORIGINS` | Compose varsayılanları | API CORS izinli origin listesi (virgülle ayrılmış) |
| `LOGIN_APP_URL` | Ortam/porttan türetilir | Giriş uygulaması URL'i (yönlendirme ve frontend build argümanı) |
| `STUDENT_APP_URL` | Ortam/porttan türetilir | Öğrenci uygulaması URL'i |
| `TEACHER_APP_URL` | Ortam/porttan türetilir | Öğretmen uygulaması URL'i |
| `ADMIN_APP_URL` | Ortam/porttan türetilir | Yönetici uygulaması URL'i |
| `SESSION_COOKIE_DOMAIN` | boş | Farklı alt alan adlarında oturum paylaşımı için cookie domain'i |
| `USERS_FILE` | `config/users.json` (compose mount) | API'nin kullanıcı dosyası yolu (genelde compose tarafından ayarlanır) |
| `MEDIA_DIRECTORY` | `scenarios/videos` (compose mount) | Yüklenen senaryo videolarının saklandığı dizin |

## Faydalı komutlar

### Kök (workspace) komutları

```bash
# Tüm workspace'leri derle
npm run build

# Tüm workspace'lerde TypeScript kontrolü
npm run typecheck

# Kullanıcı metadata senkronizasyonu (API build + provision script)
npm run create:users
```

> `npm run create:users` komutu kökte `docker compose exec api ...` kullandığı için Docker servislerinin çalışıyor olması gerekir.

### Tekil workspace komutları

```bash
# API build
npm run build --workspace apps/api

# Belirli frontend build
npm run build --workspace apps/student-web
npm run build --workspace apps/teacher-web
npm run build --workspace apps/admin-web
npm run build --workspace apps/landing-web
```

### Docker Compose komutları

```bash
# Geliştirme ortamını başlat
docker compose up --build --renew-anon-volumes -d

# Servis durumunu görüntüle
docker compose ps

# Logları izle
docker compose logs -f

# Tek servisi yeniden oluştur/başlat
docker compose up --build --renew-anon-volumes -d api

# Durdur (veriler korunur)
docker compose down
```

## Üretim benzeri yerel çalışma

Üretim benzeri yerel doğrulama için:

```bash
docker compose -f compose.yaml -f compose.prod.yaml up --build -d
```

Bu modda:
- Frontend uygulamaları Nginx imajlarıyla sunulur.
- Login/Student/Teacher/Admin portları host'a açılır (varsayılan `8080-8083`).
- PostgreSQL yalnızca Docker ağı içinde erişilebilir (`data` ağı, host port yok).
- API `app` ve `data` ağlarına bağlıdır.

Durdurmak için:

```bash
docker compose -f compose.yaml -f compose.prod.yaml down
```

## Veri kalıcılığı ve yedekleme notları

- **PostgreSQL verileri:** `postgres_data` Docker volume'unda saklanır.
- **Kullanıcı hesapları:** `config/users.json` dosyasında saklanır ve `./config` dizini konteynere mount edilir.
- **Yüklenen senaryo videoları:** `scenarios/videos` dizininde saklanır ve konteynere mount edilir.

Yedekleme planı yaparken en az şu öğeleri dahil edin:
- PostgreSQL volume yedeği (veya mantıksal dump)
- `config/users.json`
- `scenarios/videos` içeriği

## Sorun giderme

- **`POSTGRES_PASSWORD` / `DATABASE_URL` hatası:** `.env` dosyasını oluşturduğunuzdan ve zorunlu değişkenleri tanımladığınızdan emin olun.
- **API başlamıyor / `users.json` hataları:** `config/users.json` dosyasının geçerli JSON olduğundan ve beklenen kullanıcı alanlarını içerdiğinden emin olun. Bozuk dosya yerine Yöntem A (kurulum sihirbazı) ile yeniden başlamak daha kolay olabilir.
- **Web konteynerleri `Created` durumunda veya API `unhealthy` görünüyor:** `docker compose ps` ve `docker compose logs --tail=100 api` ile durumu inceleyin. Geliştirme API'sinin ilk derlemesi zaman alabilir; healthcheck ilk 120 saniye boyunca derleme için başlangıç toleransı tanır ve Compose web servislerini API sağlıklı olana kadar bekletir. Bağımlılıkları güncel imaj ve yeni anonim volume'larla başlatmak için `docker compose up --build --renew-anon-volumes -d` çalıştırın. `docker compose down -v` kullanmayın; veritabanı volume'unu da siler.
- **Port çakışması:** `.env` içindeki port değişkenlerini değiştirip servisleri yeniden başlatın (`docker compose up --build -d`).
- **Girişten sonra yanlış adrese yönlendirme:** `LOGIN_APP_URL`, `STUDENT_APP_URL`, `TEACHER_APP_URL`, `ADMIN_APP_URL` değerlerinin kullandığınız host/portlarla uyumlu olduğunu kontrol edin.
- **Video yükleme sorunu:** Dosya türünün MP4/WebM/Ogg ve boyutunun 100 MB sınırı içinde olduğundan emin olun.
- **Windows/WSL performansı:** Depoyu mümkünse WSL dosya sisteminde (`/home/...`) çalıştırın; `/mnt/c` altında bind mount performansı düşük olabilir.

## Güvenlik ve gizlilik notları

- `.env`, `config/users.json`, loglar ve yüklenen senaryo videoları Git tarafından izlenmez.
- Oturum çerezi giriş/kurulum sırasında sunucuda rastgele üretilir; tarayıcıya `HttpOnly` olarak gönderilir ve üretimde `Secure` işaretlenir. Veritabanında çerezin kendisi değil, yalnızca token özeti saklanır. Çerez/token değerlerini kaynak koda, `.env` dosyasına veya GitHub'a koymayın.
- `.env.example` yalnızca örnek/boş değerler içermelidir. Gerçek veritabanı parolası, VAPID private key'i veya başka gizli değerleri bu dosyaya yazmayın.
- Parolalar `config/users.json` içinde scrypt hash olarak saklanır; düz metin parola saklanmaz.
- API veritabanında parola hash'i tutmaz; oturum ve kullanıcı metadata kayıtlarını yönetir.
- Öğrenci yanıtları ve soruları rol/yetki kontrolleri ile sınırlandırılır.
- PostgreSQL, Compose yapılandırmasında host'a yayınlanmaz (izole ağ kullanılır).
- Gerçek üretim dağıtımı (alan adı, DNS, TLS/SSL sonlandırma, ters vekil, gizli yönetimi, yedekleme otomasyonu vb.) bu depo içinde tamamlanmış değildir; canlı ortama taşımadan önce bu başlıklar ayrıca planlanmalıdır.
- Proje kapsamı ve faz durumu için `tasks.md` dosyasına bakabilirsiniz.

## Bildirimler ve Web Push yapılandırması

Bildirim kayıtları API ilk açılışında PostgreSQL üzerinde otomatik oluşturulur ve gerekli index/FK tanımları aynı şema başlangıç adımında uygulanır. In-app bildirimleri ve SSE gerçek zamanlı akışı VAPID anahtarları olmadan da çalışır.

Tarayıcı push için `.env` dosyasına VAPID anahtarlarını ekleyin. Bir çift anahtarı proje kökünde üretin:

```bash
npx web-push generate-vapid-keys
```

Komut çıktısındaki public/private değerlerini `VAPID_PUBLIC_KEY` ve `VAPID_PRIVATE_KEY` değişkenlerine; `VAPID_SUBJECT` değerini size ulaşılabilecek `mailto:` adresine koyun. `.env.example` şablon olarak kullanılabilir. Private key'i yalnızca API ortamında tutun; hiçbir `VITE_` değişkenine veya frontend dosyasına eklemeyin.

Değişkenleri güncelledikten sonra yeni ortam değerlerini çalışan konteynere aktarmak için API'yi yeniden oluşturun. Yalnızca `.env` değiştiyse yeniden build gerekmez:

```bash
docker compose up -d --force-recreate api
```

İzin penceresinde **“Sunucuda VAPID anahtarları yapılandırılmamış.”** mesajı görünüyorsa public/private anahtarlarının ikisini de `.env` dosyasına ekleyin, API konteynerini bu komutla yeniden oluşturun ve uygulamayı yenileyip **Bildirimleri Etkinleştir** düğmesine tekrar basın. `.env` dosyasını Git'e eklemeyin; özellikle private key'i paylaşmayın.

Web Push yalnızca HTTPS güvenli bağlamlarında çalışır (localhost geliştirme istisnası). Üretimde TLS, her rol uygulamasında root kapsamlı `/service-worker.js` ve `/icon.png` dosyalarının sunulması gerekir. Bildirim izni kullanıcı düğmesine basmadan istenmez. Veritabanında push aboneliği cihaz bazında saklanır; push kapatma yalnızca mevcut cihazın aboneliğini siler. Push sağlayıcılarının erişilemediği durumda kalıcı in-app bildirimler kullanılmaya devam eder.

Bildirim API yolları: `GET /api/notifications`, `GET /api/notifications/unread-count`, okundu/silme işlemleri, cihaz bazlı `/api/notifications/push/*` uçları ve kimlik doğrulamalı `GET /api/notifications/events` SSE akışı.
