export type Lesson = {
  id: string;
  track: "Foundations" | "Technical" | "Fundamental" | "Risk";
  title: string;
  minutes: number;
  summary: string;
  paragraphs: string[];
  hinglish: string;
  exercise: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};
export const lessons: Lesson[] = [
  {
    id: "ownership",
    track: "Foundations",
    title: "Think like an owner",
    minutes: 3,
    summary: "A stock is a small piece of a real business.",
    paragraphs: [
      "Owning equity gives you a residual claim on a company. Your return can come from price changes and distributions, but neither is guaranteed. A rising chart and a healthy business are different observations.",
      "For example, ten fictional shares bought at ₹100 cost ₹1,000 before fees. A later quote of ₹110 creates ₹100 of unrealised profit. You have not received that profit in cash until you sell.",
    ],
    hinglish:
      "Share kharidna company ka chhota ownership lena hai. Screen par profit dikhna aur cash mein profit milna alag cheezein hain.",
    exercise:
      "Buy a small paper position, advance one bar, then compare cash, holdings value and account equity.",
    question: "Which expression describes account equity?",
    options: [
      "Cash only",
      "Cash + marked value of holdings",
      "Total purchase cost",
      "Only realised profit",
    ],
    correct: 1,
    explanation:
      "Equity combines available cash and the current marked value of your holdings.",
  },
  {
    id: "candles",
    track: "Foundations",
    title: "Read your first candle",
    minutes: 4,
    summary: "Four prices tell a session’s story, not its exact path.",
    paragraphs: [
      "Open is the session’s first price, close its final price, and high/low the extremes. The candle body joins open and close; wicks show the range beyond it. Green means close exceeds open, not that the next candle will rise.",
      "A candle with open ₹100, high ₹108, low ₹97 and close ₹104 does not reveal whether ₹108 or ₹97 happened first. This matters when a stop and profit target both touch. The lab uses the stop first in that ambiguous case.",
    ],
    hinglish:
      "Candle ka body open-close dikhata hai; wick high-low. Green candle kal bhi green hogi, aisa promise nahi hai.",
    exercise:
      "Hover over three different candles. Compare their open, high, low, close and body sizes.",
    question: "What can daily OHLC data not tell you?",
    options: [
      "The session high",
      "The closing price",
      "The order in which high and low occurred",
      "The opening price",
    ],
    correct: 2,
    explanation:
      "OHLC gives extremes, not the exact sequence of transactions inside a session.",
  },
  {
    id: "orders",
    track: "Foundations",
    title: "Choose an order, not a wish",
    minutes: 5,
    summary: "Market, limit and stop orders trade different guarantees.",
    paragraphs: [
      "A market order seeks execution at the next eligible price. Its price is uncertain. A buy limit places a maximum price on the fill; it can remain unfilled. A stop activates after a threshold is touched and can fill beyond that threshold when prices gap.",
      "In this lab, orders submitted after a close first become eligible on the next replay bar. A buy limit at ₹100 can fill at a next open of ₹98, while a buy stop at ₹105 can fill around a gap-up open of ₹110. Fees and slippage are separate.",
    ],
    hinglish:
      "Market order mein execution pe focus hai; limit mein price control. Stop trigger price final fill price ki guarantee nahi hai.",
    exercise:
      "Place a buy limit below the current close. Step bars until it fills or cancel it.",
    question:
      "A buy limit at ₹100 encounters a next open of ₹98. What is a plausible fill?",
    options: [
      "₹105",
      "₹98, subject to the limit and execution model",
      "Always exactly ₹100",
      "It becomes a short sale",
    ],
    correct: 1,
    explanation:
      "A buy limit can receive a better price than its maximum limit.",
  },
  {
    id: "replay",
    track: "Foundations",
    title: "Practise without hindsight",
    minutes: 3,
    summary: "Make the decision before revealing the next candle.",
    paragraphs: [
      "Replay separates a decision from its outcome. Write an entry reason, choose the position size and only then reveal the next bar. Future prices are already present in a replay dataset but must not enter your visible chart or your decision.",
      "Rewinding restores the account snapshot at that point and discards its later branch. A new decision then creates a different practice path. Your learning notes remain so you can compare what changed. Repeatedly examining one scenario is practice, not an untouched test of a strategy.",
    ],
    hinglish:
      "Pehle decision lo, phir next candle dekho. Future dekh kar perfect trade banana skill ka fair test nahi hai.",
    exercise:
      "Make a trade, step five bars, rewind one step and try a different decision.",
    question: "What is hindsight bias in a replay?",
    options: [
      "Using a limit order",
      "Using future candles to justify an earlier entry",
      "Keeping a journal",
      "Paying fees",
    ],
    correct: 1,
    explanation:
      "A historical decision must be judged using information available at that time.",
  },
  {
    id: "trend",
    track: "Technical",
    title: "Find trend with moving averages",
    minutes: 4,
    summary: "SMA and EMA describe recent prices with different weights.",
    paragraphs: [
      "A simple moving average is the mean of a rolling price window. An exponential moving average gives recent observations greater weight. Both lag because they summarize information already observed. A crossover describes a change in those summaries; it does not guarantee a profitable next trade.",
      "Try a 20-session SMA with a 50-session EMA. In a trending scenario, price may remain on one side of the averages for a while. In a sideways scenario, repeated crossings can produce frequent costs and false starts.",
    ],
    hinglish:
      "Moving average trend ko simplify karta hai, future ko guarantee nahi. Sideways market mein baar-baar signals fail ho sakte hain.",
    exercise:
      "Enable SMA 20 and EMA 50, then compare a trend scenario with a sideways patch.",
    question: "Why does a moving average lag price?",
    options: [
      "It uses future prices",
      "It summarizes already observed prices",
      "It always predicts incorrectly",
      "It ignores time",
    ],
    correct: 1,
    explanation:
      "Moving averages are built from current and past observations.",
  },
  {
    id: "momentum",
    track: "Technical",
    title: "RSI: momentum needs context",
    minutes: 4,
    summary: "A high reading can persist in a strong trend.",
    paragraphs: [
      "The relative strength index compares smoothed gains with losses on a 0–100 scale. Common reference zones are 30 and 70. These are conventions, not automatic buy and sell commands. An uptrend can keep RSI elevated for many sessions.",
      "Use RSI to ask a question: is momentum strengthening or weakening relative to recent history? Then consider trend, volatility and your planned risk. Changing indicator settings after every loss can turn a replay into a search for a flattering historical fit.",
    ],
    hinglish:
      "RSI 70 ke upar aaya toh turant sell karna zaroori nahi. Trend aur risk plan ke saath context dekho.",
    exercise:
      "Turn on the RSI panel and find a period where a high reading persisted.",
    question: "RSI above 70 necessarily means…",
    options: [
      "The next candle must fall",
      "A guaranteed sell signal",
      "Strong recent upside momentum; context still matters",
      "The company is overvalued",
    ],
    correct: 2,
    explanation:
      "RSI measures price momentum, not a company’s intrinsic valuation or a guaranteed reversal.",
  },
  {
    id: "volatility",
    track: "Technical",
    title: "Bollinger Bands and uncertainty",
    minutes: 4,
    summary: "Wider bands describe a more variable recent price path.",
    paragraphs: [
      "Bollinger Bands place an envelope around a moving average using recent dispersion. This lab uses a 20-session mean with two population standard deviations. Band width expands when prices become more variable and contracts in quieter periods.",
      "A close outside a band can accompany either continuation or reversal. It is not a promise of reversion to the mean. Wider ranges also make a fixed number of shares riskier for a given stop distance.",
    ],
    hinglish:
      "Bands wide hone ka matlab recent volatility zyada hai. Band touch se sure-shot reversal assume mat karo.",
    exercise:
      "Enable bands and compare band width before and after a large candle.",
    question: "A wider band generally describes…",
    options: [
      "A guaranteed upside move",
      "More dispersion in the recent price window",
      "Lower transaction fees",
      "Higher company earnings",
    ],
    correct: 1,
    explanation:
      "Band width is based on recent price dispersion, not future direction.",
  },
  {
    id: "levels",
    track: "Technical",
    title: "Support, resistance and volume",
    minutes: 4,
    summary: "Treat levels as zones, not invisible walls.",
    paragraphs: [
      "A support or resistance zone is an area where past trading repeatedly changed direction or slowed. It is an observation about prior behavior, not an order obliging future participants. A break can continue, reverse or fail.",
      "Volume measures activity in the supplied bar. Compare it with that asset’s own recent activity rather than assuming different stocks have directly comparable share counts. In this demo both prices and volumes are fictional, so the objective is to practise a reasoning process.",
    ],
    hinglish:
      "Support-resistance exact magic lines nahi, possible zones hain. Breakout ko confirmation aur risk control ke saath evaluate karo.",
    exercise:
      "Find two prior turning areas and journal what would invalidate a hypothetical setup.",
    question: "What is a sensible way to treat support?",
    options: [
      "A guaranteed floor",
      "An observed zone that can fail",
      "A company valuation",
      "A promise from the exchange",
    ],
    correct: 1,
    explanation:
      "Historical turning areas do not prevent future prices from crossing them.",
  },
  {
    id: "statements",
    track: "Fundamental",
    title: "Read the three statements",
    minutes: 5,
    summary: "Profit, assets and cash answer different business questions.",
    paragraphs: [
      "An income statement summarizes revenue and expenses over a period. A balance sheet shows assets, liabilities and shareholders’ equity at a point in time. A cash-flow statement reconciles cash generated and used in operating, investing and financing activities.",
      "An illustrative business can report ₹20 of profit while cash is tied up in receivables. Look for whether reported earnings translate into operating cash over time. Use original filings and their notes for a real company; the lab’s company cards are fictional worked examples.",
    ],
    hinglish:
      "Revenue, profit aur cash same cheez nahi. Statements ko ek saath padho; sirf headline profit par depend mat karo.",
    exercise:
      "Open the fundamentals tab and identify revenue, profit margin and equity in the illustrative example.",
    question:
      "Which statement describes assets and liabilities at a point in time?",
    options: [
      "Balance sheet",
      "Price chart",
      "Order book",
      "Dividend calendar only",
    ],
    correct: 0,
    explanation:
      "The balance sheet is a snapshot; income and cash-flow statements cover a period.",
  },
  {
    id: "valuation",
    track: "Fundamental",
    title: "P/E is a starting point",
    minutes: 5,
    summary: "A cheap ratio can hide a shrinking business.",
    paragraphs: [
      "Earnings per share equals attributable earnings divided by the relevant weighted-average share count. Price-to-earnings divides the share price by EPS. For a fictional price of ₹200 and EPS of ₹10, P/E is 20.",
      "Compare definitions, business mix, accounting quality and earnings durability before comparing ratios. A low P/E can reflect risk or temporarily elevated earnings; a high one may reflect growth expectations that disappoint. Negative or near-zero earnings make a simple P/E comparison unhelpful.",
    ],
    hinglish:
      "Low P/E se stock automatically cheap nahi hota. Earnings sustainable hain ya temporary, yeh samajhna zaroori hai.",
    exercise:
      "Use the valuation calculator with price ₹200 and EPS ₹10, then halve EPS.",
    question: "If price stays constant and EPS halves, a positive P/E…",
    options: ["Halves", "Doubles", "Stays the same", "Becomes dividend yield"],
    correct: 1,
    explanation:
      "P/E = price ÷ EPS; halving the denominator doubles the ratio.",
  },
  {
    id: "quality",
    track: "Fundamental",
    title: "Quality, debt and return on equity",
    minutes: 5,
    summary: "Ratios work best as a connected story.",
    paragraphs: [
      "Return on equity compares earnings with shareholders’ equity. Debt-to-equity compares debt with that equity base. A higher ROE can reflect operating strength, leverage or a reduced equity denominator; the number alone cannot distinguish them.",
      "Compare several periods and an appropriate business peer group. Banks and industrial companies use balance sheets differently. Check debt maturity, cash generation and disclosure quality rather than treating one universal ratio threshold as a pass/fail rule.",
    ],
    hinglish:
      "High ROE hamesha quality ka proof nahi; leverage bhi usko badha sakta hai. Sector aur balance sheet dono dekho.",
    exercise:
      "Compare illustrative ROE and debt/equity in two sectors without selecting a winner from one metric.",
    question: "High ROE can be influenced by…",
    options: [
      "Only revenue growth",
      "Leverage and a small equity base, as well as profitability",
      "Only a rising share price",
      "The chart color",
    ],
    correct: 1,
    explanation:
      "ROE’s numerator and denominator both matter; leverage can magnify it.",
  },
  {
    id: "business",
    track: "Fundamental",
    title: "Build a business thesis",
    minutes: 5,
    summary: "Understand the source of cash and the reason you could be wrong.",
    paragraphs: [
      "Start with how a business earns money, who its customers are, and what could weaken demand or margins. Then examine capital needs, competition, management incentives and the assumptions behind any valuation. Separate an observable fact from a forecast.",
      "A useful thesis has an invalidation condition. For an illustrative metals business, commodity prices might be one sensitivity, while energy costs and production capacity are others. This is a research question, not a prediction that every metal producer has the same exposure.",
    ],
    hinglish:
      "Company paisa kaise banati hai aur thesis kis situation mein galat hogi, dono likho. Story aur verified fact alag rakho.",
    exercise:
      "Write a three-sentence thesis and one clear invalidation condition in the journal.",
    question: "A research thesis is stronger when it includes…",
    options: [
      "Only upside targets",
      "An explicit condition that could prove it wrong",
      "A promise of fixed monthly income",
      "Only social-media popularity",
    ],
    correct: 1,
    explanation:
      "An invalidation condition makes the thesis testable and helps counter confirmation bias.",
  },
  {
    id: "sizing",
    track: "Risk",
    title: "Risk first, quantity second",
    minutes: 5,
    summary: "Translate a planned loss budget into a position size.",
    paragraphs: [
      "Position sizing connects account size to the distance between entry and a hypothetical exit. In a fictional ₹100,000 account, a 1% loss budget is ₹1,000. With entry ₹100 and stop ₹95, ₹5 of price risk suggests at most 200 shares before fees and available-cash constraints.",
      "This arithmetic is a planning estimate. Gaps, fees and slippage can produce a larger loss; a stop does not insure the position. The calculator includes a per-share execution-cost estimate and caps shares by unreserved cash.",
    ],
    hinglish:
      "Pehle kitna loss tolerate karna hai decide karo, phir quantity nikalo. Stop-loss insurance nahi hai; gaps mein loss zyada ho sakta hai.",
    exercise:
      "Set a stop in the order ticket and compare 0.5%, 1% and 2% risk budgets.",
    question:
      "With a ₹1,000 budget and ₹5 per-share risk, the pre-cost maximum is…",
    options: ["20 shares", "200 shares", "2,000 shares", "Unlimited shares"],
    correct: 1,
    explanation: "₹1,000 ÷ ₹5 = 200 shares before costs, gaps and cash limits.",
  },
  {
    id: "review",
    track: "Risk",
    title: "Review process, not just wins",
    minutes: 5,
    summary: "Win rate, payoff and drawdown tell different stories.",
    paragraphs: [
      "A win rate ignores the sizes of wins and losses. Four gains of ₹100 and one loss of ₹600 produce an 80% win rate but a ₹200 loss overall. Expectancy is the mean result across completed exits; drawdown measures a decline from a prior equity peak.",
      "Review execution costs, concentration and whether you followed your written plan. Correlated positions can fall together, so a collection of ticker symbols is not automatically diversified. A short practice sequence is too small to establish an enduring edge.",
    ],
    hinglish:
      "High win rate ke baad bhi overall loss ho sakta hai. Average win/loss, drawdown, costs aur discipline saath mein review karo.",
    exercise:
      "After completing exits, inspect analytics and journal one process improvement.",
    question: "Four ₹100 wins and one ₹600 loss produce…",
    options: [
      "₹200 profit",
      "₹200 loss despite an 80% win rate",
      "₹600 profit",
      "No measurable result",
    ],
    correct: 1,
    explanation: "4 × ₹100 − ₹600 = −₹200. Win frequency alone is not enough.",
  },
];
export const resources = [
  {
    name: "SEBI Investor",
    detail: "Technical and fundamental analysis",
    url: "https://investor.sebi.gov.in/tech_fund_analysis.html",
  },
  {
    name: "NSE Learning",
    detail: "Fundamental analysis module",
    url: "https://www.nseindia.com/static/learn/self-study-ncfm-modules-intermediate-fundamental-analysis",
  },
  {
    name: "Investor.gov",
    detail: "Stock ownership and risk",
    url: "https://www.investor.gov/introduction-investing/investing-basics/investment-products/stocks",
  },
  {
    name: "Investor.gov",
    detail: "Diversification and asset allocation",
    url: "https://www.investor.gov/introduction-investing/getting-started/asset-allocation",
  },
];
