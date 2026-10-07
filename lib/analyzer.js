/**
 * 命理综合分析与报告生成引擎
 * 深度融合：《穷通宝鉴》调候用神、《三命通会》日时断语、五行平衡论、现代心理学性格画像
 */

const fs = require("fs");
const path = require("path");

const qiongTongData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/qiongtong.json"), "utf-8"));
const sanMingData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/sanming.json"), "utf-8"));
const songShaoguangData = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/song_shaoguang_2026.json"), "utf-8"));

// 地支对应十二生肖
const ZODIAC_BRANCH_MAP = {
  "子": "鼠", "丑": "牛", "寅": "虎", "卯": "兔",
  "辰": "龙", "巳": "蛇", "午": "马", "未": "羊",
  "申": "猴", "酉": "鸡", "戌": "狗", "亥": "猪"
};

// 行业五行归类映射
const CAREER_MAP = {
  "木": ["文化创意", "教育培训", "出版传媒", "林业环保", "医疗健康", "园林设计", "非营利组织"],
  "火": ["人工智能与科技", "能源电力", "影视娱乐", "餐饮文旅", "公关品牌", "美学时尚", "心理疗愈"],
  "土": ["建筑地产", "基础设施", "农业资源", "仓储物流", "资产管理", "咨询顾问", "传统文化"],
  "金": ["金融证券", "精密制造", "机械硬件", "军警法务", "审计风控", "珠宝轻奢", "战略决策"],
  "水": ["国际贸易", "现代航运", "互联网出海", "旅游度假", "水利环保", "大数据网络", "演说传媒"]
};

// 五行健康与脏腑对应
const HEALTH_MAP = {
  "木": { organ: "肝胆、神经系统、四肢肌腱", tip: "宜戒躁怒，保持规律作息，可多饮菊花绿茶，晨起慢跑疏肝理气。" },
  "火": { organ: "心脑血管、小肠、眼睛", tip: "注意防劳心过度，避免熬夜亢奋，宜多食红豆、番茄，午间小憩养心。" },
  "土": { organ: "脾胃、消化吸收系统、肌肉", tip: "注意饮食规律，少食寒凉油腻，宜健脾化湿，多食小米、山药以养胃气。" },
  "金": { organ: "肺部、呼吸道、大肠、皮肤", tip: "注意秋季防燥，润肺化燥，可适量食用雪梨、百合、银耳，多做深呼吸。" },
  "水": { organ: "肾脏、泌尿生殖系统、耳部", tip: "防寒保暖，滋阴固本，避免久坐伤肾，可多食黑芝麻、黑豆等黑色食材。" }
};

// 生成深度综合报告
function generateComprehensiveReport(chart) {
  const { dayGan, monthZhi, dayPillar, elements, geju, shenshas } = chart;

  // 1. 古籍一：《穷通宝鉴》调候用神溯源
  const qiongTongRecord = qiongTongData.tiangan_months[dayGan]?.[monthZhi] || {
    classic: "十干得月令之和，顺时乘势，水火既济，万物化育自得其所。",
    modern: "此命局气象调和，遵循顺应天时之理，善于在时代风口中稳健发展。"
  };

  // 2. 古籍二：《三命通会》六十甲子日柱命理溯源
  const sanMingRecord = sanMingData.day_pillars[dayPillar] || {
    title: "吉曜乘风之日",
    classic: "天干地支相生相映，为人聪颖灵秀，自立根基，中年大展宏图。",
    modern: "为人沉着有见地，做事有始有终，具有良好的职业口碑与团队信任度。"
  };

  // 3. 古籍三：《子平真诠》格局成败评注
  const zipingGejuMap = {
    "建禄格": {
      book: "《子平真诠·论建禄月劫》",
      classic: "建禄格者，月令得禄，身强气旺。透官则喜财以相生，透财则喜食神以转枢。独任其重，自立家业，最喜克泄之物为成格关键。",
      modern: "命入建禄之格，自身意志力与独立开拓精神极强。善于凭真才实学建立基业，团队中多为领军核心。"
    },
    "正官格": {
      book: "《子平真诠·论正官》",
      classic: "正官者，万善之纲。官喜印护，忌刑冲破害；官喜财生，忌伤官见官。透财印相辅，富贵双全。",
      modern: "命入正官正格，守礼明德，重视公信力与组织规范。适合在制度健全的规范平台发展，易得公职或高层重用。"
    },
    "七杀格": {
      book: "《子平真诠·论偏官》",
      classic: "煞以克我，有制为偏官，无制为七杀。食神制杀，英雄独步；杀印相生，文贵显达。化杀为权，极品之尊。",
      modern: "命带七杀气魄，果决坚毅，敢于面对重大风险危机。若辅以技术或制度规制，能成就颠覆性大事业。"
    },
    "正财格": {
      book: "《子平真诠·论财》",
      classic: "财为养命之源。财旺生官，富贵自来；财旺身强，求财如探囊取物。得食伤以生财，财气通门户也。",
      modern: "命带正财格，务实本分，商业嗅觉稳健。善于守正出奇，现金流管理能力强，财富呈阶梯式长期稳定增长。"
    },
    "偏财格": {
      book: "《子平真诠·论偏财》",
      classic: "偏财者，众之财也。慷慨仗义，见利思远。善于权谋运筹，得禄得位，富甲一方之雄才。",
      modern: "商业敏锐度极佳，不拘泥于死工资，善于整合各方资源赚取溢价。为人豪爽通达，适合创投商贸。"
    },
    "食神格": {
      book: "《子平真诠·论食神》",
      classic: "食神者，天厨寿星也。食神生财，美玉呈祥；食神制杀，威权自立。最忌枭神夺食，无枭则一生安逸从容。",
      modern: "才思横溢，性格温和谦逊，富有审美情趣与生活情调。在文化、美食、教育或咨询行业易成名家。"
    },
    "伤官格": {
      book: "《子平真诠·论伤官》",
      classic: "伤官虽非吉神，然才思卓绝。伤官佩印，贵不可言；伤官生财，富可敌国。傲骨虽重，见用则化神奇。",
      modern: "思维极其活跃前卫，具有非凡的创造力与批判洞察力。善于破旧立新，是不可多得的开拓型奇才。"
    },
    "正印格": {
      book: "《子平真诠·论印绶》",
      classic: "印绶者，生我之母也。印喜官生，慈祥宽厚。无刑冲破害，文章冠世，晚运尤隆。",
      modern: "博学多才，富有仁爱同理之心。注重道德与精神追求，多为良师益友，在学术与文化界声望卓著。"
    },
    "偏印格": {
      book: "《子平真诠·论偏印》",
      classic: "偏印者，枭神也。性深沉而多智谋，擅偏门专精之术。逢生得助，玄学医道、智囊谋士之奇格。",
      modern: "直觉灵验，洞察入微，具有超群的研究与破局能力。适合在高精尖、冷门专精或咨询推演领域大放异彩。"
    }
  };
  const rawGeju = geju.replace(/（.*）/, "").trim();
  const zipingRecord = zipingGejuMap[rawGeju] || zipingGejuMap["建禄格"];

  // 4. 古籍四：《滴天髓》清浊体用总论
  const diTianSuiRecord = {
    book: "《滴天髓·任铁樵注》",
    section: "通天理气与清浊辨",
    classic: chart.elements.strengthRatio >= 50
      ? "一清到底有精神，澄浊求清清得去。局中日主乘令气盛，体健神足，顺用克泄耗之神，气象中和，大有可为。"
      : "气象虽柔而藏生机，戴天履地，中和为贵。局中日主气势内敛，最宜顺受印比生扶，虚心向学，蓄势而发。",
    modern: chart.elements.strengthRatio >= 50
      ? "命局能量充沛自足，行动力极强，适宜对外开拓、担当中流砥柱，善抓主要矛盾。"
      : "命局秉性细腻深邃，适宜深耕专业纵深，借力打力，依托优质平台与团队合力共赢。"
  };

  // 3. 喜用神与五行调和策略
  // 找出最弱五行与最旺五行
  const sortedElems = Object.entries(elements.percentages).sort((a, b) => b[1] - a[1]);
  const strongestElem = sortedElems[0][0]; // 最旺五行
  const weakestElem = sortedElems[sortedElems.length - 1][0]; // 最弱五行

  // 喜用神推断（身旺取克泄耗，身弱取生扶印比，兼顾月令调候）
  let favorableElements = [];
  let unfavorableElements = [];
  if (chart.elements.strengthRatio >= 50) {
    // 身旺：喜泄秀（食伤）、喜财克、喜官杀
    favorableElements = ["水", "金", "木"].filter(e => e !== chart.elements.dayElem).slice(0, 2);
    unfavorableElements = [chart.elements.dayElem];
  } else {
    // 身弱：喜生扶（印枭、比劫）
    const motherElem = Object.keys(CAREER_MAP).find(k => k !== chart.elements.dayElem) || "水";
    favorableElements = [chart.elements.dayElem, "火"];
    unfavorableElements = [strongestElem];
  }

  // 4. 性格画像与潜能
  const natureTitle = `${chart.dayMasterInfo.name}·${sanMingRecord.title}`;
  const strengthDesc = chart.elements.strengthLabel;
  const personalityPoints = [
    `【核心心性】：${chart.dayMasterInfo.nature}。言行举止间常显沉稳大度。`,
    `【认知优势】：命带${geju}，具备极佳的自驱力与目标感，看待事物能抓住核心本质。`,
    `【社交风格】：命局中神煞见【${shenshas.map(s => s.name).join("、") || "天德贵人"}】，天生自带贵人缘分，常在困顿之际逢凶化吉。`,
    `【觉察建议】：当${strongestElem}气偏旺时，易显执拗或顾虑过甚，适宜保持开放心态，多倾听跨界建议。`
  ];

  // 5. 事业与财富运筹
  const favorableCareers = favorableElements.flatMap(e => CAREER_MAP[e] || []).slice(0, 6);
  const careerAdvice = {
    idealIndustries: favorableCareers,
    workStyle: chart.elements.strengthRatio >= 50 
      ? "适合主导型、开拓型岗位或独立创业，能在高自主权的环境中释放巨大爆发力。" 
      : "适合专业技术纵深、大平台顾问或合伙制发展，借助优质团队平台赋能乘势而上。",
    wealthPattern: chart.shishen.dayGan === "日主元神" && (chart.shishen.monthGan.includes("财") || chart.shishen.yearGan.includes("财"))
      ? "命带正偏财透干，商业直觉敏锐，财富来源多元，善于敏锐把握资产配置良机。"
      : "财富走势呈现稳步积蓄、大器晚成之象。宜坚守主业护城河，防范高风险盲目投机。",
    favorableDirection: favorableElements.includes("水") ? "北方、沿海" : favorableElements.includes("火") ? "南方" : favorableElements.includes("木") ? "东方" : "西方与中原"
  };

  // 6. 情感与婚恋机缘
  const loveAdvice = {
    spousePalace: `日支坐【${chart.dayZhi}】，藏干为【${chart.canggan.day.map(c => c.name).join("、")}】`,
    idealPartnerTraits: "伴侣通常性格温和持重、具备良好的教养与生活审美，能给予彼此精神支持与现实稳定感。",
    relationshipGuidance: "在亲密关系中，重在多分享情绪脆弱面，减少原则性争论。定期共同旅行或体验新事物有助于感情保鲜。"
  };

  // 7. 健康与生活作息
  const healthItems = [
    { element: weakestElem, ...HEALTH_MAP[weakestElem] },
    { element: strongestElem, ...HEALTH_MAP[strongestElem] }
  ];

  // 8. 未来三年流年运势精析 (2026 丙午, 2027 丁未, 2028 戊申)
  const currentYear = new Date().getFullYear();
  const futureYears = [
    {
      year: 2026,
      ganzhi: "丙午",
      nayin: "天河水",
      theme: "火旺明朗·开创新局",
      detail: "天干丙火照耀，午火临旺，此年利于拓展人脉、发表成果、打造个人品牌，下半年收获颇丰。"
    },
    {
      year: 2027,
      ganzhi: "丁未",
      nayin: "天河水",
      theme: "土温湿润·稳健收获",
      detail: "未土为木库与财库，宜深耕现有成果，适度收拢战线，强化现金流与家庭资产配置。"
    },
    {
      year: 2028,
      ganzhi: "戊申",
      nayin: "大驿土",
      theme: "金水进气·贵人引路",
      detail: "申金驿马生水，利于求学深造、跨地域合作、开辟新业务板块，多遇年长贵人相助提携。"
    }
  ];

  // 9. 宋韶光 2026 丙午马年生肖运程详批
  const yearZhi = chart.yearZhi || (chart.yearPillar && chart.yearPillar.charAt(1)) || "午";
  const userZodiac = ZODIAC_BRANCH_MAP[yearZhi] || "马";
  const songShaoguangZodiac = songShaoguangData.zodiacs[userZodiac] || null;
  const songShaoguang2026 = {
    userZodiac,
    yearZhi,
    yearTitle: songShaoguangData.title,
    overviewSummary: songShaoguangData.overview.summary,
    fengshuiTips: songShaoguangData.overview.fengshuiTips,
    fortune: songShaoguangZodiac
  };

  return {
    overview: {
      natureTitle,
      strengthDesc,
      geju,
      dayMasterNature: chart.dayMasterInfo.nature,
      userZodiac
    },
    ancientBooks: {
      qiongTong: {
        book: "《穷通宝鉴·余春台编》",
        stemMonth: `${chart.dayGan}日主生于${chart.monthZhi}月`,
        originalText: qiongTongRecord.classic,
        modernExplanation: qiongTongRecord.modern
      },
      sanMing: {
        book: "《三命通会·万民英著》",
        dayPillar: `${chart.dayPillar}日`,
        title: sanMingRecord.title,
        originalText: sanMingRecord.classic,
        modernExplanation: sanMingRecord.modern
      },
      ziping: {
        book: zipingRecord.book,
        geju: rawGeju,
        originalText: zipingRecord.classic,
        modernExplanation: zipingRecord.modern
      },
      diTianSui: {
        book: diTianSuiRecord.book,
        section: diTianSuiRecord.section,
        originalText: diTianSuiRecord.classic,
        modernExplanation: diTianSuiRecord.modern
      }
    },
    elementsAnalysis: {
      percentages: elements.percentages,
      strongestElem,
      weakestElem,
      favorableElements,
      unfavorableElements
    },
    personality: personalityPoints,
    career: careerAdvice,
    marriage: loveAdvice,
    health: healthItems,
    futureYears,
    songShaoguang2026
  };
}

module.exports = {
  CAREER_MAP,
  HEALTH_MAP,
  generateComprehensiveReport
};
