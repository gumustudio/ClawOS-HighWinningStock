/**
 * GuideTab — 系统说明页
 * 基于当前真实后端逻辑整理，避免 UI 文案继续沿用旧版本策略语义。
 */

const TIMELINE: {
  time: string
  label: string
  desc: string
  color: string
  icon: string
}[] = [
  {
    time: '07:30',
    label: '晨间补充分析',
    desc: '自动补充前一交易日夜间新增的公告、新闻和舆情数据，只运行数据采集与 LLM 信息提取两段，并把结果合并回前一交易日的 FactPool，供 08:05 盘前分析使用。',
    color: 'bg-sky-500',
    icon: '🌅',
  },
  {
    time: '08:05',
    label: '盘前每日分析',
    desc: '自动刷新中证500股票池与行情，构建市场状态，完成硬过滤、事件驱动补池、重大事件一票否决、45 位专家投票、技术分、量化分和 Conviction Filter，生成今日信号、持仓复评、换仓建议，并落盘保存。',
    color: 'bg-blue-500',
    icon: '🔍',
  },
  {
    time: '09:25',
    label: '盘中监控启动',
    desc: '自动启动盘中监控。系统先立即轮询一次持仓，再进入每 60 秒一次的监控节奏。只在交易时段内真正执行自动平仓。',
    color: 'bg-green-500',
    icon: '📡',
  },
  {
    time: '09:31',
    label: '开盘自动执行',
    desc: '自动执行今日系统信号：`strong_buy` 会按推荐顺序自动买入，`buy/watch` 会自动标记为系统忽略。自动执行只处理尚未被你人工处理过的系统信号。',
    color: 'bg-emerald-500',
    icon: '⚡',
  },
  {
    time: '09:30 - 15:00',
    label: '盘中实时刷新',
    desc: '交易时段内每 5 分钟刷新一次 `signal.realtime`，用于前端显示实时价格、涨跌幅、OHLC；15:00 还会再抓一次收盘定格价。该实时字段独立于盘前 snapshot，不会覆盖历史分析基准。',
    color: 'bg-teal-500',
    icon: '🔄',
  },
  {
    time: '交易时段内',
    label: '盘中风险监控',
    desc: '监控止损提醒、自动止损平仓、自动止盈平仓、止盈提醒、超期持仓、异常波动和板块异动。只有你在全局设置中配置的盘中自动止损/止盈阈值会直接触发自动平仓，其余大多属于提醒类规则。',
    color: 'bg-amber-500',
    icon: '🛡️',
  },
  {
    time: '15:05',
    label: '盘中监控停止',
    desc: '收盘后自动停止盘中监控，结束持仓轮询。',
    color: 'bg-slate-400',
    icon: '⏹️',
  },
  {
    time: '16:00',
    label: '盘后分析',
    desc: '自动进入最长 3 小时的盘后批处理窗口：刷新收盘数据、重评持仓、重算组合风控、运行 8 个数据采集 Agent、3 个 LLM 提取 Agent、当日记忆结算与专家表现同步，并把结果保存到次日可用的本地文件。',
    color: 'bg-purple-500',
    icon: '🧠',
  },
  {
    time: '17:00 (周五)',
    label: '自动周报',
    desc: '每周五收盘后自动生成周度报告，汇总交易统计、收益、胜率、回撤和模型组表现。',
    color: 'bg-indigo-500',
    icon: '📋',
  },
  {
    time: '17:30 (月末)',
    label: '自动月报',
    desc: '每月最后一个自然月末交易日自动生成月报，并触发长期记忆更新。长期记忆会从中期记忆里提炼专家的长期教训、强项和弱项。',
    color: 'bg-pink-500',
    icon: '📑',
  },
]

const PAGE_TABLE: { name: string; desc: string; badge: string }[] = [
  { name: '总览看板', desc: '市场状态、运行状态、关键通知历史、今日建议、风险横幅和系统健康度', badge: 'bg-blue-100 text-blue-700' },
  { name: '每日策略', desc: '今日信号、三流评分、事件与否决原因、持仓卖出建议，以及确认/推翻/忽略/自动执行入口', badge: 'bg-green-100 text-green-700' },
  { name: '自选股票', desc: '搜索 A 股全市场股票，自建观察列表，查看实时 OHLC 与 K 线，不参与自动交易', badge: 'bg-yellow-100 text-yellow-700' },
  { name: '持仓风控', desc: '实时盈亏、组合风控状态、风险事件、持仓动作建议、减仓/平仓入口', badge: 'bg-red-100 text-red-700' },
  { name: '行为画像', desc: '统计你对系统信号的执行、推翻、忽略与纪律表现', badge: 'bg-violet-100 text-violet-700' },
  { name: '记忆复盘', desc: '周/月汇总、交易记录、观望日志、累计表现、模型组表现与学习结果', badge: 'bg-amber-100 text-amber-700' },
  { name: 'AI专家分析', desc: '查看指定日期的专家投票明细、分层结论、专家记忆和当日记忆条目', badge: 'bg-indigo-100 text-indigo-700' },
  { name: 'AI数据收集', desc: '查看指定日期的 FactPool、8 个数据 Agent、3 个提取 Agent 和结构化提取结果', badge: 'bg-fuchsia-100 text-fuchsia-700' },
  { name: 'AI 配置', desc: '配置 provider、模型池、9 个 LLM 分析层、15 个规则专家、3 个提取 Agent 与相关映射', badge: 'bg-cyan-100 text-cyan-700' },
  { name: '全局设置', desc: '配置盘中自动止损/止盈阈值，以及日/周/月组合亏损阈值', badge: 'bg-slate-100 text-slate-700' },
  { name: '系统说明', desc: '当前页面。解释整个系统如何运行、何时自动执行、哪些规则只是提醒、哪些会直接成交', badge: 'bg-slate-100 text-slate-600' },
]

function ConceptCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50/80 p-3">
      <div className="font-semibold text-slate-800 mb-1">{title}</div>
      <div className="text-slate-600 leading-relaxed">{children}</div>
    </div>
  )
}

export function GuideTab() {
  return (
    <div className="space-y-4 pb-20">
      <h2 className="text-xl font-bold text-slate-800">系统说明</h2>

      <div className="bg-gradient-to-r from-indigo-50/80 to-blue-50/80 border border-indigo-200/60 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-bold text-indigo-900 mb-1">这套系统现在到底在做什么？</h3>
        <p className="text-sm text-indigo-800 leading-relaxed">
          这是一个 <strong>本地 JSON 持久化的 A 股辅助决策系统</strong>。它每天会围绕中证500股票池自动完成盘前分析、开盘自动执行、盘中监控、盘后数据采集与专家学习，并在前端把这些运行结果组织成可操作的工作台。它不是券商程序化直连系统，但在交易时段内，<strong>你在「全局设置」里配置的盘中自动止损/自动止盈阈值会直接触发自动平仓</strong>；其余大多数规则仍然属于提醒和辅助决策。
        </p>
      </div>

      <div className="bg-white/70 border border-slate-200/60 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-bold text-slate-800 mb-1">每日自动运行时间线</h3>
        <p className="text-xs text-slate-500 mb-3">以下任务默认按交易日和北京时间自动运行。绝大多数步骤都有去重和补跑保护，避免重复执行或服务重启后漏跑。</p>

        <div className="relative ml-4">
          <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-slate-200" />

          <div className="space-y-3">
            {TIMELINE.map((node) => (
              <div key={`${node.time}-${node.label}`} className="relative flex items-start gap-3">
                <div className={`relative z-10 w-4 h-4 rounded-full ${node.color} ring-2 ring-white shadow-sm flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 rounded px-1.5 py-0.5">{node.time}</span>
                    <span className="text-sm font-semibold text-slate-800">{node.icon} {node.label}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{node.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white/70 border border-slate-200/60 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-bold text-slate-800 mb-2">你每天真正需要做什么？</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
            <div className="text-sm font-bold text-blue-800 mb-1.5">盘前</div>
            <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside leading-relaxed">
              <li>先看「总览看板」确认市场状态、风控状态和今日重点建议</li>
              <li>再进「每日策略」看高分信号、否决原因和卖出建议</li>
              <li>如果你不认同系统建议，推翻时尽量写清原因，便于后续复盘</li>
            </ol>
          </div>

          <div className="rounded-xl border border-green-100 bg-green-50/50 p-3">
            <div className="text-sm font-bold text-green-800 mb-1.5">盘中</div>
            <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside leading-relaxed">
              <li>系统会自动监控，不需要你持续盯盘</li>
              <li>若达到盘中自动止损/止盈阈值，系统会直接自动平仓</li>
              <li>若只是提醒类风险，主要在看板横幅、持仓风控页和关键通知里提示你</li>
            </ol>
          </div>

          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3">
            <div className="text-sm font-bold text-purple-800 mb-1.5">盘后</div>
            <ol className="text-xs text-purple-700 space-y-1 list-decimal list-inside leading-relaxed">
              <li>盘后流程会自动运行，通常不需要手动干预</li>
              <li>建议隔天或每周看一次「记忆复盘」和「AI专家分析」</li>
              <li>如果你想核对系统到底采了什么数据，就去「AI数据收集」页面</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/70 border border-slate-200/60 rounded-2xl shadow-sm p-4">
          <h3 className="text-base font-bold text-slate-800 mb-2">核心运行逻辑</h3>
          <div className="space-y-3 text-xs">
            <ConceptCard title="1. 三流评分不是一句口号，而是实际算分链路">
              专家分来自 <strong>30 位 LLM 专家 + 15 个规则专家</strong>；技术分来自趋势、结构、量价与风险维度；量化分来自中期动量、横截面强度、流动性、稳定性与均值回归。三者再按当前市场体制加权得到最终分数。
            </ConceptCard>

            <ConceptCard title="2. Conviction Filter 才是最后一道买入门槛">
              不是分数高就一定买。系统会再检查阈值、否决项、市场环境、事件风险和仓位约束，最终才把信号落成 `strong_buy / buy / watch / none`。
            </ConceptCard>

            <ConceptCard title="3. 事件驱动和重大事件否决已经接进主流程">
              盘前会读取前一交易日盘后结构化提取结果，把高置信度利好事件对应的股票补进候选池；同时对财报、股权变动等重大不确定性事件做一票否决。
            </ConceptCard>

            <ConceptCard title="4. 满仓时也会继续做完整分析">
              当前持仓已满只会限制后续开仓，不会让系统退化成公式 fallback。daily run 仍会跑真实专家投票、生成新信号并做持仓复评。
            </ConceptCard>

            <ConceptCard title="5. 实时价格与盘前快照是分开的">
              盘前生成的 `snapshot` 用于溯源和分析基准；盘中显示与收盘定格走 `realtime`。所以看到的当前价并不是旧 signals 文件里静态不变的昨收价。
            </ConceptCard>

            <ConceptCard title="6. 专家会学习，但学习口径已经改成当日收盘结算">
              专家表现、模型组表现和权重学习现在按“盘前预测，收盘结算”计算，不再等持仓卖出，也不再混入 T+5 或平仓收益口径。
            </ConceptCard>
          </div>
        </div>

        <div className="bg-white/70 border border-slate-200/60 rounded-2xl shadow-sm p-4">
          <h3 className="text-base font-bold text-slate-800 mb-2">风控机制</h3>
          <div className="space-y-3 text-xs text-slate-600">
            <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
              <div className="font-semibold text-red-800 mb-1">事前风控：直接拦截新开仓</div>
              <div className="space-y-1 text-red-700">
                <p>- 持仓数量达到上限</p>
                <p>- 黑名单标的</p>
                <p>- 市场级极端熊市或流动性危机</p>
                <p>- 重大事件一票否决</p>
                <p>- 组合风控处于 `paused` 状态</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <div className="font-semibold text-amber-800 mb-1">盘中风控：分“自动执行”与“提醒”两类</div>
              <div className="overflow-hidden rounded-lg border border-amber-200/80">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-amber-100/60">
                      <th className="px-2 py-1 text-left font-semibold text-amber-800">规则</th>
                      <th className="px-2 py-1 text-left font-semibold text-amber-800">触发条件</th>
                      <th className="px-2 py-1 text-left font-semibold text-amber-800">系统行为</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100">
                    <tr>
                      <td className="px-2 py-1 font-medium text-amber-700">自动止损平仓</td>
                      <td className="px-2 py-1">盘中亏损达到全局设置阈值</td>
                      <td className="px-2 py-1 text-red-600 font-medium">直接自动平仓</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-medium text-amber-700">自动止盈平仓</td>
                      <td className="px-2 py-1">盘中盈利达到全局设置阈值</td>
                      <td className="px-2 py-1 text-green-600 font-medium">直接自动平仓</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-medium text-amber-700">止损/止盈提醒</td>
                      <td className="px-2 py-1">达到策略止损线或 3% / 6% 止盈线</td>
                      <td className="px-2 py-1 text-amber-600 font-medium">提醒为主</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-medium text-amber-700">超期持仓</td>
                      <td className="px-2 py-1">持仓天数超过上限</td>
                      <td className="px-2 py-1 text-amber-600 font-medium">提醒为主</td>
                    </tr>
                    <tr>
                      <td className="px-2 py-1 font-medium text-amber-700">异常波动 / 板块异动</td>
                      <td className="px-2 py-1">振幅异常或板块多股跌停</td>
                      <td className="px-2 py-1 text-amber-600 font-medium">提醒为主</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-amber-700">自动平仓严格依赖真实交易时段判断。午休、收盘后、周末和法定休市日不会触发自动卖出。</p>
            </div>

            <div className="rounded-lg border border-purple-100 bg-purple-50/40 p-3">
              <div className="font-semibold text-purple-800 mb-1">组合风控：有“告警”和“暂停”两层语义</div>
              <div className="space-y-1 text-purple-700">
                <p>- 日亏损、周亏损、月亏损、最大回撤都会进入风险状态和事件时间线</p>
                <p>- 真正会触发 <strong>暂停新开仓</strong> 的是：<strong>月度亏损超限</strong> 或 <strong>最大回撤超限</strong></p>
                <p>- 即使系统已暂停，仍允许你手动平仓或减仓退出风险</p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
              <div className="font-semibold text-slate-700 mb-1">交易一致性保护</div>
              <div className="space-y-1 text-slate-600">
                <p>- 开仓 / 平仓 / 减仓全部走文件锁，避免并发写坏 JSON</p>
                <p>- 平仓 / 减仓带 `clientNonce` 幂等保护，防止双击和网络重试重复卖出</p>
                <p>- T+1 校验仍生效，当天买入不能当天卖出</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/70 border border-slate-200/60 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-bold text-slate-800 mb-2">AI 与数据系统</h3>
        <div className="grid grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="font-semibold text-slate-700 mb-1">股票池与行情</div>
            <p>当前主股票池是中证500成分股。自选股票搜索则覆盖 A 股全市场。行情抓取以腾讯为主，部分链路保留其他源做兜底。</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="font-semibold text-slate-700 mb-1">AI 专家系统</div>
            <p>系统内置 9 个 LLM 分析层，共 30 位 LLM 专家；另有 15 个规则专家。LLM 投票支持多 provider、fallback、并发限流、超时降级和专家动态权重。</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <div className="font-semibold text-slate-700 mb-1">数据采集与提取</div>
            <p>盘后自动运行 8 个数据采集 Agent，再由 3 个 LLM 提取 Agent 做公告、新闻影响和情绪结构化提取。次日 07:30 再跑晨间补充，专门兜夜间新增信息。</p>
          </div>
        </div>
      </div>

      <div className="bg-white/70 border border-slate-200/60 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-bold text-slate-800 mb-2">本地存储与可审计性</h3>
        <p className="text-xs text-slate-600 leading-relaxed">
          这套系统的运行结果主要都持久化在本地目录 <code className="bg-slate-200/80 px-1 rounded text-[10px]">~/文档/AI炒股分析</code>。
          其中 `signals/` 存每日信号、`positions.json` 存持仓、`trades.json` 存交易、`intraday/` 存盘中状态、`experts/` 存记忆与专家表现、`config/strategy.json` 存全局行为参数。
          如果你想核对“系统为什么得出这个结论”，不要只看首页卡片，直接去「AI专家分析」和「AI数据收集」看原始投票、FactPool 和提取结果。
        </p>
      </div>

      <div className="bg-white/70 border border-slate-200/60 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-bold text-slate-800 mb-2">各页面功能一览</h3>
        <div className="overflow-hidden rounded-xl border border-slate-200/80 text-xs">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80">
                <th className="px-3 py-2 font-semibold text-slate-700 w-28">页面</th>
                <th className="px-3 py-2 font-semibold text-slate-700">功能说明</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PAGE_TABLE.map((row) => (
                <tr key={row.name}>
                  <td className="px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${row.badge}`}>{row.name}</span>
                  </td>
                  <td className="px-3 py-2 text-slate-500 leading-relaxed">{row.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gradient-to-r from-green-50/80 to-emerald-50/80 border border-green-200/60 rounded-2xl shadow-sm p-4">
        <h3 className="text-base font-bold text-green-900 mb-2">给当前版本的 6 条使用建议</h3>
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { num: '1', title: '先分清“自动执行”和“自动平仓”', desc: '09:31 的自动执行是对系统信号开仓/忽略；盘中自动平仓是对持仓风控，两者不是一回事。' },
            { num: '2', title: '先配全局设置再实盘', desc: '盘中自动止损、自动止盈、日周月阈值都属于系统级开关，先调到你能接受的范围。' },
            { num: '3', title: '看实时价格要看 realtime 口径', desc: '盘前信号页的分析基准和盘中实时报价是分离的，不要把旧 snapshot 当成盘中现价。' },
            { num: '4', title: '暂停不代表不能卖', desc: '组合风控暂停只限制新开仓，你仍然可以平仓或减仓退出风险。' },
            { num: '5', title: '不信黑盒就去审计页', desc: '专家分析页看投票，数据收集页看 FactPool 和提取结果，这比只看一句“建议买入”更可靠。' },
            { num: '6', title: '自选股票是观察台，不是自动池', desc: '自选页方便你盯全市场个股，但它不会自动进入中证500主策略池，也不会被自动买入。' },
          ].map((tip) => (
            <div key={tip.num} className="rounded-xl bg-white/70 border border-green-100 p-2.5">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{tip.num}</span>
                <span className="text-sm font-semibold text-green-800">{tip.title}</span>
              </div>
              <p className="text-xs text-green-700 leading-relaxed">{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50/60 border border-amber-200/60 rounded-2xl shadow-sm px-4 py-3">
        <h3 className="text-sm font-bold text-amber-800 mb-1">免责声明</h3>
        <p className="text-xs text-amber-700 leading-relaxed">
          本系统仅为个人学习与辅助决策工具，<strong>不构成任何投资建议</strong>。历史表现、模型结论、专家投票和自动规则都不能保证未来收益，所有交易决策与盈亏后果由用户自行承担。
        </p>
      </div>
    </div>
  )
}
