# Şakanın Sınırında

Öğrencilerin şaka ile akran zorbalığı arasındaki farkı senaryolar, bağlam ve farklı bakış açıları üzerinden düşünerek keşfetmesine yardımcı olan uygulama.

## Gereksinimler

- Node.js 22 veya üzeri ve npm
- Docker Engine ve Docker Compose

## Yerel geliştirme

1. `.env.example` dosyasını `.env` adıyla kopyalayın. Yerel örnek parolayı yalnızca yerel geliştirme için kullanın; paylaşılan ortamlarda değiştirin.
2. Bağımlılıkları kurun: `npm install`
3. Geliştirme servislerini başlatın: `docker compose up --build`
4. Uygulamalar (ayrı geliştirme portları):
   - Ortak giriş ekranı: <http://localhost:5170>
   - Öğrenci çalışma alanı: <http://localhost:5173>
   - Öğretmen/uzman çalışma alanı: <http://localhost:5174>
   - Yönetici çalışma alanı: <http://localhost:5175>
   - API sağlık kontrolü: <http://localhost:3000/api/health>

Geliştirme port eşlemesi API `3000`, giriş `5170`, öğrenci `5173`, öğretmen/uzman `5174` ve yönetici `5175` şeklindedir. Açılış sayfası geçerli oturum varsa **Sisteme Git** düğmesiyle kullanıcının rolüne ait arayüze, oturum yoksa giriş sayfasına yönlendirir. Giriş ekranında yalnızca kullanıcı adı ve parola alınır, hesabın rolü bulunup ilgili arayüze yönlendirilir. Öğrenci kayıt ekranı kapalıdır; `config/users.json` hesapların tek kaynağıdır. Yönetici panelindeki hesap işlemleri de bu dosyaya yazılır. Parolalar dosyada scrypt ile hash'lenir; dosyayı yine de paylaşmayın veya Git'e eklemeyin. Frontend API istekleri aynı origin'deki `/api` yolunu kullanır ve geliştirme sunucusu bunları API'ye proxy eder. Yerel ağdan erişirken `localhost` yerine sunucunun yerel IP adresini ve ilgili frontend portunu kullanın.

Öğrenciler sol menüdeki **Uzmana Sor** alanından uzmanlara özel soru gönderebilir ve yanıtlarını görebilir. Soru ve yanıtı soruyu gönderen öğrenci, uzmanlar ve yöneticiler görebilir. Öğrenci ve uzman arayüzlerinde sağ alttaki **"Sorun mu var?"** düğmesiyle yaşadıkları sistemsel hata veya aksaklıkları yöneticiye bildirebilir; bildirimle birlikte ekran adı, tarayıcı bilgileri ve son 10 dakika içindeki API hatası otomatik iletilir. Yönetici panelindeki **Sorun bildirimleri** sekmesinde bildirimler açık/çözüldü durum filtresiyle listelenir, açık bildirimler çözüldü olarak işaretlenebilir ve menü düğmesinde açık bildirim sayısı gösterilir. Uzman panelinde **Öğrenci soruları** ve **Senaryo inceleme** bölümleri bulunur; inceleme alanında yayımlanmış senaryo içerikleri gösterilir, öğrenci yanıtları gösterilmez. Öğrenciler senaryoları şaka veya zorbalık olarak sınıflandırıp gerekçe ve yansıtıcı yanıtlar gönderir; yöneticiler **Öğrenci değerlendirmeleri** bölümünde kullanıcı/senaryo filtreleriyle inceleyebilir. Masaüstünde sol menü sabittir; telefonda menü düğmesiyle açılır ve yalnızca içerik alanı kaydırılır.

Uygulamaları ve veritabanını durdurmak için aynı Compose dosyalarıyla `down` komutunu çalıştırın. Veritabanı verileri `postgres_data` volume'unda kalır. Volume'u kaldıran `down -v` komutu verileri siler.

## Debian (WSL) üzerinde Docker Compose

Docker komutlarının Debian WSL terminalinden kullanılabildiğini doğrulayın:

```bash
docker compose version
```

Komut bulunamıyorsa Debian dağıtımınızın Docker Engine'e (ör. Docker Desktop WSL entegrasyonu üzerinden) bağlı olduğundan emin olun. Projeyi mümkünse `/home/<kullanıcı>/projects` gibi WSL'nin Linux dosya sistemi içinde çalıştırın; `/mnt/c` altındaki dosya bağlamaları geliştirme sunucularında yavaş olabilir.

Proje dizininde geliştirme ortamını hazırlayıp başlatın:

```bash
test -f .env || cp .env.example .env
nano .env
docker compose up --build -d
docker compose ps
```

`.env` içindeki örnek parolayı yalnızca yerel geliştirmede kullanın. Varsayılan geliştirme portları `.env` içindeki `API_PORT`, `LOGIN_DEV_PORT`, `STUDENT_DEV_PORT`, `TEACHER_DEV_PORT`, `ADMIN_DEV_PORT` değerleriyle ayarlanır. Bir portu değiştirdiğinizde ilgili frontend host portu Compose tarafından aynı değişkenden oluşturulur; yeni portların uygulanması için `up --build` ile yeniden başlatın. WSL içinden ve Windows tarayıcısından `http://localhost:5170` (giriş), `http://localhost:5173` (öğrenci), `http://localhost:5174` ve `http://localhost:5175` adreslerini açın. Yerel ağdaki başka bir cihazdan bağlanmak için `localhost` yerine sunucunun yerel IP adresini kullanın; frontend API çağrıları aynı origin üzerinden proxy edildiğinden API portunu tarayıcıya açmanız gerekmez. API sağlık kontrolü `http://localhost:3000/api/health` adresindedir. Loglar için `docker compose logs -f`; durdurmak için `docker compose down` çalıştırın. Veritabanı verisi `postgres_data` volume'unda kalır; `down -v` bu veriyi de siler.

## Derleme ve tür denetimi

- Tüm workspace'leri derleyin: `npm run build`
- TypeScript workspace türlerini denetleyin: `npm run typecheck`
- Tek bir uygulamayı derleyin: `npm run build --workspace apps/student-web` (diğer workspace adları `apps/teacher-web`, `apps/admin-web`, `apps/api`)

## Üretim benzeri yerel Compose

1. `.env.example` dosyasını `.env` olarak kopyalayıp yerel değerleri ayarlayın.
2. `docker compose -f compose.yaml -f compose.prod.yaml up --build -d` komutunu çalıştırın.
3. Giriş ekranı `http://localhost:8080`, öğrenci arayüzü `http://localhost:8081`, öğretmen/uzman `http://localhost:8082` ve yönetici `http://localhost:8083` adreslerinde açılır.

Üretim benzeri host portları `.env` içindeki `LOGIN_PROD_PORT`, `STUDENT_PROD_PORT`, `TEACHER_PROD_PORT` ve `ADMIN_PROD_PORT` ile değiştirilebilir. Giriş sonrası yönlendirme URL'lerini özelleştiriyorsanız `LOGIN_APP_URL`, `STUDENT_APP_URL`, `TEACHER_APP_URL` ve `ADMIN_APP_URL` değerlerini de aynı adreslerle eşleştirin.

PostgreSQL portu host'a yayımlanmaz ve yalnızca API'nin bağlı olduğu izole `data` ağına eklenir. Web arayüzleri ile API'nin yayımlanmış portları `app` ağı üzerinden erişilebilir; API ayrıca veritabanına ulaşmak için `data` ağına bağlıdır. Geliştirme override'ı `docker compose up` tarafından otomatik yüklenir. Servisleri ayrı ayrı yeniden oluşturmak için örneğin `docker compose up --build api` veya `docker compose up --build student-web` kullanın.

## Ortam değişkenleri

| Değişken | Amaç |
|---|---|
| `POSTGRES_USER` | PostgreSQL kullanıcı adı |
| `POSTGRES_PASSWORD` | PostgreSQL parolası; gerçek ortamlarda güçlü ve gizli tutulmalı |
| `POSTGRES_DB` | Uygulama veritabanı adı |
| `DATABASE_URL` | API'nin PostgreSQL bağlantı adresi |
| `WEB_ORIGINS` | API'ye istek göndermesine izin verilen arayüz adresleri |
| `API_PORT` | Geliştirme API host portu (varsayılan `3000`) |
| `LOGIN_DEV_PORT`, `STUDENT_DEV_PORT`, `TEACHER_DEV_PORT`, `ADMIN_DEV_PORT` | Geliştirme arayüz host portları (varsayılan `5170`, `5173`-`5175`) |
| `LOGIN_PROD_PORT`, `STUDENT_PROD_PORT`, `TEACHER_PROD_PORT`, `ADMIN_PROD_PORT` | Üretim benzeri arayüz host portları (varsayılan `8080`-`8083`) |
| `LOGIN_APP_URL`, `STUDENT_APP_URL`, `TEACHER_APP_URL`, `ADMIN_APP_URL` | Giriş ve rol bazlı arayüz yönlendirme adresleri |
| `SESSION_COOKIE_DOMAIN` | Farklı alt alan adları kullanılacaksa ortak oturum cookie alan adı; yerelde boş bırakın |

`.env` dosyası, örnek dışı yerel `config/` dosyaları ve loglar sürüm kontrolü dışındadır. Gerekli başlangıç şablonu `config/users.example.json` Git'te tutulur; gerçek sırları örnek dosyaya veya kaynak koda eklemeyin.

## Hesaplar

### İlk yönetici hesabı ve kullanıcı yönetimi

Henüz bir yönetici hesabı yoksa ilk hesabı güvenli, yerel dosyadan oluşturun. Debian/WSL'de proje klasöründeyken:

1. `config/users.example.json` dosyasını `config/users.json` adıyla kopyalayın: `cp config/users.example.json config/users.json`
2. `config/users.json` içindeki `users` listesine ilk yönetici hesabını ekleyin. İlk açılışta eski biçimde `type`, `username` ve yerel dosyaya gireceğiniz güçlü bir `password` alanı kullanabilirsiniz; API ilk açılışta parolayı hash'leyip dosyayı yeni biçime dönüştürür. Parolayı sohbete, Git'e veya README'ye yazmayın.

3. Geliştirme servislerini başlatıp `config/users.json` dosyasını yerinde bırakın:

   ```bash
   docker compose up --build -d
   docker compose exec api npm run build --workspace apps/api
   docker compose exec api npm run provision:users --workspace apps/api
   ```

İlk API başlangıcından sonra dosya `id`, `type`, `username`, `passwordHash`, `createdAt` ve `tutorialCompleted` alanlarını içerir. `config/users.json` sunucuda kalıcı olarak tutulmalı ve yedeklenmelidir; dosyayı silmeyin. Sonraki öğrenci, uzman ve admin hesaplarını admin panelinin **Hesaplar** sekmesinden oluşturup güncelleyebilirsiniz. Hesap değişikliğinde ilgili kullanıcının mevcut oturumları kapatılır.

`type` yalnızca `student`, `teacher` veya `admin` olabilir. Kullanıcı adı 3-32 karakter; harf, rakam, nokta, alt çizgi veya tire içerebilir. Parola 12-128 karakter olmalı ve çevresinde boşluk bulunmamalıdır. Giriş parolası yalnızca `config/users.json` içindeki scrypt hash'inden doğrulanır; veritabanı parola hash'i tutmaz, yalnızca oturumlar ve ilişkisel kullanıcı kimlikleri için metadata saklar. `config/users.json` `.gitignore` içindedir; dosyayı gizli ve sunucuda kalıcı tutun.

Öğrenci hesabı oluşturma ortak giriş ekranından kapatılmıştır. Hesapları yönetici panelindeki **Hesaplar** sekmesinden oluşturup düzenleyin; yapılan değişiklikler doğrudan `config/users.json` dosyasına kaydedilir. Elle eklenen hesapların veritabanı metadata kayıtlarını oluşturmak için API ilk kez çalıştıktan sonra `npm run create:users` komutunu kullanın. Tüm oturumlar 12 saat geçerlidir.

## Senaryo içerikleri

Yönetici panelinin **Öğrenci içerikleri** sekmesinde başlık, metin, bağlam, bakış açıları ve sorular düzenlenebilir; video URL'si eklenebilir veya en fazla 100 MB MP4/WebM/Ogg dosyası sunucuya yüklenebilir. YouTube bağlantıları öğrenci, uzman ve yönetici arayüzlerinde gömülü oynatılır. Yüklenen videolar proje içindeki `scenarios/videos` klasöründe kalıcı saklanır; bu klasördeki medya Git ve Docker build bağlamına dahil edilmez. Senaryo ancak yayımlandığında öğrencilere açılır. Yönetici taslak veya yayımlanmış senaryoyu tamamen silebilir; silme ilişkili öğrenci yanıtlarını ve yüklenen videoyu da siler. Öğrenciler yanıtlarını kendi oturumlarında görür; yöneticiler yetkili rapor bölümünde hesap ve senaryo bazında inceleyebilir. Gerçek senaryo içeriği başlangıç verisi olarak eklenmemiştir.

Admin panelinin **Hareket kayıtları** sekmesi hesap işlemlerini, giriş/çıkışları, içerik değişikliklerini, öğrenci senaryo görüntüleme/yanıt kaydetme, uzman soru/yanıt ve sorun bildirimi olaylarını listeler; kullanıcıya göre filtreleyip sayfalar halinde yükleyebilirsiniz. Öğrenci yanıt metinleri, parolalar ve parola hash'leri hareket kayıtlarına yazılmaz. Her kullanıcı ilk girişinde rolüne uygun, atlanabilir adım adım rehber görür; tamamlanma durumu `config/users.json` içinde tutulur.

## Yapı ve sonraki aşamalar

- `apps/student-web`, `apps/teacher-web`, `apps/admin-web`: ayrı React/Vite uygulamaları
- `apps/api`: NestJS modüler monolit API
- `compose.yaml`, `compose.override.yaml`, `compose.prod.yaml`: ortak servisler ve yerel/üretim benzeri ayarlar
- `tasks.md`: proje kapsamı, fazlar ve kabul ölçütleri

Ortak kullanıcı adı/parola giriş ekranı öğrenci uygulamasındadır ve kök adreste açılır. JSON dosyasındaki `type` alanı kullanıcı rolünü belirtir; API bu rolü yetkilendirme ve yönlendirme için kullanır. Ayrı rol seçimi yoktur. Her panelde karşılama mesajı kullanıcının adını gösterir. Başlangıçta senaryo içeriği yoktur; yönetici alanından içerik oluşturup yayımlamak gerekir.

Üretimde uygulamalar farklı alt alan adlarında çalışırsa oturumların bu adresler arasında paylaşılması için `.env` içindeki `SESSION_COOKIE_DOMAIN` değerini ortak ana alan adına göre ayarlayın (ör. `.ornekalanadi.org`). Giriş sonrası yönlendirme URL'lerini de aynı alan adlarıyla güncelleyin. Bu yerel geliştirme adımı için gerekmez.

## Sunucuya ileride taşıma

Gerçek sunucu, alan adı, DNS, SSH veya SSL işlemi bu projede yapılmaz. Taşıma öncesi `.env` değerlerini güvenli biçimde sağlayın, kalıcı PostgreSQL volume'u için yedekleme/geri yükleme planı hazırlayın ve dış HTTPS sonlandırmasını sizin yöneteceğiniz ters vekil ya da platform katmanında yapılandırın. Alan adları ve dış yönlendirme daha sonra `compose.prod.yaml` ile uyumlu hale getirilebilir. Bu adımlar henüz gerçek bir ortamda doğrulanmamıştır.
