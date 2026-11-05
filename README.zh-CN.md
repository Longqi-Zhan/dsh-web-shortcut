# dsh-web-shortcut

一个 DSH profile 插件，为 DeepSeek Harness 网页界面安装桌面快捷方式和独立窗口。
仅支持 Linux（GNOME/GTK + WebKitGTK）。

[English](README.md) | 简体中文

## 安装内容

| 路径 | 用途 |
|---|---|
| `~/.local/bin/dsh-web` | 启动器：复用已在运行的服务，或启动 `dsh web`，然后打开应用窗口 |
| `~/.local/bin/dsh-web-view` | 独立的 WebKitGTK 窗口（`app_id=dsh-web`，不带浏览器界面元素） |
| `~/.local/share/applications/dsh-web.desktop` | 应用菜单条目，以及“停止 DSH Web”操作 |
| `~/桌面/dsh-web.desktop` | 桌面图标（按区域设置：存在 `~/Desktop` 时使用它） |
| `~/.local/share/icons/hicolor/scalable/apps/dsh-web.svg` | 应用图标 |

桌面条目使用 `dsh-web.desktop` 和 `StartupWMClass=dsh-web`，窗口也设置相同的
Wayland `app_id`，因此 GNOME 会把它归到自己的图标下，而不是归到 Firefox 下。

插件是**只安装、不卸载**的：每次 Web 启动都会按插件版本对齐这些文件，但停用或
移除插件并不会删除它们。这是有意为之——Cordis 在进程正常退出时也会销毁插件，
如果放在 dispose 钩子里删除，那 DSH 每次停止都会把快捷方式删掉。要卸载，请移除
插件并手动删除上面列出的路径。

## 认证

DSH Web 使用每进程的启动令牌和签名 Cookie 来认证浏览器。独立查看器：

1. 当快捷方式自己启动了服务时，加载带令牌的 URL；
2. 否则只从本地 Firefox profile 中读取回环地址对应的 `dsh-auth-*` Cookie
   （如果存在），加入 WebKit 的 Cookie jar；
3. 再否则用 `~/.dsh/.credentials.yaml`（仅属主可读）中的浏览器会话签名密钥
   现场签发同一个 Cookie——服务端正是用这个密钥签发 Cookie，同一 Harness
   home 下的所有会话共享它；
4. 两者都不可用时回退到默认浏览器。

Cookie 值和签名密钥不会被记录到日志，也不会发送到本地 DSH 服务器以外的任何
地方。如果缺少 WebKitGTK/PyGObject，启动器会回退到默认浏览器。

## 安装

在具备 `pnpm` 的 DSH checkout/profile 中执行：

```bash
dsh plugin --profile web add /absolute/path/to/dsh-web-shortcut
```

然后在 Web 的 **Settings → Plugins** 页面启用 **DSH Web Shortcut** bundle
（也可以在 profile 的 `package.json` 中把 `"dsh-web-shortcut"` 追加到
`dsh.profile.bundles`）。下次启动 `dsh web` 时完成安装。

本地开发也可以用链接方式：

```json
{
  "dependencies": {
    "dsh-web-shortcut": "link:../../../work/dsh-web-shortcut"
  },
  "dsh": {
    "profile": {
      "bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-web-shortcut"]
    }
  }
}
```

并通过 `node_modules/dsh-web-shortcut` 链接到本目录。

## 开发

本地项目工作区是 `~/work/dsh-web-shortcut`；`web` profile 以
`link:../../../work/dsh-web-shortcut` 链接到它。

```bash
npm run pack    # 生成 dist/dsh-web-shortcut-<version>.tgz
```

修改 `lib/index.js` 或 `assets/*` 后，重启 `dsh web`，插件会重新同步已安装的
快捷方式文件。

## 用法

```bash
dsh-web            # 打开应用窗口（必要时启动服务）
dsh-web --status   # 查看运行状态
dsh-web --stop     # 停止由本启动器启动的服务
DSH_WEB_BROWSER=firefox dsh-web   # 强制沿用旧的 Firefox 窗口方式
DSH_WEB_GPU=1 dsh-web             # 强制保留 WebKit 的 GPU 合成
```

## 环境要求

- 带桌面会话的 Linux（Wayland 或 X11）
- 通过 PyGObject 提供的 GTK 3 和 WebKit2GTK 4.1（`python3-gi`、`gir1.2-webkit2-4.1`）
- Firefox 可选；仅在 Cookie 传递和回退时使用

## 渲染

WebKitGTK 通过 EGL/DMABUF 合成网页。虚拟机、远程桌面以及只有软件渲染的 Mesa
常常没有 DRM 渲染节点（`/dev/dri/renderD*`），这时该路径会画出空窗口：窗口出现
了、页面也加载了（标题都会变），但客户区一片空白。

查看器启动时检查 `/dev/dri/renderD*`，缺失就设置
`WEBKIT_DISABLE_DMABUF_RENDERER=1` 退回共享内存渲染——这类会话本来也得不到
GPU 合成的收益。要强制保留加速路径，或自己控制这个开关：

```bash
DSH_WEB_GPU=1 dsh-web                     # 强制 GPU 合成
WEBKIT_DISABLE_DMABUF_RENDERER=0 dsh-web  # 显式保留 DMABUF
```

## 许可证

[MIT](LICENSE)
