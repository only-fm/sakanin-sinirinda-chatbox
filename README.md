# Şakanın Sınırında

Şakanın Sınırında, öğrencilerin şaka ile akran zorbalığı arasındaki farkı senaryolar, farklı bakış açıları ve yansıtıcı sorular üzerinden keşfetmesine yardımcı olan bir web uygulamasıdır.

## Uygulama

`apps/landing-web` tek React SPA'dır. Ortak giriş ve tüm kullanıcı panelleri bu uygulamada yer alır:

| Rota | Erişim |
|---|---|
| `/` | Tanıtım sayfası |
| `/login` | Supabase Auth girişi |
| `/student` | `student` rolü |
| `/expert` | `expert` rolü |
| `/admin` | `admin` rolü |

Giriş sonrası rol, `auth.users.id` ile eşleşen `public.profiles` kaydından okunur. Profil sorguları yalnızca `id`, `username`, `email` ve `role` sütunlarını kullanır. Profil henüz yoksa kullanıcı `user` rolüyle güvenli biçimde sınırlanır; bu rol herhangi bir korumalı panele erişemez.

E-posta adresiyle giriş Auth hesabındaki e-posta adresini kullanır. Kullanıcı adıyla giriş dahili Auth e-posta takma adına çevrilir. Öğrencinin `profiles.email` alanı boşsa ilk girişte iletişim e-postası istenir.

## Geliştirme

Gereksinimler: Node.js 22 veya üzeri ve npm.

```bash
npm install
cp .env.example .env
npm run dev --workspace apps/landing-web
```

`.env` dosyasına Supabase Dashboard'dan alınan public proje URL'sini ve anon/publishable anahtarını girin:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_TURNSTILE_SITE_KEY=
```

Vite uygulaması `http://localhost:5172` üzerinde açılır. Tarayıcıdaki Supabase Auth, veritabanı, Storage ve Realtime erişimleri `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` ile oluşturulan istemci üzerinden çalışır. `service_role` anahtarını frontend'e veya `.env` içindeki `VITE_` değişkenlerine koymayın.

Doğrulama ve üretim derlemesi:

```bash
npm run typecheck
npm run build
```

## Supabase kurulumu

Gerekli migration'ları projeye uygulayın:

```bash
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy admin-users
```

Yönetici panelindeki hesap oluşturma, güncelleme ve silme işlemleri yetki yükseltme gerektirdiği için `admin-users` Edge Function'ını kullanır. Bu fonksiyonun Supabase ortamında `SUPABASE_URL`, `SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` secret'ları tanımlı olmalıdır. Service-role anahtarı yalnızca Edge Function ortamında kalmalıdır.

İlk yönetici Auth kullanıcısını Supabase Dashboard > Authentication > Users bölümünden oluşturun. SQL Editor'da ilgili `public.profiles.id` kaydının rolünü tek seferlik `admin` yapın.

Giriş bot koruması için Turnstile widget site key'ini `VITE_TURNSTILE_SITE_KEY` olarak ayarlayın ve Supabase Dashboard'da aynı widget için CAPTCHA doğrulamasını etkinleştirin.

## Netlify dağıtımı

Netlify'da `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY` tanımlayın. Netlify build ayarı `netlify.toml` dosyasında yapılandırılmıştır. Supabase migration'larını ve `admin-users` Edge Function'ını dağıtımdan önce uygulayın.
