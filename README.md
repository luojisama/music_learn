# Sing & Learn Japanese (Music App)

这是一个专为日语学习者设计的唱歌学日语网页应用。集成网易云音乐资源，支持歌词同步显示、罗马音转换、播放速度调节等核心学习功能。

项目地址: [https://github.com/luojisama/music_learn](https://github.com/luojisama/music_learn)

## 核心功能

- **音频播放控制**: 
  - 支持多档播放速度调节（0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x）。
  - 支持单句循环播放（通过点击歌词跳转）。
  - 集成 VKeys API 自动获取高音质（Master/Hi-Res）音源。
- **歌词学习系统**:
  - 中日双语歌词对照。
  - 自动生成并可编辑的罗马音（Romaji）。
  - 歌词滚动高亮与点击跳转进度。
- **UI/UX 体验**:
  - 统一的 **Fuwari** 主题风格（悬浮卡片、毛玻璃效果）。
  - 完善的深色/浅色模式适配。
  - 响应式设计，支持移动端访问。
- **音乐库**:
  - 搜索网易云音乐歌曲及歌单。
  - 自动获取高清歌曲封面（集成网易云 `song/detail` 接口）。
  - 收藏夹与播放历史功能（持久化存储）。

## 技术栈

- **框架**: Next.js 16.1.4 (App Router, Turbopack)
- **样式**: Tailwind CSS (Fuwari Theme)
- **状态管理**: Zustand
- **国际化**: next-intl (支持 中/日/英)
- **API 集成**: 
  - `NeteaseCloudMusicApi` (后端代理)
  - `VKeys API` (高音质音源)
  - `kuroshiro` (罗马音转换)

## 本地开发指南

### 环境要求

- Node.js 20+
- npm 或 pnpm

### 安装步骤

1. 克隆仓库:
   ```bash
   git clone https://github.com/luojisama/music_learn.git
   cd music_learn
   ```
2. 安装依赖:
   ```bash
   npm install
   ```
3. 配置环境变量:
   复制 `.env.example` 为 `.env.local` 并填写相关配置。

4. 启动开发服务器:
   ```bash
   npm run dev
   ```

## API 集成说明

### 1. 网易云音乐代理
应用通过 `app/api/music/[...path]/route.ts` 代理所有对网易云的请求，解决跨域问题。
- 主要接口：`search`, `song_url/v1`, `lyric`, `song/detail`, `playlist/detail`。

### 2. 音质增强 (VKeys)
在播放歌曲时，系统会优先请求 `https://api.vkeys.cn/v2/music/netease` 以尝试获取最高音质链接。若失败，则回退至官方标准音质。

### 3. 封面图修复逻辑
由于搜索接口不直接返回封面，系统会自动调用批量详情接口获取 `picUrl`，确保列表显示完整。

## 部署步骤 (Vercel)

本项目针对 Vercel 平台进行了深度优化：

1. 将代码推送至 GitHub 仓库。
2. 在 Vercel 面板中导入该项目。
3. 确保 **Build Command** 为 `next build`。
4. 在 **Environment Variables** 中添加必要的变量。
5. 点击 **Deploy** 即可完成部署。

## 开源协议

MIT License
