# Duet · 部署到自有服务器

与 [TECH_STACK.md](./TECH_STACK.md) §7–8 对齐：Next.js 独立容器 + 复用已有 MySQL Docker + Nginx HTTPS + 腾讯云 COS。

## 0. 你需要准备

| 项 | 说明 |
|----|------|
| 域名 | 如 `duet.cutepet.online`，DNS A 记录指向服务器 |
| MySQL | 服务器已有 Docker MySQL；为 Duet **独立建库/账号** |
| Docker 网络名 | `docker network ls` 看 MySQL 容器在哪个 network |
| COS | 已有桶与密钥（生产 `.env.production` 填写） |
| HTTPS | Nginx + 证书（certbot 或已有证书） |

## 1. 服务器上准备 MySQL

在**已有** MySQL 容器里执行（示例）：

```sql
CREATE DATABASE IF NOT EXISTS duet
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'duet'@'%' IDENTIFIED BY '换成强密码';
GRANT ALL PRIVILEGES ON duet.* TO 'duet'@'%';
FLUSH PRIVILEGES;
```

记下：库名、用户、密码、容器内主机名（常为 compose 服务名，如 `mysql`）、网络名。

## 2. 上传代码

任选：

```bash
# 本机
git push   # 若已有远程

# 服务器
cd /opt   # 或你习惯的目录
git clone <你的仓库> Duet
cd Duet
```

或 `rsync` / `scp` 整个项目（排除 `node_modules`、`.next`、`.env`）。

## 3. 写生产环境变量

```bash
cp .env.production.example .env.production
nano .env.production
```

必改：

- `DATABASE_URL` → `mysql://duet:密码@mysql主机名:3306/duet`（容器互通用 **3306**，不是宿主机映射端口）
- `BETTER_AUTH_SECRET` → `openssl rand -base64 32`
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` → `https://你的域名`
- `COS_*` → 腾讯云密钥
- `DOCKER_NETWORK` → 与 MySQL 相同的 network 名

查网络示例：

```bash
docker inspect -f '{{json .NetworkSettings.Networks}}' <mysql容器名> | jq
```

把 `docker-compose.prod.yml` 里 `networks.duet_net.name` 通过 `DOCKER_NETWORK` 指过去。

## 4. 构建并启动

`NEXT_PUBLIC_APP_URL` 会在 **镜像构建时** 打进前端，请先写好 `.env.production` 再 `--build`。

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.production logs -f duet
```

启动时会自动 `prisma migrate deploy`，再起 Next（`0.0.0.0:3000`，宿主机仅绑 `127.0.0.1:3000`）。

本机试：

```bash
curl -I http://127.0.0.1:3000/login
```

## 5. Nginx

```bash
sudo cp deploy/nginx-duet.conf.example /etc/nginx/sites-available/duet
# 改 server_name 与证书路径
sudo ln -sf /etc/nginx/sites-available/duet /etc/nginx/sites-enabled/duet
sudo nginx -t && sudo systemctl reload nginx
```

证书可用：

```bash
sudo certbot --nginx -d duet.example.com
```

## 6. 验收清单

- [ ] `https://域名/login` 可打开  
- [ ] 注册 / 登录 / 创建空间  
- [ ] 今日同步 + 配图（应出现在 COS）  
- [ ] 写日记 + 图片  
- [ ] 「我的」改头像  

## 7. 日常更新

```bash
cd /opt/Duet
git pull
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

迁移仍在容器启动时执行。

## 8. 常见问题

| 现象 | 处理 |
|------|------|
| migrate 连不上库 | `DATABASE_URL` 主机名是否在同一 Docker 网络；密码/权限 |
| 登录后跳错域 | `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` 必须是对外 HTTPS 域名 |
| 图片失败 | COS 密钥与桶权限；容器需能访问外网 |
| 502 | `curl 127.0.0.1:3000`；看 `docker logs duet-web` |
| 内存紧张 | compose 已 `mem_limit: 512m`；可再降或给机器加内存 |

## 9. 安全提醒

- `.env.production` 不要进 Git（已在 `.gitignore` 的 `.env*` 规则内）  
- 不要把 MySQL `3306` 为了 Duet 对公网开放  
- 若密钥曾泄露，在腾讯云 CAM 轮换后再写入生产环境  

---

若你提供：**域名、MySQL 容器名/网络名、是否已有 Nginx**，可按你的实际值改一版可直接粘贴的 `.env.production` 与 nginx 片段（密钥仍由你本地填写）。
