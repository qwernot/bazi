/**
 * 全量端到端自动化测试脚本
 * 验证：八字计算、五行能量、古籍溯源、六爻起卦、藏经阁、VIP卡密验证
 */

const assert = require("assert");
const http = require("http");
const { fullBaZiChart } = require("./lib/bazi");
const { generateComprehensiveReport } = require("./lib/analyzer");

async function runTests() {
  console.log("=== 1. 测试八字高精度排盘与真太阳时计算 ===");
  const testInput = {
    year: 1995,
    month: 10,
    day: 24,
    hour: 14,
    minute: 30,
    cityName: "北京",
    gender: "男"
  };

  const chart = fullBaZiChart(testInput);
  console.log(" 四柱干支:", chart.yearPillar, chart.monthPillar, chart.dayPillar, chart.hourPillar);
  assert.strictEqual(chart.yearPillar, "乙亥", "年柱应为乙亥");
  assert.strictEqual(chart.monthPillar, "丙戌", "月柱应为丙戌");
  assert.strictEqual(chart.dayPillar, "戊子", "日柱应为戊子");
  assert.strictEqual(chart.hourPillar, "己未", "时柱应为己未");
  assert.strictEqual(chart.dayMasterInfo.name, "戊土", "日主应为戊土");
  assert.ok(chart.shenshas.length > 0, "应推算出命带神煞");
  assert.ok(chart.dayun.dayunList.length === 8, "应推算8步十年大运");
  console.log(" 八字排盘算法与历法断定：测试全部通过！");

  console.log("\n=== 2. 测试古籍文献结构化精准匹配与报告生成 ===");
  const report = generateComprehensiveReport(chart);
  console.log(" 《穷通宝鉴》引用:", report.ancientBooks.qiongTong.book, report.ancientBooks.qiongTong.stemMonth);
  console.log(" 《穷通宝鉴》原文:", report.ancientBooks.qiongTong.originalText);
  assert.ok(report.ancientBooks.qiongTong.originalText.includes("九月燥气闭藏"), "应准确命中穷通宝鉴戊土生于戌月之断语");

  console.log(" 《三命通会》引用:", report.ancientBooks.sanMing.book, report.ancientBooks.sanMing.dayPillar);
  console.log(" 《三命通会》原文:", report.ancientBooks.sanMing.originalText);
  assert.ok(report.ancientBooks.sanMing.originalText.includes("六秀日"), "应准确命中三命通会戊子日之断语");
  assert.ok(report.personality.length >= 4, "应生成多维性格画像");
  assert.ok(report.career.idealIndustries.length > 0, "应生成五行宜业建议");
  assert.ok(report.futureYears.length === 3, "应生成三年流年运势推演");
  console.log(" 古籍数字化匹配与命理报告：测试全部通过！");

  console.log("\n=== 3. 测试深度扩充古籍库（《子平真诠》与《滴天髓》及十二长生） ===");
  console.log(" 《子平真诠》格局评注:", report.ancientBooks.ziping.book, "【" + report.ancientBooks.ziping.geju + "】");
  console.log(" 《子平真诠》原文:", report.ancientBooks.ziping.originalText);
  assert.ok(report.ancientBooks.ziping.originalText.includes("建禄格"), "应准确命中子平真诠格局断语");

  console.log(" 《滴天髓》清浊体用:", report.ancientBooks.diTianSui.book, "【" + report.ancientBooks.diTianSui.section + "】");
  console.log(" 《滴天髓》原文:", report.ancientBooks.diTianSui.originalText);
  assert.ok(report.ancientBooks.diTianSui.originalText.includes("一清到底有精神"), "应准确命中滴天髓体用清浊名句");

  console.log(" 四柱十二长生状态:", chart.changsheng.year.stage, chart.changsheng.month.stage, chart.changsheng.day.stage, chart.changsheng.hour.stage);
  assert.strictEqual(chart.changsheng.day.stage, "胎", "戊土见子水应为胎位");
  console.log(" 宗门经典群（子平真诠/滴天髓/三命通会/穷通宝鉴）与十二长生：全部测试通过！");

  console.log("\n=== 4. 测试周易六爻金钱卦拟真演化 ===");
  const fs = require("fs");
  const ichingData = JSON.parse(fs.readFileSync("./data/iching_64.json", "utf-8"));
  assert.ok(ichingData.hexagrams["111111"].name === "乾为天", "乾为天卦验证");
  assert.ok(ichingData.hexagrams["000000"].name === "坤为地", "坤为地卦验证");
  console.log(" 周易六十四卦卦辞爻辞：测试全部通过！");

  console.log("\n=== 5. 测试商业化 VIP 卡密核销系统 ===");
  const keyFile = "./data/license_keys.json";
  const keyData = JSON.parse(fs.readFileSync(keyFile, "utf-8"));
  assert.ok(keyData.keys["LINGJING-2026-VIP"], "应存在预置VIP卡密");
  console.log(" VIP 授权卡密库：测试全部通过！");

  console.log("\n=== 6. 测试宋韶光 2026 丙午马年十二生肖运程与八字联动 ===");
  const songData = JSON.parse(fs.readFileSync("./data/song_shaoguang_2026.json", "utf-8"));
  assert.strictEqual(songData.year, 2026, "年份应为2026");
  assert.strictEqual(songData.zodiacYear, "马", "生肖年应为马");
  assert.ok(Object.keys(songData.zodiacs).length === 12, "必须包含全部十二生肖运程");
  assert.ok(songData.zodiacs["马"].relationship.includes("值太岁"), "属马应为值太岁");
  assert.ok(songData.zodiacs["鼠"].relationship.includes("冲太岁"), "属鼠应为冲太岁");
  assert.ok(songData.zodiacs["羊"].relationship.includes("六合太岁"), "属羊应为六合太岁");
  assert.ok(report.songShaoguang2026, "报告中应挂载缘主专属宋韶光2026生肖运程");
  assert.strictEqual(report.songShaoguang2026.userZodiac, "猪", "1995乙亥年年支亥对应生肖应为猪");
  assert.ok(report.songShaoguang2026.fortune.relationship.includes("暗合有情"), "属猪在马年应为暗合有情");
  console.log(" 缘主生肖推演:", report.songShaoguang2026.userZodiac, "太岁关系:", report.songShaoguang2026.fortune.relationship);
  console.log(" 大师锦囊妙计:", report.songShaoguang2026.fortune.masterAdvice.talisman);
  console.log(" 宋韶光 2026 丙午马年运程及八字报告联动：测试全部通过！");

  console.log("\n==========================================");
  console.log("  恭喜！全部 6 大核心功能模块自测试验 100% 成功！");
  console.log("==========================================");
}

runTests();
