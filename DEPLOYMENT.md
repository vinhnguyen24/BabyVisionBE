# 🚀 BabyVision Strapi Backend - Deployment Guide

## 📋 Tổng Quan Dự Án

BabyVision Backend là hệ thống CMS được xây dựng trên Strapi v5, cung cấp API cho:
- **React Native App** (Mobile)
- **Next.js Website** (Web)

### Tính năng chính:
- ✅ Quản lý Blog Posts với Rich Text Editor
- ✅ Hệ thống Voucher để kích hoạt Premium
- ✅ Tích hợp RevenueCat cho subscription management
- ✅ Extended User với premium status
- ✅ PostgreSQL Database
- ✅ TypeScript support

---

## 📁 Cấu Trúc Dự Án

```
BabyVisionBackend/
├── config/
│   ├── database.ts          # PostgreSQL configuration
│   ├── middlewares.ts       # CORS & Security settings
│   ├── server.ts            # Server configuration
│   ├── admin.ts             # Admin panel settings
│   └── plugins.ts           # Plugin configuration
├── src/
│   ├── api/
│   │   ├── blog-post/       # Blog content type
│   │   ├── category/        # Category content type
│   │   ├── voucher/         # Voucher content type
│   │   └── voucher-actions/ # Custom API for voucher redemption
│   └── extensions/
│       └── users-permissions/
│           └── content-types/
│               └── user/
│                   └── schema.json  # Extended User schema
├── .env.example             # Environment variables template
├── package.json
└── tsconfig.json
```

---

## 🛠️ Cài Đặt Local Development

### 1. Prerequisites
- Node.js >= 18.x
- PostgreSQL >= 14.x
- npm/yarn/pnpm

### 2. Clone và cài đặt

```bash
cd BabyVisionEcosystem/BabyVisionBackend

# Cài đặt dependencies
npm install
```

### 3. Cấu hình Database PostgreSQL

```bash
# Trên Windows (PowerShell) - kết nối PostgreSQL
psql -U postgres

# Tạo database và user
CREATE DATABASE babyvision_strapi;
CREATE USER strapi_user WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE babyvision_strapi TO strapi_user;
\q
```

### 4. Cấu hình Environment Variables

```bash
# Copy file mẫu
copy .env.example .env

# Chỉnh sửa .env với các giá trị thực
# QUAN TRỌNG: Tạo các secret keys mới cho môi trường của bạn
```

### 5. Generate Secret Keys

```bash
# Chạy lệnh này cho mỗi key
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Hoặc sử dụng OpenSSL (nếu có)
openssl rand -base64 32
```

### 6. Chạy Development Server

```bash
npm run develop
```

Truy cập:
- **Admin Panel**: http://localhost:1337/admin
- **API**: http://localhost:1337/api

---

## 🗄️ Content Types Schema

### Blog Post
| Field | Type | Description |
|-------|------|-------------|
| title | String | Tiêu đề bài viết (required) |
| slug | UID | URL-friendly slug (auto-generated) |
| content | Blocks | Rich text content |
| thumbnail | Media | Ảnh đại diện |
| author | Relation | Liên kết User |
| published_at | DateTime | Ngày xuất bản |
| excerpt | Text | Mô tả ngắn |
| categories | Relation | Danh mục bài viết |
| featured | Boolean | Bài viết nổi bật |
| seo_title | String | SEO title |
| seo_description | String | SEO description |

### Voucher
| Field | Type | Description |
|-------|------|-------------|
| code | String | Mã voucher (unique, required) |
| type | Enum | `free_trial` hoặc `discount` |
| duration_months | Integer | Số tháng Premium (1-12) |
| is_used | Boolean | Đã sử dụng chưa |
| assigned_to | Relation | User được gán voucher |
| expiry_date | DateTime | Ngày hết hạn |
| redeemed_at | DateTime | Ngày sử dụng |
| discount_percentage | Integer | % giảm giá (0-100) |
| max_uses | Integer | Số lần sử dụng tối đa |
| current_uses | Integer | Số lần đã sử dụng |

### Extended User
| Field | Type | Description |
|-------|------|-------------|
| revenuecat_customer_id | String | RevenueCat Customer ID |
| is_premium | Boolean | Trạng thái Premium |
| premium_expires_at | DateTime | Ngày hết hạn Premium |
| display_name | String | Tên hiển thị |
| avatar | Media | Ảnh đại diện |
| baby_birthdate | Date | Ngày sinh của bé |
| push_notification_token | String | FCM/APNS token |

---

## 🔌 Custom API Endpoints

### Voucher Actions

#### 1. Redeem Voucher
**POST** `/api/voucher-actions/redeem`

```json
// Request Body
{
  "voucherCode": "BV-ABC123",
  "appUserId": "revenuecat_customer_id"
}

// Success Response
{
  "success": true,
  "message": "Voucher redeemed successfully! Premium access has been activated.",
  "data": {
    "duration_months": 1,
    "voucher_type": "free_trial",
    "activated_at": "2026-01-08T10:00:00.000Z"
  }
}
```

#### 2. Validate Voucher
**POST** `/api/voucher-actions/validate`

```json
// Request Body
{
  "voucherCode": "BV-ABC123"
}

// Success Response
{
  "valid": true,
  "error": null,
  "data": {
    "type": "free_trial",
    "duration_months": 1,
    "expiry_date": "2026-02-08T00:00:00.000Z"
  }
}
```

#### 3. Generate Vouchers (Admin only)
**POST** `/api/voucher-actions/generate`

```json
// Request Body
{
  "count": 10,
  "type": "free_trial",
  "duration_months": 1,
  "expiry_days": 30,
  "prefix": "BV"
}

// Success Response
{
  "success": true,
  "message": "Generated 10 voucher(s) successfully",
  "vouchers": ["BV-LX1ABC-DEF456", "BV-LX2GHI-JKL789", ...],
  "expiry_date": "2026-02-08T10:00:00.000Z"
}
```

---

## 🔐 RevenueCat Integration

### Setup Steps

1. **Tạo Project trong RevenueCat Dashboard**
   - Truy cập https://app.revenuecat.com
   - Tạo project mới
   - Lấy Secret API Key (bắt đầu bằng `sk_`)

2. **Cấu hình Entitlements**
   - Vào Project Settings > Entitlements
   - Tạo entitlement `premium` (hoặc tên khác)
   - Cập nhật `REVENUECAT_ENTITLEMENT_IDENTIFIER` trong `.env`

3. **Cấu hình Environment Variables**
   ```env
   REVENUECAT_SECRET_API_KEY=sk_xxxxxxxxxxxxxxxxxxxxxxxx
   REVENUECAT_ENTITLEMENT_IDENTIFIER=premium
   ```

### Promotional Grant Flow

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Mobile App    │────▶│  Strapi Backend │────▶│   RevenueCat    │
│                 │     │                 │     │      API        │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ 1. User enters  │     │ 2. Validate     │     │ 4. Grant        │
│    voucher code │     │    voucher      │     │    promotional  │
│                 │     │ 3. Call         │     │    entitlement  │
│                 │     │    RevenueCat   │     │                 │
│ 6. Show success │◀────│ 5. Update       │◀────│                 │
│    message      │     │    voucher      │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

---

## 🌐 CORS Configuration

CORS đã được cấu hình trong `config/middlewares.ts`:

### Development Origins (mặc định)
```
http://localhost:3000    # Next.js dev
http://localhost:3001    
http://localhost:8081    # Metro bundler
http://127.0.0.1:3000
```

### Production Origins (cần thêm)
```
https://babyvision.vn
https://www.babyvision.vn
https://app.babyvision.vn
```

### Cách thêm origins mới

**Option 1: Environment Variable**
```env
CORS_ORIGINS=https://your-domain.com,https://another-domain.com
```

**Option 2: Sửa trực tiếp trong middlewares.ts**
```typescript
origin: env.array('CORS_ORIGINS', [
  // Thêm domain của bạn vào đây
  'https://your-domain.com',
]),
```

---

## 🚀 Production Deployment (VPS Ubuntu)

### 1. Chuẩn bị VPS

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Cài đặt PM2 (Process Manager)
sudo npm install -g pm2

# Cài đặt PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Cài đặt Nginx
sudo apt install -y nginx
```

### 2. Cấu hình PostgreSQL

```bash
sudo -u postgres psql

CREATE DATABASE babyvision_strapi;
CREATE USER strapi_user WITH ENCRYPTED PASSWORD 'SuperSecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE babyvision_strapi TO strapi_user;
\c babyvision_strapi
GRANT ALL ON SCHEMA public TO strapi_user;
\q
```

### 3. Clone và Setup Project

```bash
cd /var/www
git clone <your-repo-url> BabyVisionBackend
cd BabyVisionBackend

# Cài đặt dependencies
npm ci --production=false

# Tạo file .env cho production
nano .env
```

### 4. Production Environment Variables

```env
HOST=0.0.0.0
PORT=1337
PUBLIC_URL=https://api.babyvision.vn
PROXY=true
NODE_ENV=production

# Generate các keys mới cho production!
APP_KEYS="key1,key2,key3,key4"
API_TOKEN_SALT=production-api-salt
ADMIN_JWT_SECRET=production-admin-jwt
TRANSFER_TOKEN_SALT=production-transfer-salt
JWT_SECRET=production-jwt-secret
ENCRYPTION_KEY=production-encryption-key

# PostgreSQL
DATABASE_CLIENT=postgres
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=babyvision_strapi
DATABASE_USERNAME=strapi_user
DATABASE_PASSWORD=SuperSecurePassword123!
DATABASE_SSL=false

# RevenueCat
REVENUECAT_SECRET_API_KEY=sk_production_key
REVENUECAT_ENTITLEMENT_IDENTIFIER=premium

# CORS
CORS_ORIGINS=https://babyvision.vn,https://www.babyvision.vn,https://app.babyvision.vn
```

### 5. Build Production

```bash
npm run build
```

### 6. Cấu hình PM2

```bash
# Tạo ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'babyvision-strapi',
      cwd: '/var/www/BabyVisionBackend',
      script: 'npm',
      args: 'start',
      env_production: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
    },
  ],
};
EOF

# Khởi chạy với PM2
pm2 start ecosystem.config.js --env production

# Lưu cấu hình và tự khởi động cùng hệ thống
pm2 save
pm2 startup
```

### 7. Cấu hình Nginx Reverse Proxy

```bash
sudo nano /etc/nginx/sites-available/babyvision-api
```

```nginx
upstream strapi {
    server 127.0.0.1:1337;
}

server {
    listen 80;
    server_name api.babyvision.vn;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.babyvision.vn;

    # SSL Certificates (Let's Encrypt)
    ssl_certificate /etc/letsencrypt/live/api.babyvision.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.babyvision.vn/privkey.pem;
    
    # SSL Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Timeouts
    proxy_connect_timeout 600s;
    proxy_send_timeout 600s;
    proxy_read_timeout 600s;
    send_timeout 600s;

    # Max upload size (cho media uploads)
    client_max_body_size 100M;

    location / {
        proxy_pass http://strapi;
        proxy_http_version 1.1;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Server $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $http_host;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_pass_request_headers on;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/babyvision-api /etc/nginx/sites-enabled/

# Test nginx config
sudo nginx -t

# Restart nginx
sudo systemctl restart nginx
```

### 8. SSL với Let's Encrypt

```bash
# Cài đặt Certbot
sudo apt install -y certbot python3-certbot-nginx

# Lấy SSL certificate
sudo certbot --nginx -d api.babyvision.vn

# Tự động renew
sudo systemctl enable certbot.timer
```

---

## 📱 Mobile App Integration (React Native)

### Example Usage

```typescript
// services/voucherService.ts
const API_URL = 'https://api.babyvision.vn';

export const redeemVoucher = async (voucherCode: string, appUserId: string) => {
  const response = await fetch(`${API_URL}/api/voucher-actions/redeem`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      voucherCode,
      appUserId,
    }),
  });

  return response.json();
};

export const validateVoucher = async (voucherCode: string) => {
  const response = await fetch(`${API_URL}/api/voucher-actions/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ voucherCode }),
  });

  return response.json();
};
```

---

## 🌐 Website Integration (Next.js)

### Example Usage

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_STRAPI_URL || 'https://api.babyvision.vn';

export async function getBlogPosts(page = 1, pageSize = 10) {
  const response = await fetch(
    `${API_URL}/api/blog-posts?populate=*&pagination[page]=${page}&pagination[pageSize]=${pageSize}&sort=published_at:desc`
  );
  return response.json();
}

export async function getBlogPostBySlug(slug: string) {
  const response = await fetch(
    `${API_URL}/api/blog-posts?filters[slug][$eq]=${slug}&populate=*`
  );
  return response.json();
}
```

---

## 🔒 Security Checklist

- [ ] Tất cả secret keys đều được generate mới cho production
- [ ] PostgreSQL password mạnh và unique
- [ ] CORS chỉ cho phép domains cần thiết
- [ ] SSL/HTTPS enabled
- [ ] Admin panel protected (change default URL nếu cần)
- [ ] Rate limiting configured
- [ ] Firewall configured (UFW)
- [ ] Regular backups scheduled
- [ ] Logs monitoring setup

---

## 🐛 Troubleshooting

### Database Connection Error
```bash
# Kiểm tra PostgreSQL status
sudo systemctl status postgresql

# Kiểm tra logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Strapi Not Starting
```bash
# Kiểm tra PM2 logs
pm2 logs babyvision-strapi

# Xem chi tiết errors
pm2 show babyvision-strapi
```

### CORS Issues
1. Kiểm tra `CORS_ORIGINS` trong `.env`
2. Verify domain chính xác (có/không có www, http/https)
3. Restart Strapi: `pm2 restart babyvision-strapi`

---

## 📞 Support

Nếu gặp vấn đề, hãy kiểm tra:
1. Logs: `pm2 logs babyvision-strapi`
2. Strapi docs: https://docs.strapi.io
3. RevenueCat docs: https://www.revenuecat.com/docs
