# CloudBase + DeepSeek 接入说明

## 1. CloudBase 准备
1. 开通腾讯云 CloudBase，创建一个环境。
2. 打开「身份验证」，开启匿名登录。
3. 在「云函数」里新建一个函数，函数名必须是 `ai`。
4. 上传本仓库里的 `cloudbase/functions/ai` 目录。
5. 给云函数设置环境变量：
   - `DEEPSEEK_API_KEY`：你的 DeepSeek 密钥
   - `DEEPSEEK_MODEL`：可选，默认 `deepseek-chat`

## 2. 网页配置
把 `cloudbase-config.js` 里的：

```js
env: "YOUR_CLOUDBASE_ENV_ID"
```

改成你自己的 CloudBase 环境 ID。

## 3. 静态托管
把整个项目文件夹上传到 CloudBase 静态托管，入口文件是 `index.html`。

## 4. 已接入的能力
- 摇晃手机后调用 DeepSeek 生成专属告别小事
- 记录整理时把文字和图片一起交给 AI 排版
- 栖所精灵对话调用 DeepSeek
- API Key 只保存在云函数环境变量里，不暴露到网页
