/* 六级真题风格题库 · 选词填空（仿真题，题材与难度参照 CET-6 长篇阅读 Section A）
   每卷：词库 15 词，选 10 词填入文中 [1]-[10] 空格，每词限用一次、无需变形。 */
const CLOZE_TESTS = [
{
  title: "选词填空 · 卷一：人工智能与工作",
  bank: ["adapt", "challenge", "certain", "create", "demand", "displace", "economists", "enable", "expand", "impact", "inevitable", "investment", "optimistic", "shift", "transform"],
  answers: { 1: "transform", 2: "economists", 3: "displace", 4: "optimistic", 5: "create", 6: "challenge", 7: "enable", 8: "investment", 9: "adapt", 10: "certain" },
  paragraphs: [
    "Artificial intelligence is beginning to [1] the way we work and live. While some [2] warn that automation will [3] millions of workers from their jobs, others are far more [4] about the future. They argue that every technological revolution in history has managed to [5] new industries and entirely new forms of employment. The real [6], they believe, is to [7] workers to move from repetitive tasks to more creative and meaningful ones. Governments are therefore urged to increase [8] in education and retraining, so that the workforce can [9] to a changing economy. What seems [10] is that machines will transform the nature of work itself; the question is whether our schools can keep pace."
  ]
},
{
  title: "选词填空 · 卷二：气候变化",
  bank: ["adopt", "alarming", "consume", "dramatically", "effects", "elusive", "fossil", "funding", "predict", "subsidy", "support", "sustainable", "transition", "urgent", "volatile"],
  answers: { 1: "urgent", 2: "predict", 3: "dramatically", 4: "effects", 5: "fossil", 6: "sustainable", 7: "transition", 8: "funding", 9: "support", 10: "elusive" },
  paragraphs: [
    "Climate change has become one of the most [1] challenges facing humanity. Scientists [2] that global temperatures will continue to rise unless greenhouse gas emissions are [3] reduced. The [4] are already visible everywhere: melting glaciers, rising sea levels, and increasingly frequent extreme weather. Many experts argue that relying on [5] fuels is no longer [6] in the long run; instead, countries must invest heavily in renewable energy such as solar and wind power. However, the [7] to a green economy requires enormous [8] and close international cooperation. Developing nations, in particular, need financial and technological [9] from richer countries. Without such joint efforts, the goal of carbon neutrality may remain [10] for decades to come."
  ]
},
{
  title: "选词填空 · 卷三：在线教育",
  bank: ["access", "actively", "combination", "committed", "deliver", "design", "fail", "grown", "helping", "memorization", "provide", "take", "weaken", "widen", "worthwhile"],
  answers: { 1: "grown", 2: "take", 3: "deliver", 4: "helping", 5: "fail", 6: "weaken", 7: "combination", 8: "actively", 9: "committed", 10: "memorization" },
  paragraphs: [
    "Over the past decade, online education has [1] rapidly across the globe. Millions of learners now [2] courses offered by top universities without leaving their homes. Advocates argue that the Internet can [3] high-quality education to remote areas, [4] to narrow the gap between rich and poor regions. Critics, however, point out that online learning demands strong self-discipline, and many students [5] to complete their courses. They also worry that long hours of screen-based study may [6] face-to-face communication skills. Most educators agree that the future lies in a [7] of traditional and digital methods, and universities are [8] encouraged to redesign their courses rather than simply moving lectures online. Whatever form it takes, education must remain [9] to cultivating independent thinkers, not merely the [10] of facts and figures."
  ]
}
];
