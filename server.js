/**
 * 灵境玄机阁 - 周易八字国学智能测算平台核心服务
 * 原生 Node.js 架构，高性能轻量，零第三方依赖，开箱即用
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const { CITY_LONGITUDES } = require("./lib/calendar");
const { fullBaZiChart } = require("./lib/bazi");
const { generateComprehensiveReport } = require("./lib/analyzer");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");

// 静态文件 MIME 类型映射
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// 辅助：解析 JSON 请求体
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
      if (body.length > 1e6) { // 限制 1MB
        req.connection.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

// 辅助：统一发送 JSON 响应
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  });
  res.end(JSON.stringify(data));
}

// 静态文件服务
function serveStatic(req, res, pathname) {
  let safePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  // 防路径遍历
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
  });
}

// 易经摇卦计算逻辑
function generateIChingShake() {
  const ichingData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "iching_64.json"), "utf-8"));
  
  // 6次投掷（从初爻到上爻）
  // 每次三枚铜钱：正为3，背为2
  // 总和：6(老阴,变), 7(少阳), 8(少阴), 9(老阳,变)
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

    if (sum === 6) { // 老阴，变阳
      lineType = "老阴（变）";
      isYang = 0;
      targetYang = 1;
      isChanging = true;
    } else if (sum === 7) { // 少阳，不变
      lineType = "少阳";
      isYang = 1;
      targetYang = 1;
    } else if (sum === 8) { // 少阴，不变
      lineType = "少阴";
      isYang = 0;
      targetYang = 0;
    } else if (sum === 9) { // 老阳，变阴
      lineType = "老阳（变）";
      isYang = 1;
      targetYang = 0;
      isChanging = true;
    }

    lines.push({ index: i, sum, coins: [c1, c2, c3], lineType, isYang, isChanging });
    originBits.push(isYang);
    targetBits.push(targetYang);
  }

  // 卦由下至上排列，对应 6 位二进制码
  const originCode = originBits.join("");
  const targetCode = targetBits.join("");

  const originHex = ichingData.hexagrams[originCode] || ichingData.hexagrams["111111"];
  const targetHex = ichingData.hexagrams[targetCode] || ichingData.hexagrams["000000"];

  return {
    lines,
    hasChange: originCode !== targetCode,
    origin: {
      code: originCode,
      ...originHex
    },
    target: originCode !== targetCode ? {
      code: targetCode,
      ...targetHex
    } : null
  };
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // CORS 预检
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    });
    res.end();
    return;
  }

  // 1. API: 获取城市列表与真太阳时经度
  if (pathname === "/api/cities" && method === "GET") {
    let provinces = [];
    try {
      const cData = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "china_cities.json"), "utf-8"));
      provinces = cData.provinces || [];
    } catch(e) {}
    return sendJson(res, 200, {
      provinces: provinces,
      cities: Object.keys(CITY_LONGITUDES),
      longitudes: CITY_LONGITUDES
    });
  }

  // 1.1 API: 获取公共配置（发卡商城地址等）
  if (pathname === "/api/config" && method === "GET") {
    try {
      const cfgPath = path.join(DATA_DIR, "app_config.json");
      let cfg = { shopUrl: "https://shop.swicv.com" };
      if (fs.existsSync(cfgPath)) {
        cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8"));
      }
      return sendJson(res, 200, cfg);
    } catch (e) {
      return sendJson(res, 200, { shopUrl: "https://shop.swicv.com" });
    }
  }

  // 2. API: 八字排盘与多维报告生成
  if (pathname === "/api/bazi/calculate" && method === "POST") {
    try {
      const body = await parseJsonBody(req);
      const chart = fullBaZiChart(body);
      const report = generateComprehensiveReport(chart);
      return sendJson(res, 200, {
        success: true,
        chart,
        report
      });
    } catch (err) {
      console.error("Bazi error:", err);
      return sendJson(res, 400, { success: false, error: err.message || "排盘计算失败" });
    }
  }



  // 4. API: 周易六爻金钱卦
  if (pathname === "/api/iching/shake" && method === "GET") {
    try {
      const shakeResult = generateIChingShake();
      return sendJson(res, 200, { success: true, ...shakeResult });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: err.message });
    }
  }

  // 5. API: 古籍藏经阁典籍列表与内容
  if (pathname === "/api/library" && method === "GET") {
    try {
      const libPath = path.join(DATA_DIR, "books_library.json");
      const libData = JSON.parse(fs.readFileSync(libPath, "utf-8"));
      return sendJson(res, 200, libData);
    } catch (err) {
      return sendJson(res, 500, { error: "读取古籍库失败" });
    }
  }

  // 5.5 API: 宋韶光 2026 丙午马年十二生肖运程
  if (pathname === "/api/zodiac/2026" && method === "GET") {
    try {
      const zFile = path.join(DATA_DIR, "song_shaoguang_2026.json");
      const zData = JSON.parse(fs.readFileSync(zFile, "utf-8"));
      const zodiacQuery = parsedUrl.query.zodiac;
      if (zodiacQuery && zData.zodiacs[zodiacQuery]) {
        return sendJson(res, 200, {
          year: zData.year,
          ganzhi: zData.ganzhi,
          title: zData.title,
          overview: zData.overview,
          zodiac: zData.zodiacs[zodiacQuery]
        });
      }
      return sendJson(res, 200, zData);
    } catch (err) {
      return sendJson(res, 500, { error: "读取宋韶光马年运程失败" });
    }
  }

  // 6. API: 商业化卡密验证与兑换
  if (pathname === "/api/vip/verify" && method === "POST") {
    try {
      const { licenseKey } = await parseJsonBody(req);
      const keyFile = path.join(DATA_DIR, "license_keys.json");
      const keyData = JSON.parse(fs.readFileSync(keyFile, "utf-8"));

      const keyRecord = keyData.keys[licenseKey];
      if (!keyRecord) {
        return sendJson(res, 400, { success: false, message: "卡密不存在或输入有误，请核对后再试" });
      }
      if (keyRecord.used) {
        return sendJson(res, 400, { success: false, message: "该卡密已被核销使用，不可重复兑换" });
      }

      // 核销并写入
      keyRecord.used = true;
      keyRecord.used_at = new Date().toISOString();
      fs.writeFileSync(keyFile, JSON.stringify(keyData, null, 2), "utf-8");

      return sendJson(res, 200, {
        success: true,
        message: "恭喜！VIP 尊享全权限激活成功",
        licenseKey,
        type: keyRecord.type,
        perks: keyData.system_config.vip_perks
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: "卡密核销失败" });
    }
  }

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Aa666333";

// 辅助：校验管理员权限
function checkAdminAuth(req) {
  const authHeader = req.headers["authorization"] || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const queryToken = url.parse(req.url, true).query.token;
  return token === ADMIN_PASSWORD || queryToken === ADMIN_PASSWORD;
}

  // 7. API: 管理员登录验证
  if (pathname === "/api/admin/login" && method === "POST") {
    try {
      const { password } = await parseJsonBody(req);
      if (password === ADMIN_PASSWORD) {
        return sendJson(res, 200, { success: true, token: ADMIN_PASSWORD });
      } else {
        return sendJson(res, 401, { success: false, message: "管理员密码错误" });
      }
    } catch (err) {
      return sendJson(res, 400, { success: false, message: "请求格式错误" });
    }
  }

  // 8. API: 管理员获取卡密列表与统计
  if (pathname === "/api/admin/keys" && method === "GET") {
    if (!checkAdminAuth(req)) {
      return sendJson(res, 401, { success: false, error: "未授权：请先输入管理员密码" });
    }
    try {
      const keyFile = path.join(DATA_DIR, "license_keys.json");
      const keyData = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
      const keysList = Object.entries(keyData.keys).map(([k, v]) => ({
        key: k,
        ...v
      }));
      const total = keysList.length;
      const usedCount = keysList.filter(k => k.used).length;
      const unusedCount = total - usedCount;

      return sendJson(res, 200, {
        total,
        usedCount,
        unusedCount,
        vipPrice: keyData.system_config.vip_price,
        keys: keysList.reverse() // 最新的排在前面
      });
    } catch (err) {
      return sendJson(res, 500, { error: "读取卡密库失败" });
    }
  }

  // 9. API: 管理员一键批量生成卡密
  if (pathname === "/api/admin/generate" && method === "POST") {
    if (!checkAdminAuth(req)) {
      return sendJson(res, 401, { success: false, error: "未授权：请先输入管理员密码" });
    }
    try {
      const body = await parseJsonBody(req);
      const count = parseInt(body.count || 10, 10);
      const prefix = (body.prefix || "FAKA").toUpperCase();
      const crypto = require("crypto");

      const keyFile = path.join(DATA_DIR, "license_keys.json");
      const keyData = JSON.parse(fs.readFileSync(keyFile, "utf-8"));

      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      function genKey() {
        let chunk = () => {
          let s = "";
          const bytes = crypto.randomBytes(4);
          for (let i = 0; i < 4; i++) s += chars[bytes[i] % chars.length];
          return s;
        };
        return `${prefix}-${chunk()}-${chunk()}-${chunk()}`;
      }

      const newKeys = [];
      const today = new Date().toISOString().slice(0, 10);
      for (let i = 0; i < count; i++) {
        let k = genKey();
        while (keyData.keys[k]) k = genKey();
        keyData.keys[k] = {
          type: "permanent_vip",
          created_at: today,
          used: false,
          used_at: null
        };
        newKeys.push(k);
      }

      fs.writeFileSync(keyFile, JSON.stringify(keyData, null, 2), "utf-8");

      return sendJson(res, 200, {
        success: true,
        count: newKeys.length,
        generatedKeys: newKeys
      });
    } catch (err) {
      return sendJson(res, 500, { error: "生成卡密失败" });
    }
  }

  // 10. API: 管理员修改商城配置
  if (pathname === "/api/admin/config" && method === "POST") {
    if (!checkAdminAuth(req)) {
      return sendJson(res, 401, { success: false, error: "未授权：请先输入管理员密码" });
    }
    try {
      const body = await parseJsonBody(req);
      const cfgPath = path.join(DATA_DIR, "app_config.json");
      let cfg = { shopUrl: "https://shop.swicv.com" };
      if (fs.existsSync(cfgPath)) {
        try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf-8")); } catch(e) {}
      }
      if (body.shopUrl) {
        let urlStr = body.shopUrl.trim();
        if (!/^https?:\/\//i.test(urlStr)) {
          urlStr = "https://" + urlStr;
        }
        cfg.shopUrl = urlStr;
      }
      fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2), "utf-8");
      return sendJson(res, 200, { success: true, message: "商城配置已保存并立即生效", config: cfg });
    } catch (err) {
      return sendJson(res, 500, { success: false, error: "保存配置失败" });
    }
  }

  // 7. 静态页面与资源兜底
  serveStatic(req, res, pathname);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`====================================================`);
  console.log(`  灵境玄机阁 · 周易八字国学智能测算平台已启动运行`);
  console.log(`  访问地址: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
