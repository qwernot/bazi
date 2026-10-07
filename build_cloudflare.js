/**
 * Cloudflare Pages / Workers 自动构建打包工具
 * 将 Node.js 后端算法、古籍知识库和 API 路由打包为符合 Cloudflare Pages 规范的单个 _worker.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const PUBLIC_DIR = path.join(__dirname, "public");

const baziRules = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "bazi_rules.json"), "utf-8"));
const qiongTongData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "qiongtong.json"), "utf-8"));
const sanMingData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "sanming.json"), "utf-8"));
const ichingData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "iching_64.json"), "utf-8"));
const booksLibrary = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "books_library.json"), "utf-8"));
const licenseKeys = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "license_keys.json"), "utf-8"));
const chinaCitiesData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "china_cities.json"), "utf-8"));
const appConfigData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "app_config.json"), "utf-8"));
const songShaoguangData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "song_shaoguang_2026.json"), "utf-8"));

// 提取核心算法代码
const calendarCode = fs.readFileSync(path.join(__dirname, "lib/calendar.js"), "utf-8")
  .replace(/module\.exports\s*=\s*\{[\s\S]*?\};/, "");

const baziCode = fs.readFileSync(path.join(__dirname, "lib/bazi.js"), "utf-8")
  .replace(/const fs = require\("fs"\);/, "")
  .replace(/const path = require\("path"\);/, "")
  .replace(/const \{[\s\S]*?\} = require\("\.\/calendar"\);/, "")
  .replace(/const rulesPath = [\s\S]*?;/, "")
  .replace(/const rules = JSON\.parse\(fs\.readFileSync\(rulesPath, "utf-8"\)\);/, "const rules = baziRules;")
  .replace(/module\.exports\s*=\s*\{[\s\S]*?\};/, "");

const analyzerCode = fs.readFileSync(path.join(__dirname, "lib/analyzer.js"), "utf-8")
  .replace(/const fs = require\("fs"\);/, "")
  .replace(/const path = require\("path"\);/, "")
  .replace(/const qiongTongData = [\s\S]*?;/, "")
  .replace(/const sanMingData = [\s\S]*?;/, "")
  .replace(/const songShaoguangData = [\s\S]*?;/, "")
  .replace(/module\.exports\s*=\s*\{[\s\S]*?\};/, "");

const workerTemplate = `/**
 * Cloudflare Pages Functions / Worker 主入口 (_worker.js)
 * 纯 Serverless 边缘执行，零冷启动，自动支持全球 CDN 与 KV 存储
 */

const baziRules = ${JSON.stringify(baziRules)};
const qiongTongData = ${JSON.stringify(qiongTongData)};
const sanMingData = ${JSON.stringify(sanMingData)};
const ichingData = ${JSON.stringify(ichingData)};
const booksLibrary = ${JSON.stringify(booksLibrary)};
let localLicenseKeys = ${JSON.stringify(licenseKeys)};
const chinaCitiesData = ${JSON.stringify(chinaCitiesData)};
let localAppConfig = ${JSON.stringify(appConfigData)};
const songShaoguangData = ${JSON.stringify(songShaoguangData)};

${calendarCode}
${baziCode}
${analyzerCode}

// 易经摇卦算法
function generateIChingShake() {
  const lines = [];
  const originBits = [];
  const targetBits = [];

  for (let i = 1; i <= 6; i++) {
    const c1 = Math.random() < 0.5 ? 2 : 3;
    const c2 = Math.random() < 0.5 ? 2 : 3;
    const c3 = Math.random() < 0.5 ? 2 : 3;
    const sum = c1 + c2 + c3;
    
    let lineType = "少阳";
    let isYang = 1;
    let isChanging = false;
    let targetYang = 1;

    if (sum === 6) {
      lineType = "老阴（变）";
      isYang = 0;
      targetYang = 1;
      isChanging = true;
    } else if (sum === 7) {
      lineType = "少阳";
      isYang = 1;
      targetYang = 1;
    } else if (sum === 8) {
      lineType = "少阴";
      isYang = 0;
      targetYang = 0;
    } else if (sum === 9) {
      lineType = "老阳（变）";
      isYang = 1;
      targetYang = 0;
      isChanging = true;
    }

    lines.push({ index: i, sum, coins: [c1, c2, c3], lineType, isYang, isChanging });
    originBits.push(isYang);
    targetBits.push(targetYang);
  }

  const originCode = originBits.join("");
  const targetCode = targetBits.join("");
  const originHex = ichingData.hexagrams[originCode] || ichingData.hexagrams["111111"];
  const targetHex = ichingData.hexagrams[targetCode] || ichingData.hexagrams["000000"];

  return {
    lines,
    hasChange: originCode !== targetCode,
    origin: { code: originCode, ...originHex },
    target: originCode !== targetCode ? { code: targetCode, ...targetHex } : null
  };
}

// 统一 JSON 响应辅助函数
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}

// Cloudflare Worker Fetch 主入口
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const method = request.method;

    // CORS 预检
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }

    const ADMIN_PASSWORD = env.ADMIN_PASSWORD || "Aa666333";

    // 鉴权检查
    function checkAuth() {
      const auth = request.headers.get("Authorization") || "";
      const token = auth.replace(/^Bearer\\s+/i, "").trim();
      const queryToken = url.searchParams.get("token");
      return token === ADMIN_PASSWORD || queryToken === ADMIN_PASSWORD;
    }

    // 1. 获取城市列表
    if (pathname === "/api/cities" && method === "GET") {
      return jsonResponse({
        provinces: chinaCitiesData.provinces,
        cities: Object.keys(CITY_LONGITUDES),
        longitudes: CITY_LONGITUDES
      });
    }

    // 1.1 获取公共系统配置
    if (pathname === "/api/config" && method === "GET") {
      let cfg = localAppConfig;
      if (env.FAKA_KV) {
        try {
          const kvCfg = await env.FAKA_KV.get("app_config", "json");
          if (kvCfg) cfg = kvCfg;
        } catch(e) {}
      }
      return jsonResponse(cfg);
    }

    // 2. 八字排盘与多维报告生成
    if (pathname === "/api/bazi/calculate" && method === "POST") {
      try {
        const body = await request.json();
        const chart = fullBaZiChart(body);
        const report = generateComprehensiveReport(chart);
        return jsonResponse({ success: true, chart, report });
      } catch (err) {
        return jsonResponse({ success: false, error: err.message || "排盘计算失败" }, 400);
      }
    }

    // 3. 周易六爻起卦
    if (pathname === "/api/iching/shake" && method === "GET") {
      return jsonResponse({ success: true, ...generateIChingShake() });
    }

    // 5. 古籍藏经阁
    if (pathname === "/api/library" && method === "GET") {
      return jsonResponse(booksLibrary);
    }

    // 5.5 宋韶光 2026 丙午马年十二生肖运程
    if (pathname === "/api/zodiac/2026" && method === "GET") {
      const zodiacQuery = url.searchParams.get("zodiac");
      if (zodiacQuery && songShaoguangData.zodiacs && songShaoguangData.zodiacs[zodiacQuery]) {
        return jsonResponse({
          year: songShaoguangData.year,
          ganzhi: songShaoguangData.ganzhi,
          title: songShaoguangData.title,
          overview: songShaoguangData.overview,
          zodiac: songShaoguangData.zodiacs[zodiacQuery]
        });
      }
      return jsonResponse(songShaoguangData);
    }

    // 6. VIP 卡密验证与核销 (支持 Cloudflare KV 持久化)
    if (pathname === "/api/vip/verify" && method === "POST") {
      try {
        const { licenseKey } = await request.json();
        let keyRecord = null;

        if (env.FAKA_KV) {
          const kvVal = await env.FAKA_KV.get(licenseKey, { type: "json" });
          if (kvVal) keyRecord = kvVal;
        } else {
          keyRecord = localLicenseKeys.keys[licenseKey];
        }

        if (!keyRecord) {
          return jsonResponse({ success: false, message: "卡密不存在或输入有误" }, 400);
        }
        if (keyRecord.used) {
          return jsonResponse({ success: false, message: "该卡密已被核销使用，不可重复兑换" }, 400);
        }

        keyRecord.used = true;
        keyRecord.used_at = new Date().toISOString();

        if (env.FAKA_KV) {
          await env.FAKA_KV.put(licenseKey, JSON.stringify(keyRecord));
        }

        return jsonResponse({
          success: true,
          message: "恭喜！VIP 尊享全权限激活成功",
          licenseKey,
          type: keyRecord.type,
          perks: localLicenseKeys.system_config.vip_perks
        });
      } catch (err) {
        return jsonResponse({ success: false, message: "核销失败" }, 500);
      }
    }

    // 7. 管理员登录
    if (pathname === "/api/admin/login" && method === "POST") {
      const { password } = await request.json();
      if (password === ADMIN_PASSWORD) {
        return jsonResponse({ success: true, token: ADMIN_PASSWORD });
      }
      return jsonResponse({ success: false, message: "管理员密码错误" }, 401);
    }

    // 8. 管理员获取卡密列表
    if (pathname === "/api/admin/keys" && method === "GET") {
      if (!checkAuth()) {
        return jsonResponse({ success: false, error: "未授权" }, 401);
      }
      const keysList = Object.entries(localLicenseKeys.keys).map(([k, v]) => ({ key: k, ...v }));
      const total = keysList.length;
      const usedCount = keysList.filter(k => k.used).length;
      const unusedCount = total - usedCount;

      return jsonResponse({
        total,
        usedCount,
        unusedCount,
        vipPrice: localLicenseKeys.system_config.vip_price,
        keys: keysList.reverse()
      });
    }

    // 9. 管理员一键批量生成卡密
    if (pathname === "/api/admin/generate" && method === "POST") {
      if (!checkAuth()) {
        return jsonResponse({ success: false, error: "未授权" }, 401);
      }
      const body = await request.json();
      const count = parseInt(body.count || 10, 10);
      const prefix = (body.prefix || "FAKA").toUpperCase();
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

      function genChunk() {
        let s = "";
        for (let i = 0; i < 4; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
        return s;
      }

      const newKeys = [];
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < count; i++) {
        const k = \`\${prefix}-\${genChunk()}-\${genChunk()}-\${genChunk()}\`;
        const item = {
          type: "permanent_vip",
          created_at: today,
          used: false,
          used_at: null
        };
        localLicenseKeys.keys[k] = item;
        if (env.FAKA_KV) {
          ctx.waitUntil(env.FAKA_KV.put(k, JSON.stringify(item)));
        }
        newKeys.push(k);
      }

      return jsonResponse({ success: true, count: newKeys.length, generatedKeys: newKeys });
    }

    // 10. 管理员修改商城配置
    if (pathname === "/api/admin/config" && method === "POST") {
      if (!checkAuth()) {
        return jsonResponse({ success: false, error: "未授权" }, 401);
      }
      try {
        const body = await request.json();
        if (body.shopUrl) {
          let urlStr = body.shopUrl.trim();
          if (!urlStr.startsWith("http://") && !urlStr.startsWith("https://")) {
            urlStr = "https://" + urlStr;
          }
          localAppConfig.shopUrl = urlStr;
        }
        if (env.FAKA_KV) {
          try {
            await env.FAKA_KV.put("app_config", JSON.stringify(localAppConfig));
          } catch (e) {}
        }
        return jsonResponse({ success: true, message: "商城配置已保存并全站生效", config: localAppConfig });
      } catch (err) {
        return jsonResponse({ success: false, error: "格式错误" }, 400);
      }
    }

    // 11. 静态页面回源托管 (Cloudflare Pages 自动托管 public/ 目录)
    return env.ASSETS.fetch(request);
  }
};
`;

// 输出 _worker.js 到 public 目录（Cloudflare Pages Advanced Mode 规范）
const targetFile = path.join(PUBLIC_DIR, "_worker.js");
fs.writeFileSync(targetFile, workerTemplate, "utf-8");

console.log("==================================================");
console.log("🎉 Cloudflare Pages / Worker 打包构建成功！");
console.log("📦 输出文件: " + path.relative(__dirname, targetFile));
console.log("📊 文件大小: " + (fs.statSync(targetFile).size / 1024).toFixed(2) + " KB");
console.log("==================================================");
