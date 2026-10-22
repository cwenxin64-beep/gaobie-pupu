(() => {
  "use strict";

  const config = window.CLOUDBASE_CONFIG || {};
  const configured = Boolean(config.env && !String(config.env).startsWith("YOUR_"));
  let appPromise = null;

  function init() {
    if (!configured) throw new Error("CloudBase 环境还没配置");
    if (!window.cloudbase) throw new Error("CloudBase JS SDK 没有加载");
    if (!appPromise) {
      appPromise = Promise.resolve(window.cloudbase.init({ env: config.env }));
    }
    return appPromise;
  }

  async function signIn(app) {
    const auth = app.auth({ persistence: "local" });
    await auth.anonymousAuthProvider().signIn();
    return app;
  }

  async function callAI(action, payload) {
    const app = await init();
    await signIn(app);
    const response = await app.callFunction({ name: "ai", data: { action, payload } });
    const result = response?.result;
    if (!result || result.code !== 0) {
      throw new Error(result?.message || "AI 调用失败");
    }
    return result.data;
  }

  window.CloudbaseAI = {
    isConfigured() {
      return configured;
    },
    generateFarewellTask({ ordinal, stories }) {
      return callAI("generate_farewell_task", { ordinal, stories });
    },
    arrangeRecord({ title, text, images }) {
      return callAI("arrange_record", { title, text, images });
    },
    spriteChat({ messages, stories }) {
      return callAI("sprite_chat", { messages, stories });
    }
  };
})();
